import type { Balances, OptimizationResult, PaymentStrategy } from '../types'

export const ARS_RATE = 1400

function roundAmount(value: number) {
  return parseFloat(value.toFixed(10))
}

export function optimizePayment(
  amountUSD: number,
  balances: Balances,
  strategy: PaymentStrategy = 'minimize-fees',
): OptimizationResult {
  let remaining = roundAmount(amountUSD)
  let usdUsed = 0
  let usdcUsed = 0
  let arsUsedUSD = 0
  let arsUsed = 0

  const useUSD = () => {
    const used = Math.min(remaining, balances.usd)
    usdUsed = roundAmount(used)
    remaining = roundAmount(remaining - usdUsed)
  }

  const useUSDC = () => {
    const used = Math.min(remaining, balances.usdc)
    usdcUsed = roundAmount(used)
    remaining = roundAmount(remaining - usdcUsed)
  }

  const useARS = () => {
    const arsBalanceUSD = roundAmount(balances.ars / ARS_RATE)
    const usedUSD = Math.min(remaining, arsBalanceUSD)
    arsUsedUSD = roundAmount(usedUSD)
    arsUsed = roundAmount(arsUsedUSD * ARS_RATE)
    remaining = roundAmount(remaining - arsUsedUSD)
  }

  if (strategy === 'preserve-usd') {
    useUSDC()
    useARS()
    useUSD()
  } else {
    useUSD()
    useUSDC()
    useARS()
  }

  const totalUSD = roundAmount(usdUsed + usdcUsed + arsUsedUSD)
  const fees = roundAmount(arsUsedUSD * 0.005)

  return {
    usdUsed,
    usdcUsed,
    arsUsed,
    arsUsedUSD,
    totalUSD,
    fees,
    arsRate: ARS_RATE,
    strategy,
    success: remaining < 0.001,
  }
}
