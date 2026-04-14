import type { Card, PaymentSource, Transaction } from '../types'

import { optimizePayment } from './optimizer'

export const defaultSources: PaymentSource[] = [
  { id: 'usd',        label: 'USD Cash',    symbol: '$', kind: 'balance',     currency: 'USD',  available: 5,     feeRate: 0,     priority: 1 },
  { id: 'usdc',       label: 'USDC',        symbol: '$', kind: 'balance',     currency: 'USDC', available: 5,     feeRate: 0,     priority: 2 },
  { id: 'ars',        label: 'Pesos ARS',   symbol: '₱', kind: 'balance',     currency: 'ARS',  available: 14000, feeRate: 0.005, priority: 3 },
  { id: 'visa',       label: 'Visa Default', symbol: '$', kind: 'credit_card', currency: 'USD',  available: 500,   feeRate: 0.035, priority: 4, bank: 'Default', network: 'visa',       creditLimit: 500, closingDay: 15, dueDay: 5,  last4: '4521' },
  { id: 'mastercard', label: 'Mastercard Default', symbol: '$', kind: 'credit_card', currency: 'USD',  available: 300,   feeRate: 0.025, priority: 5, bank: 'Default', network: 'mastercard', creditLimit: 300, closingDay: 22, dueDay: 12, last4: '8832' },
]

export const defaultBalances: PaymentSource[] = defaultSources.filter(s => s.kind === 'balance')
export const defaultCards: PaymentSource[] = defaultSources.filter(s => s.kind === 'credit_card')

export const mockCard: Card = {
  last4: '1234',
  network: 'Visa',
  label: 'MixPay Visa',
}

// Historical snapshots — each transaction is independent (not sequential depletion)
export const mockTransactions: Transaction[] = [
  { id: 'tx-001', merchant: 'Nike Store',   amount: 20, date: '2026-04-08', result: optimizePayment(20, defaultSources) },
  { id: 'tx-002', merchant: 'Spotify',      amount: 10, date: '2026-04-07', result: optimizePayment(10, defaultSources) },
  { id: 'tx-003', merchant: 'Amazon',       amount: 35, date: '2026-04-05', result: optimizePayment(35, defaultSources) },
  { id: 'tx-004', merchant: 'Uber',         amount: 8,  date: '2026-04-03', result: optimizePayment(8,  defaultSources) },
  { id: 'tx-005', merchant: 'MercadoLibre', amount: 15, date: '2026-04-01', result: optimizePayment(15, defaultSources) },
]
