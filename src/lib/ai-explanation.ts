import type { OptimizationResult } from '../types'
import { getWorstCaseFee } from './optimizer'
import { callClaude } from './claude-client'

function buildPrompt(
  merchant: string,
  amount: number,
  result: OptimizationResult,
): string {
  const savings = (getWorstCaseFee(amount) - result.totalFees).toFixed(2)
  const usageLines = result.sourceUsages
    .map(u => {
      if (u.currency === 'ARS') {
        return `  - ${u.label}: ${u.amountOriginal.toLocaleString()} ARS ≈ $${u.amountUSD.toFixed(2)} (fee: $${u.fee.toFixed(4)})`
      }
      return `  - ${u.label}: $${u.amountUSD.toFixed(2)} (fee: $${u.fee.toFixed(4)})`
    })
    .join('\n')

  return `You are MixPay's AI payment advisor. Explain in 2-3 friendly, concise sentences why this payment combination was the best choice.

Payment: $${amount.toFixed(2)} at ${merchant}
Sources used:
${usageLines}
Total fees: $${result.totalFees.toFixed(4)} (saved $${savings} vs. paying with a 3.5% Visa)

Be conversational, highlight the savings, and make the user feel smart for using MixPay. Do not use markdown formatting.`
}

function buildExplanation(
  merchant: string,
  amount: number,
  result: OptimizationResult,
): string {
  const parts: string[] = [
    `MixPay optimized your $${amount.toFixed(2)} payment at ${merchant}.`,
  ]

  const ownFunds = result.sourceUsages.filter(u => u.feeRate === 0)
  const arsUsage = result.sourceUsages.find(u => u.currency === 'ARS')
  const cardUsage = result.sourceUsages.find(u => u.feeRate > 0.01)

  if (ownFunds.length > 0) {
    const labels = ownFunds.map(u => u.label).join(' and ')
    parts.push(`It used your ${labels} first to avoid conversion fees.`)
  }

  if (arsUsage) {
    parts.push(
      `${arsUsage.amountOriginal.toLocaleString()} ARS (≈$${arsUsage.amountUSD.toFixed(2)}) covered part of the payment at a minimal 0.5% fee.`,
    )
  }

  if (cardUsage) {
    parts.push(
      `The remaining $${cardUsage.amountUSD.toFixed(2)} used your ${cardUsage.label} as a last resort.`,
    )
  }

  const savings = getWorstCaseFee(amount) - result.totalFees
  if (savings > 0.001) {
    parts.push(`You saved $${savings.toFixed(2)} compared to paying with a traditional credit card.`)
  }

  return parts.join(' ')
}

export async function getAIExplanation(
  merchant: string,
  amount: number,
  result: OptimizationResult,
): Promise<string> {
  const prompt = buildPrompt(merchant, amount, result)
  const claudeResponse = await callClaude(prompt, { maxTokens: 300 })
  if (claudeResponse) return claudeResponse

  // Fallback: simulate API latency then return template text
  await new Promise(resolve => setTimeout(resolve, 600))
  return buildExplanation(merchant, amount, result)
}
