// Optimization Agent — Claude Opus with extended thinking.
// Replaces the deterministic greedy algorithm with AI-driven allocation
// that considers both fees AND opportunity cost (the Infleta concept).

import { callClaudeStreaming } from '../claude-client'
import { optimizePayment } from '../optimizer'
import type { AgentEvent, EnrichedSource, LiveRates, OptimizationAgentResult } from './types'

const SYSTEM_PROMPT = `You are MixPay's AI payment optimization engine.

Your task: allocate a USD payment across multiple payment sources to minimize TRUE COST.

## True Cost Formula (1-month payment horizon)

For each source:
  fee             = amountUSD × feeRate
  opportunityCost = amountUSD × (effectiveYieldRate / 12)
  trueCost        = fee + opportunityCost

opportunityCost represents the yield you LOSE by spending this money instead of keeping it invested.

For credit cards (yieldRate = 0): trueCost = fee only. There is no opportunity cost because you are spending borrowed money — your own funds stay invested.

KEY INSIGHT: Sometimes paying a small credit card fee is CHEAPER than spending your invested cash, because the cash would have earned more in yield than the fee costs.

## Rules

1. Calculate trueCost for every source
2. Allocate starting from the LOWEST trueCost sources
3. For ARS sources: convert using liveExchangeRate (ARS per 1 USD)
4. Respect available balances — you cannot spend more than what's available
5. Fee is deducted from the source balance, not from the payment amount
6. A source with feeRate=0 but yieldRate=0.05 has trueCost = 0 + (amount × 0.05/12) ≈ 0.42% per month

## Output

Return ONLY valid JSON (no markdown fences, no extra text):
{
  "allocations": [
    {
      "sourceId": "string",
      "label": "string",
      "symbol": "string",
      "currency": "string",
      "amountUSD": number,
      "amountOriginal": number,
      "fee": number,
      "feeRate": number,
      "opportunityCostUSD": number,
      "trueCostUSD": number
    }
  ],
  "totalUSD": number,
  "totalFees": number,
  "totalOpportunityCost": number,
  "reasoning": "2-3 sentences explaining your decision and the key tradeoff",
  "alternativeConsidered": "what the second-best allocation would have been and why you rejected it",
  "success": true/false
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
      `feeRate: ${s.feeRate}`,
      `effectiveYieldRate: ${s.effectiveYieldRate}`,
    ]
    if (s.liveExchangeRate) parts.push(`liveExchangeRate: ${s.liveExchangeRate} ARS/USD`)
    return `  { ${parts.join(', ')} }`
  }).join('\n')

  return `Optimize this payment:

Amount: $${amountUSD.toFixed(2)} USD
Monthly inflation (ARS): ${(liveRates.monthlyInflation * 100).toFixed(1)}%

Available sources:
${sourceLines}

Allocate the payment to minimize total true cost.`
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
    message: 'Claude is reasoning through the optimal allocation...',
    timestamp: Date.now(),
  })

  let jsonText = ''
  let thinkingText = ''
  let hasContent = false

  try {
    for await (const event of callClaudeStreaming(
      [{ role: 'user', content: buildUserPrompt(amountUSD, enrichedSources, liveRates) }],
      {
        model: 'claude-opus-4-6',
        maxTokens: 16000,
        systemPrompt: SYSTEM_PROMPT,
        thinking: { type: 'enabled', budgetTokens: 10000 },
      },
    )) {
      hasContent = true

      if (event.type === 'content_block_delta') {
        if (event.delta?.type === 'thinking_delta' && event.delta.thinking) {
          thinkingText += event.delta.thinking
          // Emit thinking snippet every ~80 chars of new content
          if (thinkingText.length % 80 < event.delta.thinking.length) {
            onEvent({
              kind: 'agent_thinking',
              agentName: 'OptimizationAgent',
              thinkingSnippet: thinkingText.slice(-120),
              timestamp: Date.now(),
            })
          }
        } else if (event.delta?.type === 'text_delta' && event.delta.text) {
          jsonText += event.delta.text
        }
      }
    }
  } catch {
    // Stream failed — fall through to fallback
  }

  // Attempt to parse the JSON result
  if (hasContent && jsonText.length > 10) {
    try {
      const cleaned = jsonText.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
      const parsed = JSON.parse(cleaned) as OptimizationAgentResult
      onEvent({ kind: 'agent_done', agentName: 'OptimizationAgent', timestamp: Date.now() })
      return parsed
    } catch {
      // JSON parse failed — fall through to fallback
    }
  }

  // Fallback: use the deterministic optimizer and wrap the result
  onEvent({
    kind: 'agent_progress',
    agentName: 'OptimizationAgent',
    message: 'Using deterministic optimization as fallback...',
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
