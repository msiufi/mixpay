// Explanation Agent — generates smart investment insights with strict consistency rules.

import { callClaude } from '../claude-client'
import { EXPLANATION_MODEL, ARG_MONTHLY_INFLATION, WORST_CASE_FEE_RATE } from '../config'
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

const SYSTEM_PROMPT = `You are MixPay's financial advisor. Generate EXACTLY 3 investment insights following these strict rules.

## RULES YOU MUST ALWAYS FOLLOW

1. NEVER invent numbers. Only use the exact numbers provided in the data below.
2. Compare yields against the CORRECT inflation for each currency:
   - ARS yields → compare against Argentine inflation (~${(ARG_MONTHLY_INFLATION * 100).toFixed(1)}%/mo, ~${(ARG_MONTHLY_INFLATION * 12 * 100).toFixed(0)}% annualized)
   - USD yields → compare against US inflation (~3% annualized). USD is a hard currency, do NOT compare it to Argentine inflation.
   - USDC yields → compare against US inflation (~3% annualized). USDC is pegged to USD.
3. ALWAYS mention specific FCI/investment product names and their TNA from the data provided.
4. Credit card limits are NOT investable money. Never suggest "investing" credit card available balance.
5. Keep each insight to 1-2 sentences max.
6. deltaUSD must always be a number (not a string).
7. NEVER compare USD or USDC to Argentine inflation — they are different currencies with different risk profiles.

## INSIGHT STRUCTURE (exactly 3, in this order)

### Insight 1: "savings" — Fee comparison
- Compare total fees paid vs worst case (${(WORST_CASE_FEE_RATE * 100).toFixed(1)}% Visa)
- Show dollar amount saved
- deltaUSD = positive number (savings)

### Insight 2: "opportunity_cost" — Inflation-adjusted yield analysis
- If balance sources (ARS, USD, USDC) were kept invested: explain the benefit vs inflation
- Calculate: nominal yield - inflation = real yield. Example: "Your ARS earns 29% TNA, but with ~35% annual inflation, the real yield is -6%. Consider higher-yield alternatives."
- If balance sources were spent: show the monthly opportunity cost lost
- deltaUSD = positive if kept invested (benefit), negative if spent (cost)

### Insight 3: "invest_suggestion" — Specific investment recommendation
- Recommend the TOP 1-2 specific products by name and TNA from the FCI data
- Compare their yield to inflation: "X at Y% TNA beats inflation (~35% annual) by Z points"
- Only suggest for BALANCE sources (ARS, USD, USDC), never for credit cards
- deltaUSD = estimated monthly gain from the recommendation

## OUTPUT FORMAT

Return ONLY valid JSON (no markdown fences):
{
  "shortExplanation": "2-3 friendly sentences about the optimization. Make the user feel smart.",
  "savingsVsVisa": <number>,
  "insightLines": [
    { "kind": "savings", "headline": "max 40 chars", "detail": "1-2 sentences", "deltaUSD": <number> },
    { "kind": "opportunity_cost", "headline": "max 40 chars", "detail": "1-2 sentences with inflation comparison", "deltaUSD": <number> },
    { "kind": "invest_suggestion", "headline": "max 40 chars", "detail": "1-2 sentences with specific product names and TNA vs inflation", "deltaUSD": <number> }
  ]
}`

function buildPrompt(
  merchant: string,
  amount: number,
  optResult: OptimizationAgentResult,
  enrichedSources: EnrichedSource[],
  _riskAssessment: RiskAssessment,
  liveRates: LiveRates,
): string {
  const worstFee = getWorstCaseFee(amount)
  const savings = worstFee - optResult.totalFees
  const annualInflation = ARG_MONTHLY_INFLATION * 12

  const allocLines = optResult.allocations.map(a =>
    `- ${a.label}: $${a.amountUSD.toFixed(2)} (fee: $${a.fee.toFixed(2)}, opportunity cost: $${a.opportunityCostUSD.toFixed(2)})`
  ).join('\n')

  const US_INFLATION = 0.03
  const sourceLines = enrichedSources.map(s => {
    const used = optResult.allocations.find(a => a.sourceId === s.id)
    const remaining = used ? s.available - used.amountOriginal : s.available
    const inflation = s.currency === 'ARS' ? annualInflation : US_INFLATION
    const inflationLabel = s.currency === 'ARS' ? 'Argentine' : 'US'
    const realYield = s.effectiveYieldRate - inflation
    return `- ${s.label} (${s.kind}, ${s.currency}): yield ${(s.effectiveYieldRate * 100).toFixed(1)}%, real yield vs ${inflationLabel} inflation (${(inflation * 100).toFixed(0)}%): ${realYield > 0 ? '+' : ''}${(realYield * 100).toFixed(1)}%, remaining: ${remaining.toFixed(2)} ${s.currency}`
  }).join('\n')

  const fciLines = liveRates.fciTopFunds.map(f => {
    const realYield = (f.tna / 100) - annualInflation
    return `- ${f.name}: ${f.tna}% TNA (real yield vs ${(annualInflation * 100).toFixed(0)}% inflation: ${(realYield * 100).toFixed(1)}%)`
  }).join('\n')

  return `Payment: $${amount.toFixed(2)} at ${merchant}
Argentine monthly inflation: ${(ARG_MONTHLY_INFLATION * 100).toFixed(1)}% (~${(annualInflation * 100).toFixed(0)}% annualized)
ARS/USD rate: ${liveRates.arsExchangeRate}

Allocation:
${allocLines}

Total fees: $${optResult.totalFees.toFixed(2)}
Savings vs Visa (${(WORST_CASE_FEE_RATE * 100).toFixed(1)}%): $${savings.toFixed(2)}

Source balances after payment:
${sourceLines}

Available investment products (live data):
${fciLines}

Generate exactly 3 insights following the rules.`
}

function buildFallbackResult(
  amount: number,
  optResult: OptimizationAgentResult,
  liveRates: LiveRates,
): ExplanationResult {
  const savings = getWorstCaseFee(amount) - optResult.totalFees
  const bestFund = liveRates.fciTopFunds[0]
  const annualInflation = ARG_MONTHLY_INFLATION * 12

  const insightLines: SmartInsight[] = [
    {
      kind: 'savings',
      headline: `Saved $${savings.toFixed(2)} vs Visa`,
      detail: `MixPay optimized your sources to avoid the ${(WORST_CASE_FEE_RATE * 100).toFixed(1)}% Visa fee.`,
      deltaUSD: savings,
    },
    {
      kind: 'opportunity_cost',
      headline: 'Yield vs inflation considered',
      detail: `With ~${(annualInflation * 100).toFixed(0)}% annual inflation, keeping high-yield balances invested was the right call.`,
      deltaUSD: optResult.totalOpportunityCost > 0 ? -optResult.totalOpportunityCost : 0,
    },
  ]

  if (bestFund) {
    const realYield = (bestFund.tna / 100) - annualInflation
    insightLines.push({
      kind: 'invest_suggestion',
      headline: `Invest in ${bestFund.name}`,
      detail: `${bestFund.name} at ${bestFund.tna}% TNA gives ${(realYield * 100).toFixed(1)}% real yield above inflation.`,
      deltaUSD: 0,
    })
  }

  return {
    shortExplanation: `MixPay saved you $${savings.toFixed(2)} vs a traditional Visa by optimizing across your payment sources.`,
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
      model: EXPLANATION_MODEL,
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
