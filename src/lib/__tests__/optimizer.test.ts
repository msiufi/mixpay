import { describe, expect, it } from 'vitest'

import { ARS_RATE, optimizePayment } from '../optimizer'

describe('optimizePayment', () => {
  const balances = {
    usd: 5,
    usdc: 5,
    ars: 14000,
  }

  describe('minimize-fees', () => {
    it('uses USD first', () => {
      const result = optimizePayment(20, balances, 'minimize-fees')

      expect(result.usdUsed).toBe(5)
    })

    it('uses USDC second', () => {
      const result = optimizePayment(20, balances, 'minimize-fees')

      expect(result.usdcUsed).toBe(5)
    })

    it('uses ARS for the remainder', () => {
      const result = optimizePayment(20, balances, 'minimize-fees')

      expect(result.arsUsedUSD).toBeCloseTo(10)
    })

    it('marks the optimization as successful for a 20 USD payment', () => {
      const result = optimizePayment(20, balances, 'minimize-fees')

      expect(result.success).toBe(true)
    })

    it('marks the optimization as unsuccessful for a 100 USD payment', () => {
      const result = optimizePayment(100, balances, 'minimize-fees')

      expect(result.success).toBe(false)
    })

    it('returns the total optimized amount in USD', () => {
      const result = optimizePayment(20, balances, 'minimize-fees')

      expect(result.totalUSD).toBeCloseTo(20)
    })

    it('calculates ARS fees from the converted amount', () => {
      const result = optimizePayment(20, balances, 'minimize-fees')

      expect(result.fees).toBeCloseTo(result.arsUsedUSD * 0.005)
    })
  })

  describe('preserve-usd', () => {
    it('uses USDC first for an 8 USD payment', () => {
      const result = optimizePayment(8, balances, 'preserve-usd')

      expect(result.usdcUsed).toBe(5)
    })

    it('preserves USD while ARS covers the rest', () => {
      const result = optimizePayment(8, balances, 'preserve-usd')

      expect(result.usdUsed).toBe(0)
    })

    it('falls back to USD as a last resort', () => {
      const smallBalances = {
        usd: 10,
        usdc: 0,
        ars: 0,
      }
      const result = optimizePayment(8, smallBalances, 'preserve-usd')

      expect(result.usdUsed).toBe(8)
    })
  })

  describe('ARS rate', () => {
    it('exports the expected ARS rate constant', () => {
      expect(ARS_RATE).toBe(1400)
    })

    it('returns the ARS rate in the optimization result', () => {
      const result = optimizePayment(20, balances, 'minimize-fees')

      expect(result.arsRate).toBe(ARS_RATE)
    })
  })
})
