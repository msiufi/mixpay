import type { OptimizationResult, PaymentSource, SourceUsage } from '../types'
import { getAdjustedSources } from './billing-cycle'

export const ARS_RATE = 1400

function roundAmount(value: number) {
  return parseFloat(value.toFixed(10))
}

export function optimizePayment(
  amountUSD: number,
  sources: PaymentSource[],
  today: Date = new Date(),
): OptimizationResult {
  let remaining = roundAmount(amountUSD)
  const sourceUsages: SourceUsage[] = []

  const adjusted = getAdjustedSources(sources, today)
  const sorted = [...adjusted].sort((a, b) => a.priority - b.priority)

  for (const source of sorted) {
    if (remaining < 0.001) break

    let amountUSDFromSource: number
    let amountOriginal: number

    if (source.currency === 'ARS') {
      const availableUSD = roundAmount(source.available / ARS_RATE)
      // Max merchant amount considering fee must also come from this source
      const maxMerchantUSD = roundAmount(availableUSD / (1 + source.feeRate))
      const usedUSD = Math.min(remaining, maxMerchantUSD)
      if (usedUSD <= 0) continue
      amountUSDFromSource = roundAmount(usedUSD)
      // amountOriginal = total ARS debited (merchant amount + fee)
      amountOriginal = roundAmount(usedUSD * (1 + source.feeRate) * ARS_RATE)
    } else {
      const maxMerchantUSD = roundAmount(source.available / (1 + source.feeRate))
      const used = Math.min(remaining, maxMerchantUSD)
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
