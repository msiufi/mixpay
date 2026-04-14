// Explanation Agent — generates smart insights and a friendly explanation.

import { callClaude } from '../claude-client'
import { getWorstCaseFee } from '../optimizer'
import type {
  AgentEvent,
  EnrichedSource,
  ExplanationResult,
  SmartInsight,
  LiveRates,
  OptimizationAgentResult,
  RiskAssessment,
} from './types'

const SYSTEM_PROMPT = `You are MixPay's financial advisor. Generate a friendly explanation of a payment optimization and smart investment insights.

Key insight: sometimes paying with a credit card (higher fee) is smarter than using cash, because the cash can stay invested and earn yield that EXCEEDS the card fee.

Return ONLY valid JSON (no markdown fences):
{
  "shortExplanation": "2-3 friendly sentences explaining the optimization. Make the user feel smart.",
  "savingsVsVisa": <number, USD saved vs 3.5% Visa>,
  "insightLines": [
    {
      "kind": "savings" | "opportunity_cost" | "idle_balance" | "invest_suggestion",
      "headline": "short headline (max 40 chars)",
      "detail": "one sentence detail — for invest_suggestion, ALWAYS recommend specific funds/products by name",
      "deltaUSD": <number, positive = benefit, negative = cost>
    }
  ]
}

STRICT RULES:
- Credit card available limit is NOT money the user owns. NEVER suggest "investing" credit card limits. Credit cards are borrowed money — they have no idle balance to invest.
- Only suggest investing BALANCE sources (USD, USDC, ARS) — these are real funds the user owns.
- deltaUSD must be a number, not a string.

Generate exactly 3 insights:
1. ALWAYS include a "savings" insight showing fee savings vs worst-case Visa
2. If balance sources with yield > 0 were NOT spent (kept invested), add an "opportunity_cost" insight explaining the benefit of keeping them invested. If they WERE spent, explain the tradeoff.
3. ALWAYS include an "invest_suggestion" insight that recommends SPECIFIC investment products by name from the FCI/investment data provided. Tell the user WHERE to put their idle BALANCE money — for ARS recommend specific FCI funds, for USD/USDC recommend keeping them in yield protocols. NEVER mention credit card limits here.`

function buildPrompt(
  merchant: string,
  amount: number,
  optResult: OptimizationAgentResult,
  enrichedSources: EnrichedSource[],
  riskAssessment: RiskAssessment,
  liveRates: LiveRates,
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

  const fciLines = liveRates.fciTopFunds.length > 0
    ? liveRates.fciTopFunds.map(f => `- ${f.name}: ${f.tna}% TNA`).join('\n')
    : '- No live FCI data available'

  return `Payment: $${amount.toFixed(2)} at ${merchant}
Risk: ${riskAssessment.level}
ARS/USD exchange rate: ${liveRates.arsExchangeRate}

Allocation:
${allocLines}

Total fees: $${optResult.totalFees.toFixed(4)}
Total opportunity cost: $${optResult.totalOpportunityCost.toFixed(4)}
Savings vs Visa (3.5%): $${savings.toFixed(4)}

Agent reasoning: ${optResult.reasoning}
Alternative considered: ${optResult.alternativeConsidered}

Source balances after payment:
${sourceLines}

Available investment products in Argentina (live data):
${fciLines}

Generate the explanation and insights. For the invest_suggestion, recommend specific products from the list above by name and rate.`
}

function buildFallbackResult(
  amount: number,
  optResult: OptimizationAgentResult,
  liveRates: LiveRates,
): ExplanationResult {
  const savings = getWorstCaseFee(amount) - optResult.totalFees
  const insightLines: SmartInsight[] = [
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

  // Add investment suggestion from live data
  const bestFund = liveRates.fciTopFunds[0]
  if (bestFund) {
    insightLines.push({
      kind: 'invest_suggestion',
      headline: `Invest in ${bestFund.name}`,
      detail: `Put your idle ARS in ${bestFund.name} at ${bestFund.tna}% TNA to maximize returns.`,
      deltaUSD: 0,
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
  liveRates: LiveRates,
  onEvent: (e: AgentEvent) => void,
): Promise<ExplanationResult> {
  onEvent({ kind: 'agent_start', agentName: 'ExplanationAgent', timestamp: Date.now() })

  const responseText = await callClaude(
    buildPrompt(merchant, amount, optResult, enrichedSources, riskAssessment, liveRates),
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
    result = buildFallbackResult(amount, optResult, liveRates)
  }

  onEvent({ kind: 'agent_done', agentName: 'ExplanationAgent', timestamp: Date.now() })
  return result
}
