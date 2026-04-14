export type PaymentSourceKind = 'balance' | 'credit_card'

export interface PaymentSource {
  id: string
  label: string
  symbol: string
  kind: PaymentSourceKind
  currency: string
  available: number
  feeRate: number
  priority: number
  yieldRate?: number  // annual yield if kept invested (e.g. 0.05 = 5% APY), optional for backward compat
  // Credit card fields (only when kind === 'credit_card')
  bank?: string
  network?: string
  customName?: string
  creditLimit?: number
  closingDay?: number
  dueDay?: number
  last4?: string
}

export interface SourceUsage {
  sourceId: string
  label: string
  symbol: string
  currency: string
  amountOriginal: number
  amountUSD: number
  fee: number
  feeRate: number
}

export interface OptimizationResult {
  sourceUsages: SourceUsage[]
  totalUSD: number
  totalFees: number
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
