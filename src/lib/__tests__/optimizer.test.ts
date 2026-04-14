import { describe, expect, it } from 'vitest'

import { ARS_RATE, getWorstCaseFee, optimizePayment } from '../optimizer'
import { defaultSources } from '../mock-data'
import type { PaymentSource } from '../../types'

const ownFundsOnly: PaymentSource[] = [
  { id: 'usd',  label: 'USD Cash',  symbol: '$', kind: 'balance', currency: 'USD',  available: 5,     feeRate: 0,     priority: 1 },
  { id: 'usdc', label: 'USDC',      symbol: '$', kind: 'balance', currency: 'USDC', available: 5,     feeRate: 0,     priority: 2 },
  { id: 'ars',  label: 'Pesos ARS', symbol: '₱', kind: 'balance', currency: 'ARS',  available: 14000, feeRate: 0.005, priority: 3 },
]

describe('optimizePayment', () => {
  describe('priority ordering', () => {
    it('uses USD first (priority 1)', () => {
      const result = optimizePayment(3, ownFundsOnly)
      const usdUsage = result.sourceUsages.find(u => u.sourceId === 'usd')
      expect(usdUsage?.amountUSD).toBeCloseTo(3)
    })

    it('uses USDC after USD is exhausted', () => {
      const result = optimizePayment(8, ownFundsOnly)
      const usd  = result.sourceUsages.find(u => u.sourceId === 'usd')
      const usdc = result.sourceUsages.find(u => u.sourceId === 'usdc')
      expect(usd?.amountUSD).toBeCloseTo(5)
      expect(usdc?.amountUSD).toBeCloseTo(3)
    })

    it('converts ARS for the remainder after USD + USDC', () => {
      const result = optimizePayment(20, ownFundsOnly)
      const ars = result.sourceUsages.find(u => u.sourceId === 'ars')
      expect(ars?.amountUSD).toBeCloseTo(10)
      expect(ars?.amountOriginal).toBeCloseTo(14000)
    })
  })

  describe('credit card fallback', () => {
    // Use a neutral date where no card is in closing-soon or new-period
    const neutralDate = new Date(2026, 3, 1) // April 1

    it('uses Visa when own funds are insufficient (priority 4)', () => {
      const result = optimizePayment(35, defaultSources, neutralDate)
      const visa = result.sourceUsages.find(u => u.sourceId === 'visa')
      expect(visa).toBeDefined()
      expect(visa!.amountUSD).toBeCloseTo(15)
    })

    it('charges the correct fee rate for Visa (3.5%)', () => {
      const result = optimizePayment(35, defaultSources, neutralDate)
      const visa = result.sourceUsages.find(u => u.sourceId === 'visa')
      expect(visa?.fee).toBeCloseTo(visa!.amountUSD * 0.035)
    })
  })

  describe('success flag', () => {
    it('returns success: true when fully covered', () => {
      const result = optimizePayment(20, ownFundsOnly)
      expect(result.success).toBe(true)
    })

    it('returns success: false when funds are insufficient (no cards)', () => {
      const result = optimizePayment(100, ownFundsOnly)
      expect(result.success).toBe(false)
    })

    it('returns success: true for large amounts when credit cards are available', () => {
      const result = optimizePayment(400, defaultSources, new Date(2026, 3, 1))
      expect(result.success).toBe(true)
    })

    it('returns success: false when even cards cannot cover the amount', () => {
      const result = optimizePayment(1000, defaultSources, new Date(2026, 3, 1))
      expect(result.success).toBe(false)
    })
  })

  describe('totals', () => {
    it('totalUSD equals the requested amount on success', () => {
      const result = optimizePayment(20, ownFundsOnly)
      expect(result.totalUSD).toBeCloseTo(20)
    })

    it('totalFees is the sum of all source fees', () => {
      const result = optimizePayment(20, ownFundsOnly)
      const sumFees = result.sourceUsages.reduce((s, u) => s + u.fee, 0)
      expect(result.totalFees).toBeCloseTo(sumFees)
    })

    it('ARS fee is 0.5% of ARS amount in USD', () => {
      const result = optimizePayment(20, ownFundsOnly)
      const ars = result.sourceUsages.find(u => u.sourceId === 'ars')
      expect(ars?.fee).toBeCloseTo(ars!.amountUSD * 0.005)
    })
  })

  describe('ARS conversion', () => {
    it('exports the expected ARS rate constant', () => {
      expect(ARS_RATE).toBe(1400)
    })

    it('amountOriginal for ARS is in peso units', () => {
      const result = optimizePayment(20, ownFundsOnly)
      const ars = result.sourceUsages.find(u => u.sourceId === 'ars')
      expect(ars?.amountOriginal).toBeCloseTo(ars!.amountUSD * ARS_RATE)
    })
  })

  describe('getWorstCaseFee', () => {
    it('returns 3.5% of the amount', () => {
      expect(getWorstCaseFee(20)).toBeCloseTo(0.70)
      expect(getWorstCaseFee(100)).toBeCloseTo(3.50)
    })
  })

  describe('billing cycle integration', () => {
    const cardSources: PaymentSource[] = [
      { id: 'usd', label: 'USD', symbol: '$', kind: 'balance', currency: 'USD', available: 5, feeRate: 0, priority: 1 },
      { id: 'card-closing', label: 'Visa Closing', symbol: '$', kind: 'credit_card', currency: 'USD', available: 500, feeRate: 0.035, priority: 4, bank: 'Test', network: 'visa', closingDay: 15, dueDay: 5, creditLimit: 500 },
      { id: 'card-newperiod', label: 'MC NewPeriod', symbol: '$', kind: 'credit_card', currency: 'USD', available: 300, feeRate: 0.025, priority: 5, bank: 'Test', network: 'mastercard', closingDay: 10, dueDay: 28, creditLimit: 300 },
    ]

    it('prefers the card in new-period over closing-soon card', () => {
      // April 13: card-closing closes in 2 days (penalized → priority 6)
      //           card-newperiod closed on 10 (favored → priority 4)
      const today = new Date(2026, 3, 13)
      const result = optimizePayment(10, cardSources, today)
      const usages = result.sourceUsages.map(u => u.sourceId)
      expect(usages).toContain('usd')
      expect(usages).toContain('card-newperiod')
      expect(usages).not.toContain('card-closing')
    })
  })
})
