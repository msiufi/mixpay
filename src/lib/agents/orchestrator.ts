// Orchestrator — coordinates all agents in sequence.
// Uses pre-cached rates when available (fetched on app mount),
// falls back to Rates Agent only if cache is cold.

import type { PaymentSource, SourceUsage, Transaction } from '../../types'
import { hasApiKey } from '../claude-client'
import { getCachedRates, getRates, enrichSources } from '../rates-cache'
import type { AgentEvent, AgentPipelineResult, EnrichedSource, LiveRates, OptimizationAgentResult } from './types'
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

/** Try to get rates from cache first, then getRates(), then Rates Agent as last resort. */
async function resolveRates(
  sources: PaymentSource[],
  onEvent: (e: AgentEvent) => void,
): Promise<{ enrichedSources: EnrichedSource[]; liveRates: LiveRates }> {
  // 1. Check in-memory cache (instant, no network)
  const cached = getCachedRates()
  if (cached) {
    onEvent({ kind: 'agent_start', agentName: 'RatesAgent', timestamp: Date.now() })
    onEvent({ kind: 'agent_progress', agentName: 'RatesAgent', message: 'Using cached market data', timestamp: Date.now() })
    onEvent({ kind: 'agent_done', agentName: 'RatesAgent', timestamp: Date.now() })
    return { enrichedSources: enrichSources(sources, cached), liveRates: cached }
  }

  // 2. Fetch directly (parallel HTTP, no Claude call)
  try {
    onEvent({ kind: 'agent_start', agentName: 'RatesAgent', timestamp: Date.now() })
    onEvent({ kind: 'agent_progress', agentName: 'RatesAgent', message: 'Fetching live rates...', timestamp: Date.now() })
    const liveRates = await getRates()
    onEvent({ kind: 'agent_done', agentName: 'RatesAgent', timestamp: Date.now() })
    return { enrichedSources: enrichSources(sources, liveRates), liveRates }
  } catch {
    // 3. Fall back to Rates Agent (Claude + tool_use)
    return runRatesAgent(sources, onEvent)
  }
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
    // ── Step 1: Resolve rates (cache → fetch → Rates Agent) ────────
    const { enrichedSources, liveRates } = await resolveRates(sources, onEvent)

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
      liveRates,
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
