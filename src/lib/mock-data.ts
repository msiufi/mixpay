import type { Balances, Card, Transaction } from '../types'

import { optimizePayment } from './optimizer'

export const mockBalances: Balances = {
  usd: 5,
  usdc: 5,
  ars: 14000,
}

export const mockCard: Card = {
  last4: '1234',
  network: 'Visa',
  label: 'MixPay Visa',
}

export const mockTransactions: Transaction[] = [
  {
    id: 'tx-001',
    merchant: 'Nike Store',
    amount: 20,
    date: '2026-04-08',
    result: optimizePayment(20, mockBalances, 'minimize-fees'),
  },
  {
    id: 'tx-002',
    merchant: 'Spotify',
    amount: 10,
    date: '2026-04-07',
    result: optimizePayment(10, mockBalances, 'minimize-fees'),
  },
  {
    id: 'tx-003',
    merchant: 'Amazon',
    amount: 35,
    date: '2026-04-05',
    result: optimizePayment(35, mockBalances, 'preserve-usd'),
  },
]
