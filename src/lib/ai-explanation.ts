import type { OptimizationResult } from '../types'

function buildExplanation(
  merchant: string,
  amount: number,
  result: OptimizationResult,
) {
  const parts: string[] = [
    `MixPay optimized your ${amount.toFixed(2)} USD payment at ${merchant}.`,
  ]

  if (result.usdUsed > 0 && result.usdcUsed > 0) {
    parts.push(
      `It used both USD and USDC first to avoid ARS conversion fees where possible.`,
    )
  } else if (result.usdUsed > 0) {
    parts.push(`It used your USD balance first to cover the payment.`)
  } else if (result.usdcUsed > 0) {
    parts.push(`It used your USDC balance first to preserve your USD funds.`)
  }

  if (result.arsUsed > 0) {
    parts.push(
      `The remaining ${result.arsUsedUSD.toFixed(2)} USD came from ${result.arsUsed.toFixed(2)} ARS at ${result.arsRate} ARS/USD.`,
    )
  }

  parts.push(`Strategy: ${result.strategy}.`)
  parts.push(`Estimated fees: ${result.fees.toFixed(4)} USD.`)

  return parts.join(' ')
}

export async function getAIExplanation(
  merchant: string,
  amount: number,
  result: OptimizationResult,
) {
  await new Promise((resolve) => setTimeout(resolve, 600))

  return buildExplanation(merchant, amount, result)
}

export { buildExplanation }
