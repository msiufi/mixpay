export interface Balances {
  usd: number
  usdc: number
  ars: number
}

export type PaymentStrategy = 'minimize-fees' | 'preserve-usd'

export interface OptimizationResult {
  usdUsed: number
  usdcUsed: number
  arsUsed: number
  arsUsedUSD: number
  totalUSD: number
  fees: number
  arsRate: number
  strategy: PaymentStrategy
  success: boolean
}

export interface Transaction {
  id: string
  merchant: string
  amount: number
  date: string
  result: OptimizationResult
}

export interface Card {
  last4: string
  network: string
  label: string
}
