import type { OptimizationResult, PaymentSource, SourceUsage } from '../types'

export const ARS_RATE = 1400

function roundAmount(value: number) {
  return parseFloat(value.toFixed(10))
}

export function optimizePayment(
  amountUSD: number,
  sources: PaymentSource[],
): OptimizationResult {
  let remaining = roundAmount(amountUSD)
  const sourceUsages: SourceUsage[] = []

  const sorted = [...sources].sort((a, b) => a.priority - b.priority)

  for (const source of sorted) {
    if (remaining < 0.001) break

    let amountUSDFromSource: number
    let amountOriginal: number

    if (source.currency === 'ARS') {
      const availableUSD = roundAmount(source.available / ARS_RATE)
      const usedUSD = Math.min(remaining, availableUSD)
      if (usedUSD <= 0) continue
      amountUSDFromSource = roundAmount(usedUSD)
      amountOriginal = roundAmount(usedUSD * ARS_RATE)
    } else {
      const used = Math.min(remaining, source.available)
      if (used <= 0) continue
      amountUSDFromSource = roundAmount(used)
      amountOriginal = amountUSDFromSource
    }

    const fee = roundAmount(amountUSDFromSource * source.feeRate)

    sourceUsages.push({
      sourceId: source.id,
      label: source.label,
      symbol: source.symbol,
      currency: source.currency,
      amountOriginal,
      amountUSD: amountUSDFromSource,
      fee,
      feeRate: source.feeRate,
    })

    remaining = roundAmount(remaining - amountUSDFromSource)
  }

  const totalUSD = roundAmount(sourceUsages.reduce((sum, u) => sum + u.amountUSD, 0))
  const totalFees = roundAmount(sourceUsages.reduce((sum, u) => sum + u.fee, 0))

  return {
    sourceUsages,
    totalUSD,
    totalFees,
    success: remaining < 0.001,
  }
}

/** Fee that would be charged if the full amount was paid with a Visa (3.5%). */
export function getWorstCaseFee(amountUSD: number): number {
  return roundAmount(amountUSD * 0.035)
}
