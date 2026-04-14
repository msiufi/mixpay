// Optimization Agent — Claude Opus with tool_use for precise math.
// Opus reasons about STRATEGY (which sources and why).
// Math tools do the precise calculations (fees, currency conversion, true cost).

import { callClaudeWithTools } from '../claude-client'
import { OPTIMIZATION_MODEL } from '../config'
import { optimizePayment } from '../optimizer'
import { mathTools, createMathToolHandlers } from './math-tools'
import type { AgentEvent, EnrichedSource, LiveRates, OptimizationAgentResult } from './types'

const SYSTEM_PROMPT = `You are MixPay's AI payment optimization engine.

Your job: decide the STRATEGY for allocating a payment across multiple sources. You do NOT do math — you have tools for that.

## Workflow

1. Call \`calculate_true_costs\` — it returns an \`optimalOrder\` array
2. Call \`allocate_payment\` with \`source_order\` set to EXACTLY the \`optimalOrder\` array from step 1. Do NOT change the order.
3. Copy the tool result into your JSON response and add reasoning.

## CRITICAL RULES

- You MUST pass the \`optimalOrder\` array from calculate_true_costs directly as \`source_order\` to allocate_payment. Do NOT reorder, skip, or modify it.
- Do NOT do any math yourself. All numbers come from the tools.
- Credit cards often rank BETTER than balance sources because they have 0% opportunity cost (borrowed money).

## Output

After calling the tools, return ONLY valid JSON (no markdown fences):
{
  "allocations": <copy the allocations array from allocate_payment result>,
  "totalUSD": <from tool result>,
  "totalFees": <from tool result>,
  "totalOpportunityCost": <from tool result>,
  "reasoning": "2-3 sentences explaining your STRATEGY and the key tradeoff you identified",
  "alternativeConsidered": "what other strategy you considered and why you rejected it",
  "success": <from tool result>
}`

function buildUserPrompt(
  amountUSD: number,
  enrichedSources: EnrichedSource[],
  liveRates: LiveRates,
): string {
  const sourceLines = enrichedSources.map(s => {
    const parts = [
      `id: ${s.id}`,
      `label: ${s.label}`,
      `currency: ${s.currency}`,
      `available: ${s.available}`,
      `feeRate: ${(s.feeRate * 100).toFixed(1)}%`,
      `yieldRate: ${(s.effectiveYieldRate * 100).toFixed(1)}% APY`,
      `kind: ${s.kind}`,
    ]
    if (s.liveExchangeRate) parts.push(`exchangeRate: ${s.liveExchangeRate} ARS/USD`)
    return `  ${parts.join(', ')}`
  }).join('\n')

  return `Optimize this $${amountUSD.toFixed(2)} USD payment.

Available sources:
${sourceLines}

ARS exchange rate: ${liveRates.arsExchangeRate} ARS/USD
Monthly inflation: ${(liveRates.monthlyInflation * 100).toFixed(1)}%

Start by calling calculate_true_costs, then decide your strategy.`
}

export async function runOptimizationAgent(
  amountUSD: number,
  enrichedSources: EnrichedSource[],
  liveRates: LiveRates,
  onEvent: (e: AgentEvent) => void,
): Promise<OptimizationAgentResult> {
  onEvent({ kind: 'agent_start', agentName: 'OptimizationAgent', timestamp: Date.now() })
  onEvent({
    kind: 'agent_progress',
    agentName: 'OptimizationAgent',
    message: 'Opus is analyzing payment sources...',
    timestamp: Date.now(),
  })

  const toolHandlers = createMathToolHandlers(
    amountUSD,
    enrichedSources,
    liveRates.arsExchangeRate,
  )

  const responseText = await callClaudeWithTools(
    [{ role: 'user', content: buildUserPrompt(amountUSD, enrichedSources, liveRates) }],
    mathTools,
    toolHandlers,
    {
      model: OPTIMIZATION_MODEL,
      maxTokens: 4096,
      systemPrompt: SYSTEM_PROMPT,
    },
    (name, input) => {
      onEvent({
        kind: 'agent_tool_call',
        agentName: 'OptimizationAgent',
        toolName: name,
        toolArgs: input,
        timestamp: Date.now(),
      })
    },
    (name, result) => {
      onEvent({
        kind: 'agent_tool_result',
        agentName: 'OptimizationAgent',
        toolName: name,
        toolResult: result,
        timestamp: Date.now(),
      })
    },
  )

  // Parse Opus's final JSON
  if (responseText.length > 10) {
    try {
      const cleaned = responseText.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
      const parsed = JSON.parse(cleaned) as OptimizationAgentResult
      onEvent({ kind: 'agent_done', agentName: 'OptimizationAgent', timestamp: Date.now() })
      return parsed
    } catch {
      // JSON parse failed — fall through to fallback
    }
  }

  // Fallback: use the deterministic optimizer
  onEvent({
    kind: 'agent_progress',
    agentName: 'OptimizationAgent',
    message: 'Using deterministic fallback...',
    timestamp: Date.now(),
  })

  const fallback = optimizePayment(amountUSD, enrichedSources)

  const result: OptimizationAgentResult = {
    allocations: fallback.sourceUsages.map(u => {
      const src = enrichedSources.find(s => s.id === u.sourceId)
      const oppCost = u.amountUSD * ((src?.effectiveYieldRate ?? 0) / 12)
      return {
        sourceId: u.sourceId,
        label: u.label,
        symbol: u.symbol,
        currency: u.currency,
        amountUSD: u.amountUSD,
        amountOriginal: u.amountOriginal,
        fee: u.fee,
        feeRate: u.feeRate,
        opportunityCostUSD: oppCost,
        trueCostUSD: u.fee + oppCost,
      }
    }),
    totalUSD: fallback.totalUSD,
    totalFees: fallback.totalFees,
    totalOpportunityCost: fallback.sourceUsages.reduce((sum, u) => {
      const src = enrichedSources.find(s => s.id === u.sourceId)
      return sum + u.amountUSD * ((src?.effectiveYieldRate ?? 0) / 12)
    }, 0),
    reasoning: 'Used deterministic priority-based allocation as AI reasoning was unavailable.',
    alternativeConsidered: 'N/A',
    success: fallback.success,
  }

  onEvent({ kind: 'agent_done', agentName: 'OptimizationAgent', timestamp: Date.now() })
  return result
}
