// Deterministic fallback when VITE_CLAUDE_API_KEY is absent.
// Reuses the existing greedy optimizer so the app works without an API key.

import type { PaymentSource } from '../../types'
import { optimizePayment, getWorstCaseFee } from '../optimizer'
import type {
  AgentEvent,
  AgentPipelineResult,
  EnrichedSource,
  ExplanationResult,
  SmartInsight,
  LiveRates,
  RiskAssessment,
} from './types'

function emit(onEvent: (e: AgentEvent) => void, partial: Omit<AgentEvent, 'timestamp'>) {
  onEvent({ ...partial, timestamp: Date.now() } as AgentEvent)
}

export function buildFallbackPipelineResult(
  merchant: string,
  amount: number,
  sources: PaymentSource[],
  onEvent?: (e: AgentEvent) => void,
): AgentPipelineResult {
  const fire = onEvent ?? (() => {})

  // Simulate agent progression so the UI animation still works
  emit(fire, { kind: 'agent_start', agentName: 'RatesAgent' })
  emit(fire, { kind: 'agent_done', agentName: 'RatesAgent' })

  emit(fire, { kind: 'agent_start', agentName: 'OptimizationAgent' })
  const optResult = optimizePayment(amount, sources)
  emit(fire, { kind: 'agent_done', agentName: 'OptimizationAgent' })

  emit(fire, { kind: 'agent_start', agentName: 'RiskAgent' })
  emit(fire, { kind: 'agent_done', agentName: 'RiskAgent' })

  emit(fire, { kind: 'agent_start', agentName: 'ExplanationAgent' })

  // Build enriched sources (just add yield + effective yield)
  const enrichedSources: EnrichedSource[] = sources.map(s => ({
    ...s,
    effectiveYieldRate: s.yieldRate ?? 0,
    liveExchangeRate: s.currency === 'ARS' ? 1400 : undefined,
  }))

  const liveRates: LiveRates = {
    arsExchangeRate: 1400,
    fciTopFunds: [{ name: 'FCI Money Market (fallback)', tna: 40 }],
    monthlyInflation: 0.029,
    marketData: {},
  }

  const riskAssessment: RiskAssessment = {
    level: 'low',
    flags: [],
    recommendation: 'Transaction looks normal.',
  }

  // Build Smart insights from the deterministic result
  const savings = getWorstCaseFee(amount) - optResult.totalFees
  const insightLines: SmartInsight[] = []

  if (savings > 0.001) {
    insightLines.push({
      kind: 'savings',
      headline: `You saved $${savings.toFixed(2)} vs Visa`,
      detail: `MixPay used low-fee sources first, avoiding the 3.5% credit card surcharge.`,
      deltaUSD: savings,
    })
  }

  // Opportunity cost insight for balance sources that were used
  const balanceUsages = optResult.sourceUsages.filter(u => {
    const src = sources.find(s => s.id === u.sourceId)
    return src && (src.yieldRate ?? 0) > 0
  })
  if (balanceUsages.length > 0) {
    const topUsage = balanceUsages[0]
    const src = sources.find(s => s.id === topUsage.sourceId)!
    const monthlyYield = (src.yieldRate ?? 0) / 12
    const opportunityCost = topUsage.amountUSD * monthlyYield
    if (opportunityCost > 0.001) {
      insightLines.push({
        kind: 'opportunity_cost',
        headline: `${src.label} earns ${((src.yieldRate ?? 0) * 100).toFixed(1)}% APY`,
        detail: `Using $${topUsage.amountUSD.toFixed(2)} from ${src.label} costs ~$${opportunityCost.toFixed(3)}/mo in foregone yield.`,
        deltaUSD: -opportunityCost,
      })
    }
  }

  // Idle balance suggestion
  const unusedBalances = sources.filter(s => {
    const used = optResult.sourceUsages.find(u => u.sourceId === s.id)
    return s.kind === 'balance' && (!used || s.available - (used.amountOriginal ?? 0) > 2)
  })
  if (unusedBalances.length > 0) {
    const idle = unusedBalances[0]
    insightLines.push({
      kind: 'invest_suggestion',
      headline: `Invest idle ${idle.currency}`,
      detail: `Your ${idle.label} balance could earn ~${((idle.yieldRate ?? 0) * 100).toFixed(1)}% APY in a money market fund.`,
      deltaUSD: 0,
    })
  }

  const explanation: ExplanationResult = {
    shortExplanation: `MixPay optimized your $${amount.toFixed(2)} payment at ${merchant}, saving $${savings.toFixed(2)} compared to a traditional credit card.`,
    savingsVsVisa: savings,
    insightLines,
  }

  emit(fire, { kind: 'agent_done', agentName: 'ExplanationAgent' })

  const pipelineResult: AgentPipelineResult = {
    optimizationResult: optResult,
    enrichedSources,
    liveRates,
    riskAssessment,
    explanation,
  }

  emit(fire, { kind: 'pipeline_complete', result: pipelineResult })

  return pipelineResult
}
