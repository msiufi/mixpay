// Deterministic fallback when VITE_CLAUDE_API_KEY is absent.
// Uses the same true-cost math tools as the AI pipeline for correct allocation.

import type { PaymentSource } from '../../types'
import { getWorstCaseFee } from '../optimizer'
import { ARG_MONTHLY_INFLATION, US_ANNUAL_INFLATION } from '../config'
import { getCachedRates, enrichSources } from '../rates-cache'
import { createMathToolHandlers } from './math-tools'
import type {
  AgentEvent,
  AgentPipelineResult,
  EnrichedSource,
  ExplanationResult,
  SmartInsight,
  LiveRates,
  RiskAssessment,
  OptimizationAgentResult,
} from './types'

function emit(onEvent: (e: AgentEvent) => void, partial: Omit<AgentEvent, 'timestamp'>) {
  onEvent({ ...partial, timestamp: Date.now() } as AgentEvent)
}

export async function buildFallbackPipelineResult(
  merchant: string,
  amount: number,
  sources: PaymentSource[],
  onEvent?: (e: AgentEvent) => void,
): Promise<AgentPipelineResult> {
  const fire = onEvent ?? (() => {})

  // Use cached live rates if available, otherwise defaults
  const cachedRates = getCachedRates()
  const liveRates: LiveRates = cachedRates ?? {
    arsExchangeRate: 1400,
    fciTopFunds: [{ name: 'Ualá Plus 2 (est.)', tna: 29 }],
    monthlyInflation: ARG_MONTHLY_INFLATION,
    usAnnualInflation: US_ANNUAL_INFLATION,
    marketData: {},
  }

  // Build enriched sources
  const enrichedSources: EnrichedSource[] = cachedRates
    ? enrichSources(sources, cachedRates)
    : sources.map(s => ({
        ...s,
        effectiveYieldRate: s.yieldRate ?? 0,
        liveExchangeRate: s.currency === 'ARS' ? 1400 : undefined,
      }))

  // Simulate agent progression
  emit(fire, { kind: 'agent_start', agentName: 'RatesAgent' })
  emit(fire, { kind: 'agent_done', agentName: 'RatesAgent' })

  emit(fire, { kind: 'agent_start', agentName: 'OptimizationAgent' })

  // Use the SAME math tools as the AI pipeline — true cost ranking
  const handlers = createMathToolHandlers(
    amount,
    enrichedSources,
    liveRates.arsExchangeRate,
    liveRates.monthlyInflation,
    liveRates.usAnnualInflation,
  )

  const costsResult = await handlers.calculate_true_costs({}) as {
    optimalOrder: string[]
  }

  const allocation = await handlers.allocate_payment({ source_order: costsResult.optimalOrder }) as {
    allocations: OptimizationAgentResult['allocations']
    totalUSD: number
    totalFees: number
    totalOpportunityCost: number
    success: boolean
  }

  emit(fire, { kind: 'agent_done', agentName: 'OptimizationAgent' })

  emit(fire, { kind: 'agent_start', agentName: 'RiskAgent' })
  emit(fire, { kind: 'agent_done', agentName: 'RiskAgent' })

  emit(fire, { kind: 'agent_start', agentName: 'ExplanationAgent' })

  const riskAssessment: RiskAssessment = {
    level: 'low',
    flags: [],
    recommendation: 'Transaction looks normal.',
  }

  // Build insights
  const savings = getWorstCaseFee(amount) - allocation.totalFees
  const insightLines: SmartInsight[] = []

  if (savings > 0.001) {
    insightLines.push({
      kind: 'savings',
      headline: `Saved $${savings.toFixed(2)} vs Visa`,
      detail: 'MixPay used true-cost ranking to minimize fees and opportunity cost.',
      deltaUSD: savings,
    })
  }

  if (allocation.totalOpportunityCost !== 0) {
    insightLines.push({
      kind: 'opportunity_cost',
      headline: 'Opportunity cost factored in',
      detail: `Real yield (adjusted for inflation) was considered in the optimization.`,
      deltaUSD: -allocation.totalOpportunityCost,
    })
  }

  const bestFund = liveRates.fciTopFunds[0]
  if (bestFund) {
    const annualInflation = liveRates.monthlyInflation * 12
    const realYield = (bestFund.tna / 100) - annualInflation
    insightLines.push({
      kind: 'invest_suggestion',
      headline: `Invest in ${bestFund.name}`,
      detail: `${bestFund.name} at ${bestFund.tna}% TNA gives ${(realYield * 100).toFixed(1)}% real yield above inflation.`,
      deltaUSD: 0,
    })
  }

  const explanation: ExplanationResult = {
    shortExplanation: `MixPay optimized your $${amount.toFixed(2)} payment at ${merchant}, saving $${savings.toFixed(2)} compared to a traditional credit card.`,
    savingsVsVisa: savings,
    insightLines,
  }

  emit(fire, { kind: 'agent_done', agentName: 'ExplanationAgent' })

  const optimizationResult = {
    sourceUsages: allocation.allocations.map(a => ({
      sourceId: a.sourceId,
      label: a.label,
      symbol: a.symbol,
      currency: a.currency,
      amountOriginal: a.amountOriginal,
      amountUSD: a.amountUSD,
      fee: a.fee,
      feeRate: a.feeRate,
    })),
    totalUSD: allocation.totalUSD,
    totalFees: allocation.totalFees,
    success: allocation.success,
  }

  const pipelineResult: AgentPipelineResult = {
    optimizationResult,
    enrichedSources,
    liveRates,
    riskAssessment,
    explanation,
  }

  emit(fire, { kind: 'pipeline_complete', result: pipelineResult })

  return pipelineResult
}
