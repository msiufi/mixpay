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
