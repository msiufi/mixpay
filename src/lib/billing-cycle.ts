import type { PaymentSource } from '../types'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CycleStatusType = 'closing-soon' | 'due-soon' | 'new-period' | 'normal'

export interface CycleStatus {
  status: CycleStatusType
  daysToClose: number
  daysToDue: number
}

// ---------------------------------------------------------------------------
// daysUntilDay
// ---------------------------------------------------------------------------

/**
 * Returns the number of calendar days from `today` until the next occurrence
 * of the given day-of-month (1–28).
 *
 * - Returns 0 when today IS that day.
 * - When the day has already passed this month the count wraps to next month.
 */
export function daysUntilDay(day: number, today: Date): number {
  const todayDay = today.getDate()

  if (todayDay === day) {
    return 0
  }

  if (day > todayDay) {
    // Target is still ahead in the current month
    return day - todayDay
  }

  // Target has passed – compute days to the same day next month
  const nextOccurrence = new Date(today.getFullYear(), today.getMonth() + 1, day)
  const msPerDay = 24 * 60 * 60 * 1000
  return Math.round((nextOccurrence.getTime() - today.getTime()) / msPerDay)
}

// ---------------------------------------------------------------------------
// getCycleStatus
// ---------------------------------------------------------------------------

/**
 * Returns the billing-cycle status for a credit card given its closing day,
 * due day and today's date.
 *
 * Priority: due-soon > closing-soon > new-period > normal
 */
export function getCycleStatus(
  closingDay: number,
  dueDay: number,
  today: Date
): CycleStatus {
  const daysToClose = daysUntilDay(closingDay, today)
  const daysToDue = daysUntilDay(dueDay, today)

  let status: CycleStatusType

  if (daysToDue <= 3 && daysToDue > 0) {
    status = 'due-soon'
  } else if (daysToClose <= 3 && daysToClose > 0) {
    status = 'closing-soon'
  } else if (daysToDue > 3 && daysToDue < daysToClose) {
    // After the closing day but before the due day: purchases enter the NEXT
    // statement.  This window is identified by the due date falling sooner than
    // the next closing date (due has wrapped to next month, closing is still
    // weeks away in the current month).
    status = 'new-period'
  } else {
    status = 'normal'
  }

  return { status, daysToClose, daysToDue }
}

// ---------------------------------------------------------------------------
// getAdjustedSources
// ---------------------------------------------------------------------------

/**
 * Returns a shallow copy of `sources` with credit-card priorities adjusted
 * based on the current billing-cycle status:
 *
 *   closing-soon → priority + 2  (penalise: purchase enters current statement)
 *   new-period   → priority - 1  (favour: purchase goes to next statement)
 *   everything else → no change
 *
 * Balance sources and cards without closingDay/dueDay are never adjusted.
 * The original array and objects are never mutated.
 */
export function getAdjustedSources(
  sources: PaymentSource[],
  today: Date
): PaymentSource[] {
  return sources.map((source) => {
    if (
      source.kind !== 'credit_card' ||
      source.closingDay == null ||
      source.dueDay == null
    ) {
      return source
    }

    const { status } = getCycleStatus(source.closingDay, source.dueDay, today)

    if (status === 'closing-soon') {
      return { ...source, priority: source.priority + 2 }
    }

    if (status === 'new-period') {
      return { ...source, priority: source.priority - 1 }
    }

    return source
  })
}
