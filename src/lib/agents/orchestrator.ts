// Orchestrator — coordinates all agents in sequence.
// TypeScript manages the call order; each agent is an independent Claude call.

import type { PaymentSource, SourceUsage, Transaction } from '../../types'
import { hasApiKey } from '../claude-client'
import type { AgentEvent, AgentPipelineResult, OptimizationAgentResult } from './types'
import { buildFallbackPipelineResult } from './fallback'
import { runRatesAgent } from './rates-agent'
import { runOptimizationAgent } from './optimization-agent'
import { runRiskAgent } from './risk-agent'
import { runExplanationAgent } from './explanation-agent'

/** Convert the agent's rich allocation to the app's existing SourceUsage format. */
function toSourceUsages(optResult: OptimizationAgentResult): SourceUsage[] {
  return optResult.allocations.map(a => ({
    sourceId: a.sourceId,
    label: a.label,
    symbol: a.symbol,
    currency: a.currency,
    amountOriginal: a.amountOriginal,
    amountUSD: a.amountUSD,
    fee: a.fee,
    feeRate: a.feeRate,
  }))
}

export async function runOrchestrator(
  merchant: string,
  amount: number,
  sources: PaymentSource[],
  recentTransactions: Transaction[],
  onEvent: (e: AgentEvent) => void,
): Promise<AgentPipelineResult> {
  // ── No API key → deterministic fallback ──────────────────────────
  if (!hasApiKey()) {
    return buildFallbackPipelineResult(merchant, amount, sources, onEvent)
  }

  try {
    // ── Step 1: Rates Agent (must complete before optimization) ─────
    const { enrichedSources, liveRates } = await runRatesAgent(sources, onEvent)

    // ── Step 2: Optimization + Risk in parallel ────────────────────
    const recentTx = recentTransactions.slice(0, 5).map(t => ({
      merchant: t.merchant,
      amount: t.amount,
    }))

    const [optAgentResult, riskAssessment] = await Promise.all([
      runOptimizationAgent(amount, enrichedSources, liveRates, onEvent),
      runRiskAgent(merchant, amount, recentTx, onEvent),
    ])

    // ── Step 3: Explanation Agent ──────────────────────────────────
    const explanation = await runExplanationAgent(
      merchant,
      amount,
      optAgentResult,
      enrichedSources,
      riskAssessment,
      onEvent,
    )

    // ── Assemble pipeline result ───────────────────────────────────
    const pipelineResult: AgentPipelineResult = {
      optimizationResult: {
        sourceUsages: toSourceUsages(optAgentResult),
        totalUSD: optAgentResult.totalUSD,
        totalFees: optAgentResult.totalFees,
        success: optAgentResult.success,
      },
      enrichedSources,
      liveRates,
      riskAssessment,
      explanation,
    }

    onEvent({ kind: 'pipeline_complete', result: pipelineResult, timestamp: Date.now() })
    return pipelineResult
  } catch (err) {
    onEvent({
      kind: 'pipeline_error',
      error: String(err),
      timestamp: Date.now(),
    })
    // Fall back to deterministic result on any unexpected error
    return buildFallbackPipelineResult(merchant, amount, sources, onEvent)
  }
}
