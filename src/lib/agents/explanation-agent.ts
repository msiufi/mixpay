// Explanation Agent — generates Infleta-style insights and a friendly explanation.

import { callClaude } from '../claude-client'
import { getWorstCaseFee } from '../optimizer'
import type {
  AgentEvent,
  EnrichedSource,
  ExplanationResult,
  InfletaInsight,
  OptimizationAgentResult,
  RiskAssessment,
} from './types'

const SYSTEM_PROMPT = `You are MixPay's financial advisor. Generate a friendly explanation of a payment optimization and Infleta-style investment insights.

The "Infleta concept": sometimes paying with a credit card (higher fee) is smarter than using cash, because the cash can stay invested and earn yield that EXCEEDS the card fee.

Return ONLY valid JSON (no markdown fences):
{
  "shortExplanation": "2-3 friendly sentences explaining the optimization. Make the user feel smart.",
  "savingsVsVisa": <number, USD saved vs 3.5% Visa>,
  "insightLines": [
    {
      "kind": "savings" | "opportunity_cost" | "idle_balance" | "invest_suggestion",
      "headline": "short headline (max 40 chars)",
      "detail": "one sentence detail",
      "deltaUSD": <number, positive = benefit, negative = cost>
    }
  ]
}

Generate exactly 2-3 insights:
1. ALWAYS include a "savings" insight showing fee savings vs worst-case Visa
2. If any balance source with yield > 0 was used, add an "opportunity_cost" insight
3. If idle balances remain OR if credit card + investing would be better, add an "invest_suggestion" insight`

function buildPrompt(
  merchant: string,
  amount: number,
  optResult: OptimizationAgentResult,
  enrichedSources: EnrichedSource[],
  riskAssessment: RiskAssessment,
): string {
  const worstFee = getWorstCaseFee(amount)
  const savings = worstFee - optResult.totalFees

  const allocLines = optResult.allocations.map(a =>
    `- ${a.label}: $${a.amountUSD.toFixed(2)} (fee: $${a.fee.toFixed(4)}, opportunity cost: $${a.opportunityCostUSD.toFixed(4)}, true cost: $${a.trueCostUSD.toFixed(4)})`
  ).join('\n')

  const sourceLines = enrichedSources.map(s => {
    const used = optResult.allocations.find(a => a.sourceId === s.id)
    const remaining = used ? s.available - used.amountOriginal : s.available
    return `- ${s.label}: yield ${(s.effectiveYieldRate * 100).toFixed(1)}% APY, remaining balance: ${remaining.toFixed(2)} ${s.currency}`
  }).join('\n')

  return `Payment: $${amount.toFixed(2)} at ${merchant}
Risk: ${riskAssessment.level}

Allocation:
${allocLines}

Total fees: $${optResult.totalFees.toFixed(4)}
Total opportunity cost: $${optResult.totalOpportunityCost.toFixed(4)}
Savings vs Visa (3.5%): $${savings.toFixed(4)}

Agent reasoning: ${optResult.reasoning}
Alternative considered: ${optResult.alternativeConsidered}

Source balances after payment:
${sourceLines}

Generate the explanation and insights.`
}

function buildFallbackResult(
  amount: number,
  optResult: OptimizationAgentResult,
): ExplanationResult {
  const savings = getWorstCaseFee(amount) - optResult.totalFees
  const insightLines: InfletaInsight[] = [
    {
      kind: 'savings',
      headline: `Saved $${savings.toFixed(2)} vs Visa`,
      detail: 'MixPay prioritized low-fee sources to minimize your costs.',
      deltaUSD: savings,
    },
  ]

  if (optResult.totalOpportunityCost > 0.001) {
    insightLines.push({
      kind: 'opportunity_cost',
      headline: 'Yield impact considered',
      detail: `$${optResult.totalOpportunityCost.toFixed(3)}/mo in foregone yield was factored into this optimization.`,
      deltaUSD: -optResult.totalOpportunityCost,
    })
  }

  return {
    shortExplanation: `MixPay optimized your payment with $${optResult.totalFees.toFixed(2)} in fees, saving $${savings.toFixed(2)} vs a traditional credit card.`,
    savingsVsVisa: savings,
    insightLines,
  }
}

export async function runExplanationAgent(
  merchant: string,
  amount: number,
  optResult: OptimizationAgentResult,
  enrichedSources: EnrichedSource[],
  riskAssessment: RiskAssessment,
  onEvent: (e: AgentEvent) => void,
): Promise<ExplanationResult> {
  onEvent({ kind: 'agent_start', agentName: 'ExplanationAgent', timestamp: Date.now() })

  const responseText = await callClaude(
    buildPrompt(merchant, amount, optResult, enrichedSources, riskAssessment),
    {
      model: 'claude-sonnet-4-6',
      maxTokens: 800,
      systemPrompt: SYSTEM_PROMPT,
    },
  )

  let result: ExplanationResult

  try {
    const cleaned = responseText.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
    const parsed = JSON.parse(cleaned)
    result = {
      shortExplanation: parsed.shortExplanation ?? '',
      savingsVsVisa: Number(parsed.savingsVsVisa) || 0,
      insightLines: Array.isArray(parsed.insightLines) ? parsed.insightLines : [],
    }
  } catch {
    result = buildFallbackResult(amount, optResult)
  }

  onEvent({ kind: 'agent_done', agentName: 'ExplanationAgent', timestamp: Date.now() })
  return result
}
