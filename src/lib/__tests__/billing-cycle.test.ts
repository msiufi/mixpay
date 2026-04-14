import { describe, expect, it } from 'vitest'

import {
  daysUntilDay,
  getCycleStatus,
  getAdjustedSources,
} from '../billing-cycle'
import type { CycleStatus } from '../billing-cycle'
import type { PaymentSource } from '../../types'

// ---------------------------------------------------------------------------
// daysUntilDay
// ---------------------------------------------------------------------------
describe('daysUntilDay', () => {
  it('returns days remaining when target day is later in the same month', () => {
    // April 10, target day 15 → 5 days
    const today = new Date(2026, 3, 10) // month is 0-indexed
    expect(daysUntilDay(15, today)).toBe(5)
  })

  it('wraps to next month when target day has already passed', () => {
    // April 20, target day 15 → May 15 = 25 days
    const today = new Date(2026, 3, 20)
    expect(daysUntilDay(15, today)).toBe(25)
  })

  it('returns 0 when today IS the target day', () => {
    // April 15, target day 15 → 0
    const today = new Date(2026, 3, 15)
    expect(daysUntilDay(15, today)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// getCycleStatus  (card closes on day 15, due on day 5)
// ---------------------------------------------------------------------------
describe('getCycleStatus', () => {
  const CLOSING_DAY = 15
  const DUE_DAY = 5

  it('returns closing-soon when 2 days remain until closing day', () => {
    // April 13: 2 days to close (15th), due May 5
    const today = new Date(2026, 3, 13)
    const result: CycleStatus = getCycleStatus(CLOSING_DAY, DUE_DAY, today)
    expect(result.status).toBe('closing-soon')
    expect(result.daysToClose).toBe(2)
  })

  it('returns new-period when after closing day and before due day', () => {
    // April 20: closing was April 15, due is May 5
    const today = new Date(2026, 3, 20)
    const result: CycleStatus = getCycleStatus(CLOSING_DAY, DUE_DAY, today)
    expect(result.status).toBe('new-period')
  })

  it('returns due-soon when 2 days remain until due day', () => {
    // May 3: due is May 5, closing is May 15
    const today = new Date(2026, 4, 3)
    const result: CycleStatus = getCycleStatus(CLOSING_DAY, DUE_DAY, today)
    expect(result.status).toBe('due-soon')
    expect(result.daysToDue).toBe(2)
  })

  it('returns normal when 10 days remain until closing day', () => {
    // April 5: 10 days to close (15th)
    const today = new Date(2026, 3, 5)
    const result: CycleStatus = getCycleStatus(CLOSING_DAY, DUE_DAY, today)
    expect(result.status).toBe('normal')
  })

  it('always populates daysToClose and daysToDue fields', () => {
    const today = new Date(2026, 3, 5)
    const result: CycleStatus = getCycleStatus(CLOSING_DAY, DUE_DAY, today)
    expect(typeof result.daysToClose).toBe('number')
    expect(typeof result.daysToDue).toBe('number')
  })

  it('due-soon takes priority over closing-soon', () => {
    // If both could apply simultaneously, due-soon wins.
    // Construct a degenerate case: due is 2 days away AND closing is 2 days away.
    // Use due=16, close=16, today=April 14 → both 2 days away → due-soon wins
    const today = new Date(2026, 3, 14)
    const result = getCycleStatus(16, 16, today)
    expect(result.status).toBe('due-soon')
  })
})

// ---------------------------------------------------------------------------
// getAdjustedSources
// ---------------------------------------------------------------------------
describe('getAdjustedSources', () => {
  // Helper to build a minimal balance source
  const balanceSource = (priority: number): PaymentSource => ({
    id: 'usd',
    label: 'USD',
    symbol: '$',
    kind: 'balance',
    currency: 'USD',
    available: 100,
    feeRate: 0,
    priority,
  })

  // Helper to build a credit card with billing cycle days
  const cardSource = (
    priority: number,
    closingDay: number,
    dueDay: number
  ): PaymentSource => ({
    id: `card-${closingDay}-${dueDay}`,
    label: 'Visa',
    symbol: 'CC',
    kind: 'credit_card',
    currency: 'USD',
    available: 1000,
    feeRate: 0.035,
    priority,
    closingDay,
    dueDay,
  })

  // Helper for a card WITHOUT billing days
  const cardNoDate = (priority: number): PaymentSource => ({
    id: 'card-nodate',
    label: 'Mastercard',
    symbol: 'CC',
    kind: 'credit_card',
    currency: 'USD',
    available: 1000,
    feeRate: 0.035,
    priority,
  })

  it('does not adjust balance sources', () => {
    // April 13: closing-soon for a card closing on 15
    const today = new Date(2026, 3, 13)
    const source = balanceSource(1)
    const [result] = getAdjustedSources([source], today)
    expect(result.priority).toBe(1)
  })

  it('increases priority by 2 for a closing-soon card (penalise)', () => {
    // April 13: 2 days to close (15th) → closing-soon
    const today = new Date(2026, 3, 13)
    const source = cardSource(3, 15, 5)
    const [result] = getAdjustedSources([source], today)
    expect(result.priority).toBe(5) // 3 + 2
  })

  it('decreases priority by 1 for a new-period card (favour)', () => {
    // April 20: closing was 15th, due May 5 → new-period
    const today = new Date(2026, 3, 20)
    const source = cardSource(3, 15, 5)
    const [result] = getAdjustedSources([source], today)
    expect(result.priority).toBe(2) // 3 - 1
  })

  it('leaves priority unchanged for a normal card', () => {
    // April 5: 10 days to close → normal
    const today = new Date(2026, 3, 5)
    const source = cardSource(3, 15, 5)
    const [result] = getAdjustedSources([source], today)
    expect(result.priority).toBe(3)
  })

  it('does not adjust cards that lack closingDay / dueDay', () => {
    const today = new Date(2026, 3, 13)
    const source = cardNoDate(3)
    const [result] = getAdjustedSources([source], today)
    expect(result.priority).toBe(3)
  })

  it('does not mutate the original sources array or objects', () => {
    const today = new Date(2026, 3, 13) // closing-soon for close=15
    const source = cardSource(3, 15, 5)
    const originalPriority = source.priority

    getAdjustedSources([source], today)

    expect(source.priority).toBe(originalPriority)
  })

  it('returns a new array instance', () => {
    const today = new Date(2026, 3, 5)
    const sources = [balanceSource(1)]
    const result = getAdjustedSources(sources, today)
    expect(result).not.toBe(sources)
  })
})
