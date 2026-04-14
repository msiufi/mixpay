// Optimization Agent — deterministic math + Claude for reasoning.
// Math tools compute the EXACT optimal allocation (no LLM math).
// Claude Opus explains WHY this allocation is optimal.

import { callClaude } from '../claude-client'
import { OPTIMIZATION_MODEL } from '../config'
import { createMathToolHandlers } from './math-tools'
import type { AgentEvent, EnrichedSource, LiveRates, OptimizationAgentResult } from './types'

const REASONING_PROMPT = `You are MixPay's AI advisor. You are given a payment allocation that was computed by our optimization engine using precise math.

Your ONLY job: explain the allocation in 2-3 sentences for the "reasoning" field, and describe what the alternative would have been.

RULES:
- Do NOT recalculate or second-guess the allocation. The math is correct.
- Focus on explaining the KEY TRADEOFF (e.g., "Mastercard was chosen over ARS because...")
- Credit cards have 0 opportunity cost because they use borrowed money.
- Mention yield rates and fees as percentages.

Return ONLY valid JSON (no markdown fences):
{
  "reasoning": "2-3 sentences explaining the key tradeoff",
  "alternativeConsidered": "what would have happened with a different strategy"
}`

export async function runOptimizationAgent(
  amountUSD: number,
  enrichedSources: EnrichedSource[],
  liveRates: LiveRates,
  onEvent: (e: AgentEvent) => void,
): Promise<OptimizationAgentResult> {
  onEvent({ kind: 'agent_start', agentName: 'OptimizationAgent', timestamp: Date.now() })

  // ── Step 1: Deterministic math (no LLM) ────────────────────────
  onEvent({
    kind: 'agent_tool_call',
    agentName: 'OptimizationAgent',
    toolName: 'calculate_true_costs',
    timestamp: Date.now(),
  })

  const handlers = createMathToolHandlers(amountUSD, enrichedSources, liveRates.arsExchangeRate, liveRates.monthlyInflation, liveRates.usAnnualInflation)

  const costsResult = await handlers.calculate_true_costs({}) as {
    optimalOrder: string[]
    sources: { sourceId: string; trueCostPerDollar: number; label: string }[]
  }

  onEvent({
    kind: 'agent_tool_result',
    agentName: 'OptimizationAgent',
    toolName: 'calculate_true_costs',
    toolResult: costsResult,
    timestamp: Date.now(),
  })

  onEvent({
    kind: 'agent_tool_call',
    agentName: 'OptimizationAgent',
    toolName: 'allocate_payment',
    timestamp: Date.now(),
  })

  const allocation = await handlers.allocate_payment({ source_order: costsResult.optimalOrder }) as {
    allocations: OptimizationAgentResult['allocations']
    totalUSD: number
    totalFees: number
    totalOpportunityCost: number
    totalTrueCost: number
    success: boolean
  }

  onEvent({
    kind: 'agent_tool_result',
    agentName: 'OptimizationAgent',
    toolName: 'allocate_payment',
    toolResult: allocation,
    timestamp: Date.now(),
  })

  // ── Step 2: Claude explains the result ─────────────────────────
  onEvent({
    kind: 'agent_progress',
    agentName: 'OptimizationAgent',
    message: 'AI analyzing the optimal strategy...',
    timestamp: Date.now(),
  })

  const costSummary = costsResult.sources
    .map(s => `${s.label}: ${(s.trueCostPerDollar * 100).toFixed(2)}% true cost/dollar`)
    .join(', ')

  const allocSummary = allocation.allocations
    .map(a => `${a.label}: $${a.amountUSD.toFixed(2)} (fee: $${a.fee.toFixed(2)})`)
    .join(', ')

  let reasoning = 'Allocated by true cost ranking: lowest cost sources used first.'
  let alternativeConsidered = 'N/A'

  const responseText = await callClaude(
    `Payment: $${amountUSD.toFixed(2)}
True cost ranking: ${costSummary}
Optimal order: ${costsResult.optimalOrder.join(' → ')}
Allocation: ${allocSummary}
Total fees: $${allocation.totalFees.toFixed(2)}, Total opportunity cost: $${allocation.totalOpportunityCost.toFixed(2)}

Explain this allocation.`,
    {
      model: OPTIMIZATION_MODEL,
      maxTokens: 400,
      systemPrompt: REASONING_PROMPT,
    },
  )

  try {
    const cleaned = responseText.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
    const parsed = JSON.parse(cleaned)
    reasoning = parsed.reasoning ?? reasoning
    alternativeConsidered = parsed.alternativeConsidered ?? alternativeConsidered
  } catch {
    // Keep default reasoning
  }

  onEvent({ kind: 'agent_done', agentName: 'OptimizationAgent', timestamp: Date.now() })

  return {
    allocations: allocation.allocations,
    totalUSD: allocation.totalUSD,
    totalFees: allocation.totalFees,
    totalOpportunityCost: allocation.totalOpportunityCost,
    reasoning,
    alternativeConsidered,
    success: allocation.success,
  }
}
