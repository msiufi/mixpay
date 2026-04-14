import type { OptimizationResult, PaymentSource } from '../../types'

// ── Agent event stream (feeds the Optimizing.tsx animation) ──────────

export type AgentEventKind =
  | 'agent_start'
  | 'agent_progress'
  | 'agent_tool_call'
  | 'agent_tool_result'
  | 'agent_thinking'
  | 'agent_done'
  | 'pipeline_complete'
  | 'pipeline_error'

export interface AgentEvent {
  kind: AgentEventKind
  agentName?: string
  message?: string
  toolName?: string
  toolArgs?: Record<string, unknown>
  toolResult?: unknown
  thinkingSnippet?: string
  result?: AgentPipelineResult
  error?: string
  timestamp: number
}

// ── Rates Agent ──────────────────────────────────────────────────────

export interface LiveRates {
  arsExchangeRate: number                          // ARS per 1 USD (e.g. 1385)
  fciTopFunds: { name: string; tna: number }[]     // top FCI funds with annual nominal rate
  monthlyInflation: number                         // e.g. 0.029 (Argentine)
  usAnnualInflation: number                        // e.g. 0.03 (US)
  marketData: Record<string, number>               // bitcoin, sp500, gold, etc.
}

export interface EnrichedSource extends PaymentSource {
  effectiveYieldRate: number   // final annual yield used for optimization
  liveExchangeRate?: number    // for ARS: live rate from dolarapi
}

// ── Optimization Agent ───────────────────────────────────────────────

export interface AllocationItem {
  sourceId: string
  label: string
  symbol: string
  currency: string
  amountUSD: number
  amountOriginal: number
  fee: number
  feeRate: number
  opportunityCostUSD: number   // yield lost by spending this source (1-month horizon)
  trueCostUSD: number          // fee + opportunityCost (negative = net benefit)
}

export interface OptimizationAgentResult {
  allocations: AllocationItem[]
  totalUSD: number
  totalFees: number
  totalOpportunityCost: number
  reasoning: string
  alternativeConsidered: string
  success: boolean
}

// ── Risk Agent ───────────────────────────────────────────────────────

export type RiskLevel = 'low' | 'medium' | 'high'

export interface RiskAssessment {
  level: RiskLevel
  flags: string[]
  recommendation: string
}

// ── Explanation Agent ────────────────────────────────────────────────

export interface SmartInsight {
  kind: 'savings' | 'opportunity_cost' | 'idle_balance' | 'invest_suggestion'
  headline: string
  detail: string
  deltaUSD: number   // positive = user benefit, negative = cost / missed opportunity
}

export interface ExplanationResult {
  shortExplanation: string
  savingsVsVisa: number
  insightLines: SmartInsight[]
}

// ── Full pipeline result ─────────────────────────────────────────────

export interface AgentPipelineResult {
  optimizationResult: OptimizationResult
  enrichedSources: EnrichedSource[]
  liveRates: LiveRates
  riskAssessment: RiskAssessment
  explanation: ExplanationResult
}

// ── Stream hook types ────────────────────────────────────────────────

export type StreamPhase =
  | 'idle'
  | 'fetching_rates'
  | 'optimizing'
  | 'assessing_risk'
  | 'generating_insight'
  | 'complete'
  | 'error'

export interface OptimizationStreamState {
  phase: StreamPhase
  phaseLabel: string
  thinkingSnippet: string
  toolCallName: string | null
  result: AgentPipelineResult | null
  error: string | null
}
