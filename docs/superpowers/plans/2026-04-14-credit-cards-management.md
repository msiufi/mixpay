# Credit Cards Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add dynamic credit card management with billing cycle awareness to MixPay's payment optimization.

**Architecture:** Extend `PaymentSource` with optional credit card fields (bank, network, closingDay, dueDay, creditLimit). Cards persist in localStorage. A new `billing-cycle.ts` module provides pure functions for cycle status and priority adjustment. The optimizer calls `getAdjustedSources()` before sorting. Dashboard shows cards as mini physical credit cards with cycle indicators. A bottom-sheet modal handles add/edit.

**Tech Stack:** React 19, TypeScript (strict), Vitest, Tailwind CSS 4, Vite

**Spec:** `docs/superpowers/specs/2026-04-14-credit-cards-management-design.md`

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/types/index.ts` | Modify | Add optional credit card fields to `PaymentSource` |
| `src/lib/mock-data.ts` | Modify | Update default cards with new fields |
| `src/lib/billing-cycle.ts` | Create | Pure functions: `daysUntilDay`, `getCycleStatus`, `getAdjustedSources` |
| `src/lib/__tests__/billing-cycle.test.ts` | Create | Tests for all billing cycle logic |
| `src/lib/optimizer.ts` | Modify | Integrate `getAdjustedSources` before sorting |
| `src/lib/__tests__/optimizer.test.ts` | Modify | Add cycle-aware optimization tests |
| `src/lib/card-storage.ts` | Create | localStorage read/write for credit cards |
| `src/context/SessionContext.tsx` | Modify | Add `addCard`, `updateCard`, `removeCard`, `resetAll`; load from localStorage on init |
| `src/components/CardDisplay.tsx` | Create | Physical card styled component with cycle indicators |
| `src/components/AddCardModal.tsx` | Create | Bottom-sheet modal for add/edit card |
| `src/pages/Dashboard.tsx` | Modify | Replace credit cards section, add reset button, add "Agregar tarjeta" |
| `src/pages/Checkout.tsx` | Modify | Add billing cycle banner |
| `src/lib/source-colors.ts` | Modify | Handle dynamic card IDs with network-based fallback |

---

### Task 1: Extend PaymentSource type

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Add optional credit card fields to PaymentSource**

In `src/types/index.ts`, add the new optional fields after `priority`:

```typescript
export interface PaymentSource {
  id: string
  label: string
  symbol: string
  kind: PaymentSourceKind
  currency: string
  available: number
  feeRate: number
  priority: number
  // Credit card fields (only when kind === 'credit_card')
  bank?: string
  network?: string
  customName?: string
  creditLimit?: number
  closingDay?: number
  dueDay?: number
  last4?: string
}
```

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: PASS — all new fields are optional, so existing code is unaffected.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add optional credit card fields to PaymentSource type"
```

---

### Task 2: Update default cards in mock-data

**Files:**
- Modify: `src/lib/mock-data.ts`

- [ ] **Step 1: Add new fields to default credit card sources**

In `src/lib/mock-data.ts`, update the `visa` and `mastercard` entries in `defaultSources`:

```typescript
export const defaultSources: PaymentSource[] = [
  { id: 'usd',        label: 'USD Cash',    symbol: '$', kind: 'balance',     currency: 'USD',  available: 5,     feeRate: 0,     priority: 1 },
  { id: 'usdc',       label: 'USDC',        symbol: '$', kind: 'balance',     currency: 'USDC', available: 5,     feeRate: 0,     priority: 2 },
  { id: 'ars',        label: 'Pesos ARS',   symbol: '₱', kind: 'balance',     currency: 'ARS',  available: 14000, feeRate: 0.005, priority: 3 },
  { id: 'visa',       label: 'Visa Default', symbol: '$', kind: 'credit_card', currency: 'USD',  available: 500,   feeRate: 0.035, priority: 4, bank: 'Default', network: 'visa',       creditLimit: 500, closingDay: 15, dueDay: 5,  last4: '4521' },
  { id: 'mastercard', label: 'Mastercard Default', symbol: '$', kind: 'credit_card', currency: 'USD',  available: 300,   feeRate: 0.025, priority: 5, bank: 'Default', network: 'mastercard', creditLimit: 300, closingDay: 22, dueDay: 12, last4: '8832' },
]
```

- [ ] **Step 2: Extract default balance sources as a separate constant**

Add below `defaultSources` (this will be used by SessionContext to merge with localStorage cards):

```typescript
export const defaultBalances: PaymentSource[] = defaultSources.filter(s => s.kind === 'balance')
export const defaultCards: PaymentSource[] = defaultSources.filter(s => s.kind === 'credit_card')
```

- [ ] **Step 3: Run existing tests to verify nothing broke**

Run: `npx vitest run`
Expected: All existing tests PASS (labels changed from "Visa Credit" to "Visa Default" but tests use `sourceId` not `label`).

- [ ] **Step 4: Commit**

```bash
git add src/lib/mock-data.ts
git commit -m "feat: add billing cycle fields to default credit cards"
```

---

### Task 3: Create billing-cycle module with tests (TDD)

**Files:**
- Create: `src/lib/billing-cycle.ts`
- Create: `src/lib/__tests__/billing-cycle.test.ts`

- [ ] **Step 1: Write failing tests for `daysUntilDay`**

Create `src/lib/__tests__/billing-cycle.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { daysUntilDay, getCycleStatus, getAdjustedSources } from '../billing-cycle'
import type { PaymentSource } from '../../types'

describe('daysUntilDay', () => {
  it('returns days remaining when target is later in the month', () => {
    const today = new Date(2026, 3, 10) // April 10
    expect(daysUntilDay(15, today)).toBe(5)
  })

  it('returns days wrapping to next month when target has passed', () => {
    const today = new Date(2026, 3, 20) // April 20, closing day 15
    // Next closing: May 15 = 25 days
    expect(daysUntilDay(15, today)).toBe(25)
  })

  it('returns 0 when today is the target day', () => {
    const today = new Date(2026, 3, 15) // April 15
    expect(daysUntilDay(15, today)).toBe(0)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/billing-cycle.test.ts`
Expected: FAIL — module does not exist.

- [ ] **Step 3: Implement `daysUntilDay`**

Create `src/lib/billing-cycle.ts`:

```typescript
import type { PaymentSource } from '../types'

/**
 * Calculate days from `today` until the next occurrence of `day` (1-28).
 * Returns 0 if today is that day.
 */
export function daysUntilDay(day: number, today: Date): number {
  const currentDay = today.getDate()
  if (currentDay === day) return 0
  if (currentDay < day) return day - currentDay

  // Day has passed this month — calculate to next month
  const year = today.getFullYear()
  const month = today.getMonth()
  const nextOccurrence = new Date(year, month + 1, day)
  const diffMs = nextOccurrence.getTime() - today.getTime()
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24))
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/__tests__/billing-cycle.test.ts`
Expected: PASS

- [ ] **Step 5: Write failing tests for `getCycleStatus`**

Append to `src/lib/__tests__/billing-cycle.test.ts`:

```typescript
describe('getCycleStatus', () => {
  // Card closes on 15, due on 5
  it('returns "closing-soon" when 3 days or less to closing', () => {
    const today = new Date(2026, 3, 13) // April 13, closes 15 → 2 days
    expect(getCycleStatus(15, 5, today)).toEqual({
      status: 'closing-soon',
      daysToClose: 2,
      daysToDue: expect.any(Number),
    })
  })

  it('returns "new-period" when between closing and due date', () => {
    const today = new Date(2026, 3, 20) // April 20, closed on 15, due May 5
    expect(getCycleStatus(15, 5, today)).toEqual({
      status: 'new-period',
      daysToClose: expect.any(Number),
      daysToDue: expect.any(Number),
    })
  })

  it('returns "due-soon" when 3 days or less to due date', () => {
    const today = new Date(2026, 4, 3) // May 3, due May 5 → 2 days
    expect(getCycleStatus(15, 5, today)).toEqual({
      status: 'due-soon',
      daysToClose: expect.any(Number),
      daysToDue: 2,
    })
  })

  it('returns "normal" in middle of cycle', () => {
    const today = new Date(2026, 3, 5) // April 5, closes 15 → 10 days
    expect(getCycleStatus(15, 5, today)).toEqual({
      status: 'normal',
      daysToClose: 10,
      daysToDue: expect.any(Number),
    })
  })
})
```

- [ ] **Step 6: Implement `getCycleStatus`**

Append to `src/lib/billing-cycle.ts`:

```typescript
export type CycleStatusType = 'closing-soon' | 'due-soon' | 'new-period' | 'normal'

export interface CycleStatus {
  status: CycleStatusType
  daysToClose: number
  daysToDue: number
}

/**
 * Determine where we are in the billing cycle.
 * closingDay: day statement closes. dueDay: day payment is due.
 * The "new period" window is: after closing, before due (next month).
 */
export function getCycleStatus(closingDay: number, dueDay: number, today: Date): CycleStatus {
  const daysToClose = daysUntilDay(closingDay, today)
  const daysToDue = daysUntilDay(dueDay, today)

  if (daysToDue <= 3 && daysToDue > 0) {
    return { status: 'due-soon', daysToClose, daysToDue }
  }

  if (daysToClose <= 3 && daysToClose > 0) {
    return { status: 'closing-soon', daysToClose, daysToDue }
  }

  // "New period" = closing has passed (daysToClose is large) and due is still ahead
  // This means today > closingDay and today < dueDay (next month if dueDay < closingDay)
  const currentDay = today.getDate()
  const isAfterClose = currentDay > closingDay || daysToClose === 0
  const isBeforeDue = dueDay > closingDay
    ? currentDay < dueDay
    : currentDay > closingDay || currentDay < dueDay

  if (isAfterClose && isBeforeDue) {
    return { status: 'new-period', daysToClose, daysToDue }
  }

  return { status: 'normal', daysToClose, daysToDue }
}
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run src/lib/__tests__/billing-cycle.test.ts`
Expected: PASS

- [ ] **Step 8: Write failing tests for `getAdjustedSources`**

Append to `src/lib/__tests__/billing-cycle.test.ts`:

```typescript
describe('getAdjustedSources', () => {
  const baseSources: PaymentSource[] = [
    { id: 'usd', label: 'USD', symbol: '$', kind: 'balance', currency: 'USD', available: 100, feeRate: 0, priority: 1 },
    { id: 'card-1', label: 'Visa Galicia', symbol: '$', kind: 'credit_card', currency: 'USD', available: 500, feeRate: 0.035, priority: 4, bank: 'Galicia', network: 'visa', closingDay: 15, dueDay: 5, creditLimit: 500 },
    { id: 'card-2', label: 'MC Macro', symbol: '$', kind: 'credit_card', currency: 'USD', available: 300, feeRate: 0.025, priority: 5, bank: 'Macro', network: 'mastercard', closingDay: 22, dueDay: 12, creditLimit: 300 },
  ]

  it('does not adjust balance sources', () => {
    const today = new Date(2026, 3, 13)
    const adjusted = getAdjustedSources(baseSources, today)
    expect(adjusted.find(s => s.id === 'usd')!.priority).toBe(1)
  })

  it('penalizes cards with closing in <= 3 days (+2 priority)', () => {
    const today = new Date(2026, 3, 13) // card-1 closes on 15 → 2 days
    const adjusted = getAdjustedSources(baseSources, today)
    expect(adjusted.find(s => s.id === 'card-1')!.priority).toBe(6) // 4 + 2
  })

  it('favors cards in new period (-1 priority)', () => {
    const today = new Date(2026, 3, 20) // card-1 closed on 15, due May 5
    const adjusted = getAdjustedSources(baseSources, today)
    expect(adjusted.find(s => s.id === 'card-1')!.priority).toBe(3) // 4 - 1
  })

  it('does not adjust cards in normal cycle state', () => {
    const today = new Date(2026, 3, 5) // card-1 closes on 15 → 10 days
    const adjusted = getAdjustedSources(baseSources, today)
    expect(adjusted.find(s => s.id === 'card-1')!.priority).toBe(4) // unchanged
  })

  it('does not mutate the original array', () => {
    const today = new Date(2026, 3, 13)
    const originalPriority = baseSources[1].priority
    getAdjustedSources(baseSources, today)
    expect(baseSources[1].priority).toBe(originalPriority)
  })
})
```

- [ ] **Step 9: Implement `getAdjustedSources`**

Append to `src/lib/billing-cycle.ts`:

```typescript
/**
 * Return a copy of sources with credit card priorities adjusted
 * based on billing cycle position. Does not mutate input.
 */
export function getAdjustedSources(sources: PaymentSource[], today: Date): PaymentSource[] {
  return sources.map(source => {
    if (source.kind !== 'credit_card' || !source.closingDay || !source.dueDay) {
      return source
    }

    const cycle = getCycleStatus(source.closingDay, source.dueDay, today)

    switch (cycle.status) {
      case 'closing-soon':
        return { ...source, priority: source.priority + 2 }
      case 'new-period':
        return { ...source, priority: source.priority - 1 }
      default:
        return source
    }
  })
}
```

- [ ] **Step 10: Run all billing-cycle tests**

Run: `npx vitest run src/lib/__tests__/billing-cycle.test.ts`
Expected: All PASS

- [ ] **Step 11: Commit**

```bash
git add src/lib/billing-cycle.ts src/lib/__tests__/billing-cycle.test.ts
git commit -m "feat: add billing cycle module with daysUntilDay, getCycleStatus, getAdjustedSources"
```

---

### Task 4: Integrate billing cycle into optimizer

**Files:**
- Modify: `src/lib/optimizer.ts`
- Modify: `src/lib/__tests__/optimizer.test.ts`

- [ ] **Step 1: Write failing test for cycle-aware optimization**

Append to `src/lib/__tests__/optimizer.test.ts`, inside the top-level `describe`:

```typescript
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
    // USD first (priority 1), then card-newperiod (adjusted 4), NOT card-closing (adjusted 6)
    expect(usages).toContain('usd')
    expect(usages).toContain('card-newperiod')
    expect(usages).not.toContain('card-closing')
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/__tests__/optimizer.test.ts`
Expected: FAIL — `optimizePayment` doesn't accept a third argument.

- [ ] **Step 3: Update `optimizePayment` to accept optional `today` parameter**

In `src/lib/optimizer.ts`, add the import and update the function signature:

```typescript
import type { OptimizationResult, PaymentSource, SourceUsage } from '../types'
import { getAdjustedSources } from './billing-cycle'

export const ARS_RATE = 1400

function roundAmount(value: number) {
  return parseFloat(value.toFixed(10))
}

export function optimizePayment(
  amountUSD: number,
  sources: PaymentSource[],
  today: Date = new Date(),
): OptimizationResult {
  let remaining = roundAmount(amountUSD)
  const sourceUsages: SourceUsage[] = []

  const adjusted = getAdjustedSources(sources, today)
  const sorted = [...adjusted].sort((a, b) => a.priority - b.priority)
```

The rest of the function body remains unchanged.

- [ ] **Step 4: Run all optimizer tests**

Run: `npx vitest run src/lib/__tests__/optimizer.test.ts`
Expected: All PASS (existing tests don't pass `today`, so they use `new Date()` default).

- [ ] **Step 5: Commit**

```bash
git add src/lib/optimizer.ts src/lib/__tests__/optimizer.test.ts
git commit -m "feat: integrate billing cycle priority adjustment into optimizer"
```

---

### Task 5: Create card-storage module for localStorage

**Files:**
- Create: `src/lib/card-storage.ts`

- [ ] **Step 1: Create the card-storage module**

Create `src/lib/card-storage.ts`:

```typescript
import type { PaymentSource } from '../types'

const STORAGE_KEY = 'mixpay_cards'

export function loadCards(): PaymentSource[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PaymentSource[]
  } catch {
    return null
  }
}

export function saveCards(cards: PaymentSource[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards))
}

export function clearCards(): void {
  localStorage.removeItem(STORAGE_KEY)
}

const DEFAULT_FEES: Record<string, number> = {
  visa: 0.035,
  mastercard: 0.025,
  amex: 0.03,
}

export function getDefaultFee(network: string): number {
  return DEFAULT_FEES[network] ?? 0.03
}

export function generateCardId(): string {
  return `card-${Date.now()}`
}

export function generateLast4(): string {
  return String(Math.floor(1000 + Math.random() * 9000))
}

export function buildCardLabel(network: string, bank: string, customName?: string): string {
  const net = network.charAt(0).toUpperCase() + network.slice(1)
  const parts = [net, bank]
  if (customName) parts.push(customName)
  return parts.join(' ')
}
```

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/card-storage.ts
git commit -m "feat: add card-storage module for localStorage persistence"
```

---

### Task 6: Update SessionContext with card CRUD and localStorage

**Files:**
- Modify: `src/context/SessionContext.tsx`

- [ ] **Step 1: Update the context interface and initialization**

Rewrite `src/context/SessionContext.tsx`:

```typescript
import { createContext, useContext, useState } from 'react'
import type { OptimizationResult, PaymentSource, Transaction } from '../types'
import { defaultBalances, defaultCards, mockTransactions } from '../lib/mock-data'
import { loadCards, saveCards, clearCards, generateCardId, generateLast4, buildCardLabel, getDefaultFee } from '../lib/card-storage'

interface SessionContextValue {
  sources: PaymentSource[]
  transactions: Transaction[]
  applyPayment: (result: OptimizationResult, merchant: string, amount: number) => void
  addFunds: (sourceId: string, amount: number) => void
  addCard: (card: {
    bank: string
    network: string
    customName?: string
    currency: string
    creditLimit: number
    closingDay: number
    dueDay: number
    feeRate?: number
  }) => void
  updateCard: (id: string, updates: Partial<PaymentSource>) => void
  removeCard: (id: string) => void
  resetAll: () => void
}

const SessionContext = createContext<SessionContextValue | null>(null)

function getInitialSources(): PaymentSource[] {
  const storedCards = loadCards()
  const cards = storedCards ?? defaultCards
  return [...defaultBalances, ...cards]
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [sources, setSources] = useState<PaymentSource[]>(getInitialSources)
  const [transactions, setTransactions] = useState<Transaction[]>(mockTransactions)

  function persistCards(nextSources: PaymentSource[]) {
    const cards = nextSources.filter(s => s.kind === 'credit_card')
    saveCards(cards)
  }

  function applyPayment(result: OptimizationResult, merchant: string, amount: number) {
    setSources(prev => {
      const next = prev.map(s => {
        const usage = result.sourceUsages.find(u => u.sourceId === s.id)
        if (!usage) return s
        return { ...s, available: parseFloat((s.available - usage.amountOriginal).toFixed(10)) }
      })
      persistCards(next)
      return next
    })

    const tx: Transaction = {
      id: `tx-${Date.now()}`,
      merchant,
      amount,
      date: new Date().toISOString().slice(0, 10),
      result,
    }
    setTransactions(prev => [tx, ...prev])
  }

  function addFunds(sourceId: string, amount: number) {
    setSources(prev =>
      prev.map(s =>
        s.id === sourceId ? { ...s, available: parseFloat((s.available + amount).toFixed(10)) } : s
      )
    )
  }

  function addCard(card: {
    bank: string
    network: string
    customName?: string
    currency: string
    creditLimit: number
    closingDay: number
    dueDay: number
    feeRate?: number
  }) {
    const maxPriority = Math.max(...sources.map(s => s.priority))
    const newSource: PaymentSource = {
      id: generateCardId(),
      label: buildCardLabel(card.network, card.bank, card.customName),
      symbol: card.currency === 'ARS' ? '₱' : '$',
      kind: 'credit_card',
      currency: card.currency,
      available: card.creditLimit,
      feeRate: card.feeRate ?? getDefaultFee(card.network),
      priority: maxPriority + 1,
      bank: card.bank,
      network: card.network,
      customName: card.customName,
      creditLimit: card.creditLimit,
      closingDay: card.closingDay,
      dueDay: card.dueDay,
      last4: generateLast4(),
    }
    setSources(prev => {
      const next = [...prev, newSource]
      persistCards(next)
      return next
    })
  }

  function updateCard(id: string, updates: Partial<PaymentSource>) {
    setSources(prev => {
      const next = prev.map(s => {
        if (s.id !== id) return s
        const updated = { ...s, ...updates }
        // Recalculate label if relevant fields changed
        if (updates.network || updates.bank || updates.customName) {
          updated.label = buildCardLabel(
            updated.network ?? s.network ?? '',
            updated.bank ?? s.bank ?? '',
            updated.customName,
          )
        }
        return updated
      })
      persistCards(next)
      return next
    })
  }

  function removeCard(id: string) {
    setSources(prev => {
      const next = prev.filter(s => s.id !== id)
      persistCards(next)
      return next
    })
  }

  function resetAll() {
    clearCards()
    setSources([...defaultBalances, ...defaultCards])
    setTransactions(mockTransactions)
  }

  return (
    <SessionContext.Provider value={{
      sources, transactions, applyPayment, addFunds,
      addCard, updateCard, removeCard, resetAll,
    }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used within SessionProvider')
  return ctx
}
```

- [ ] **Step 2: Run TypeScript check and existing tests**

Run: `npx tsc --noEmit && npx vitest run`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/context/SessionContext.tsx
git commit -m "feat: add card CRUD and localStorage persistence to SessionContext"
```

---

### Task 7: Update source-colors to handle dynamic card IDs

**Files:**
- Modify: `src/lib/source-colors.ts`

- [ ] **Step 1: Add network-based fallback for dynamic card IDs**

Replace `src/lib/source-colors.ts` content:

```typescript
interface SourceColors {
  bar: string
  text: string
  bg: string
  dot: string
  icon: string
}

const COLORS: Record<string, SourceColors> = {
  usd:        { bar: 'bg-blue-500',   text: 'text-blue-300',   bg: 'bg-blue-500/10',   dot: 'bg-blue-400',   icon: 'text-blue-400' },
  usdc:       { bar: 'bg-purple-500', text: 'text-purple-300', bg: 'bg-purple-500/10', dot: 'bg-purple-400', icon: 'text-purple-400' },
  ars:        { bar: 'bg-sky-400',    text: 'text-sky-300',    bg: 'bg-sky-500/10',    dot: 'bg-sky-400',    icon: 'text-sky-400' },
  visa:       { bar: 'bg-rose-500',   text: 'text-rose-300',   bg: 'bg-rose-500/10',   dot: 'bg-rose-400',   icon: 'text-rose-400' },
  mastercard: { bar: 'bg-orange-500', text: 'text-orange-300', bg: 'bg-orange-500/10', dot: 'bg-orange-400', icon: 'text-orange-400' },
  amex:       { bar: 'bg-emerald-500', text: 'text-emerald-300', bg: 'bg-emerald-500/10', dot: 'bg-emerald-400', icon: 'text-emerald-400' },
}

const FALLBACK = COLORS.visa

export function getSourceColors(sourceId: string, network?: string): SourceColors {
  // Direct match first (for legacy IDs like 'visa', 'mastercard')
  if (COLORS[sourceId]) return COLORS[sourceId]
  // Network-based match for dynamic card IDs (e.g. 'card-1713100000')
  if (network && COLORS[network]) return COLORS[network]
  return FALLBACK
}
```

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/lib/source-colors.ts
git commit -m "feat: add network-based color fallback for dynamic card IDs"
```

---

### Task 8: Create CardDisplay component

**Files:**
- Create: `src/components/CardDisplay.tsx`

- [ ] **Step 1: Create the physical card styled component**

Create `src/components/CardDisplay.tsx`:

```tsx
import { getCycleStatus } from '../lib/billing-cycle'
import type { PaymentSource } from '../types'

const NETWORK_COLORS: Record<string, { text: string; color: string }> = {
  visa:       { text: 'VISA', color: '#60A5FA' },
  mastercard: { text: 'MC',   color: '#F87171' },
  amex:       { text: 'AMEX', color: '#34D399' },
}

const NETWORK_GRADIENTS: Record<string, string> = {
  visa:       'from-[#1E3A5F] to-[#0F172A]',
  mastercard: 'from-[#3B1F1F] to-[#0F172A]',
  amex:       'from-[#1F3B2F] to-[#0F172A]',
}

interface CardDisplayProps {
  source: PaymentSource
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

export default function CardDisplay({ source, onEdit, onDelete }: CardDisplayProps) {
  const network = source.network ?? 'visa'
  const netInfo = NETWORK_COLORS[network] ?? NETWORK_COLORS.visa
  const gradient = NETWORK_GRADIENTS[network] ?? NETWORK_GRADIENTS.visa

  const today = new Date()
  const cycle = source.closingDay && source.dueDay
    ? getCycleStatus(source.closingDay, source.dueDay, today)
    : null

  const displayValue = source.currency === 'ARS'
    ? `${source.symbol}${source.available.toLocaleString()}`
    : `${source.symbol}${source.available.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div className={`relative bg-gradient-to-br ${gradient} border border-[#334155] rounded-2xl p-4 min-w-[180px]`}>
      {/* Menu button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          const menu = e.currentTarget.nextElementSibling as HTMLElement
          menu.classList.toggle('hidden')
        }}
        className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-[#64748B] hover:text-[#94A3B8] rounded-full hover:bg-white/5"
      >
        ···
      </button>
      {/* Dropdown menu */}
      <div className="hidden absolute top-8 right-2 bg-[#1E293B] border border-[#334155] rounded-lg shadow-lg z-10 overflow-hidden">
        <button
          onClick={() => onEdit(source.id)}
          className="block w-full px-4 py-2 text-left text-sm text-[#F8FAFC] hover:bg-[#272F42]"
        >
          Editar
        </button>
        <button
          onClick={() => onDelete(source.id)}
          className="block w-full px-4 py-2 text-left text-sm text-[#F87171] hover:bg-[#272F42]"
        >
          Eliminar
        </button>
      </div>

      {/* Header: bank + network */}
      <div className="flex justify-between items-center mb-4">
        <span className="text-[#94A3B8] text-[11px] uppercase tracking-wide">{source.bank ?? ''}</span>
        <span style={{ color: netInfo.color }} className="font-bold text-xs">{netInfo.text}</span>
      </div>

      {/* Last 4 */}
      <div className="text-[#F8FAFC] text-sm tracking-[3px] mb-3">
        •••• {source.last4 ?? '0000'}
      </div>

      {/* Available amount */}
      <div className="text-[#F59E0B] font-bold text-lg mb-1">{displayValue}</div>

      {/* Cycle info */}
      {source.closingDay && source.dueDay && (
        <div className="flex gap-2 text-[10px] text-[#64748B]">
          <span>Cierra {source.closingDay}</span>
          <span>·</span>
          <span>Vence {source.dueDay}</span>
        </div>
      )}

      {/* Cycle indicator */}
      {cycle && cycle.status === 'closing-soon' && (
        <div className="mt-2 text-[10px] text-[#FBBF24]">
          ⚠ Cierra en {cycle.daysToClose} día{cycle.daysToClose !== 1 ? 's' : ''}
        </div>
      )}
      {cycle && cycle.status === 'due-soon' && (
        <div className="mt-2 text-[10px] text-[#F87171]">
          ⚠ Vence en {cycle.daysToDue} día{cycle.daysToDue !== 1 ? 's' : ''}
        </div>
      )}
      {cycle && cycle.status === 'new-period' && (
        <div className="mt-2">
          <span className="text-[10px] bg-[#34D399]/20 text-[#34D399] px-2 py-0.5 rounded-full">
            Período nuevo
          </span>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/CardDisplay.tsx
git commit -m "feat: add CardDisplay component with physical card style and cycle indicators"
```

---

### Task 9: Create AddCardModal component

**Files:**
- Create: `src/components/AddCardModal.tsx`

- [ ] **Step 1: Create the bottom-sheet modal**

Create `src/components/AddCardModal.tsx`:

```tsx
import { useState, useEffect } from 'react'
import { getDefaultFee } from '../lib/card-storage'
import type { PaymentSource } from '../types'

const BANKS = ['Galicia', 'Macro', 'BBVA', 'Santander', 'HSBC', 'Brubank', 'Ualá', 'Mercado Pago', 'Naranja X']
const NETWORKS = ['visa', 'mastercard', 'amex'] as const

interface AddCardModalProps {
  onClose: () => void
  onSave: (card: {
    bank: string
    network: string
    customName?: string
    currency: string
    creditLimit: number
    closingDay: number
    dueDay: number
    feeRate?: number
  }) => void
  editCard?: PaymentSource | null
}

export default function AddCardModal({ onClose, onSave, editCard }: AddCardModalProps) {
  const [bank, setBank] = useState(editCard?.bank ?? '')
  const [customBank, setCustomBank] = useState('')
  const [network, setNetwork] = useState(editCard?.network ?? 'visa')
  const [customName, setCustomName] = useState(editCard?.customName ?? '')
  const [limitStr, setLimitStr] = useState(editCard?.creditLimit?.toString() ?? '')
  const [currency, setCurrency] = useState(editCard?.currency ?? 'ARS')
  const [closingDayStr, setClosingDayStr] = useState(editCard?.closingDay?.toString() ?? '')
  const [dueDayStr, setDueDayStr] = useState(editCard?.dueDay?.toString() ?? '')
  const [feeStr, setFeeStr] = useState(editCard?.feeRate ? (editCard.feeRate * 100).toString() : '')

  const [showCustomBank, setShowCustomBank] = useState(false)

  useEffect(() => {
    if (editCard?.bank && !BANKS.includes(editCard.bank)) {
      setShowCustomBank(true)
      setCustomBank(editCard.bank)
      setBank('__custom__')
    }
  }, [editCard])

  const effectiveBank = bank === '__custom__' ? customBank : bank
  const limit = parseFloat(limitStr) || 0
  const closingDay = parseInt(closingDayStr) || 0
  const dueDay = parseInt(dueDayStr) || 0

  const isValid =
    effectiveBank.length > 0 &&
    network.length > 0 &&
    limit > 0 &&
    closingDay >= 1 && closingDay <= 28 &&
    dueDay >= 1 && dueDay <= 28

  function handleSave() {
    if (!isValid) return
    const fee = feeStr ? parseFloat(feeStr) / 100 : undefined
    onSave({
      bank: effectiveBank,
      network,
      customName: customName || undefined,
      currency,
      creditLimit: limit,
      closingDay,
      dueDay,
      feeRate: fee,
    })
    onClose()
  }

  const networkLabels: Record<string, string> = { visa: 'Visa', mastercard: 'Mastercard', amex: 'Amex' }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-[#131C2E] border border-[#334155] rounded-t-2xl p-6 space-y-4 max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#F8FAFC]">
            {editCard ? 'Editar tarjeta' : 'Nueva tarjeta'}
          </h2>
          <button onClick={onClose} className="text-[#64748B] hover:text-[#94A3B8] text-xl leading-none">✕</button>
        </div>

        {/* Banco */}
        <div>
          <label className="text-[#94A3B8] text-xs block mb-1">Banco</label>
          {!showCustomBank ? (
            <select
              value={bank}
              onChange={e => {
                if (e.target.value === '__custom__') {
                  setShowCustomBank(true)
                  setBank('__custom__')
                } else {
                  setBank(e.target.value)
                }
              }}
              className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-4 py-3 text-[#F8FAFC] text-sm focus:outline-none focus:border-[#F59E0B] appearance-none"
            >
              <option value="">Seleccionar banco...</option>
              {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
              <option value="__custom__">Otro...</option>
            </select>
          ) : (
            <input
              value={customBank}
              onChange={e => setCustomBank(e.target.value)}
              placeholder="Nombre del banco"
              className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-4 py-3 text-[#F8FAFC] text-sm placeholder-[#475569] focus:outline-none focus:border-[#F59E0B]"
            />
          )}
        </div>

        {/* Red */}
        <div>
          <label className="text-[#94A3B8] text-xs block mb-1">Red</label>
          <div className="flex gap-2">
            {NETWORKS.map(net => (
              <button
                key={net}
                onClick={() => setNetwork(net)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                  network === net
                    ? 'bg-[#F59E0B] text-[#0F172A]'
                    : 'bg-[#1E293B] text-[#94A3B8] hover:bg-[#272F42]'
                }`}
              >
                {networkLabels[net]}
              </button>
            ))}
          </div>
        </div>

        {/* Nombre */}
        <div>
          <label className="text-[#94A3B8] text-xs block mb-1">Nombre <span className="text-[#64748B]">(opcional)</span></label>
          <input
            value={customName}
            onChange={e => setCustomName(e.target.value)}
            placeholder="Ej: Gold, Black, Platinum..."
            className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-4 py-3 text-[#F8FAFC] text-sm placeholder-[#475569] focus:outline-none focus:border-[#F59E0B]"
          />
        </div>

        {/* Límite + Moneda */}
        <div className="flex gap-3">
          <div className="flex-[2]">
            <label className="text-[#94A3B8] text-xs block mb-1">Límite</label>
            <input
              type="number"
              min="0"
              step="any"
              value={limitStr}
              onChange={e => setLimitStr(e.target.value)}
              placeholder="500000"
              className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-4 py-3 text-[#F8FAFC] text-sm placeholder-[#475569] focus:outline-none focus:border-[#F59E0B]"
            />
          </div>
          <div className="flex-1">
            <label className="text-[#94A3B8] text-xs block mb-1">Moneda</label>
            <select
              value={currency}
              onChange={e => setCurrency(e.target.value)}
              className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-4 py-3 text-[#F8FAFC] text-sm focus:outline-none focus:border-[#F59E0B] appearance-none"
            >
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </div>

        {/* Cierre + Vencimiento */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-[#94A3B8] text-xs block mb-1">Cierre (día)</label>
            <input
              type="number"
              min="1"
              max="28"
              value={closingDayStr}
              onChange={e => setClosingDayStr(e.target.value)}
              placeholder="15"
              className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-4 py-3 text-[#F8FAFC] text-sm placeholder-[#475569] focus:outline-none focus:border-[#F59E0B] text-center"
            />
          </div>
          <div className="flex-1">
            <label className="text-[#94A3B8] text-xs block mb-1">Vencimiento (día)</label>
            <input
              type="number"
              min="1"
              max="28"
              value={dueDayStr}
              onChange={e => setDueDayStr(e.target.value)}
              placeholder="5"
              className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-4 py-3 text-[#F8FAFC] text-sm placeholder-[#475569] focus:outline-none focus:border-[#F59E0B] text-center"
            />
          </div>
        </div>

        {/* Fee */}
        <div>
          <label className="text-[#94A3B8] text-xs block mb-1">
            Fee % <span className="text-[#64748B]">(opcional, default {(getDefaultFee(network) * 100).toFixed(1)}%)</span>
          </label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={feeStr}
            onChange={e => setFeeStr(e.target.value)}
            placeholder={(getDefaultFee(network) * 100).toFixed(1)}
            className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-4 py-3 text-[#F8FAFC] text-sm placeholder-[#475569] focus:outline-none focus:border-[#F59E0B]"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={!isValid}
          className="w-full bg-[#F59E0B] text-[#0F172A] py-3 rounded-xl font-semibold disabled:opacity-40 hover:bg-[#FBBF24] active:scale-95 transition-all"
        >
          {editCard ? 'Guardar cambios' : 'Agregar tarjeta'}
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Commit**

```bash
git add src/components/AddCardModal.tsx
git commit -m "feat: add AddCardModal bottom-sheet for add/edit credit cards"
```

---

### Task 10: Redesign Dashboard credit cards section

**Files:**
- Modify: `src/pages/Dashboard.tsx`

- [ ] **Step 1: Add imports and state for card management**

At the top of `src/pages/Dashboard.tsx`, update imports:

```typescript
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useSession } from '../context/SessionContext'
import { ARS_RATE } from '../lib/optimizer'
import { getSourceColors } from '../lib/source-colors'
import { mockCard } from '../lib/mock-data'
import AIExplanationModal from '../components/AIExplanationModal'
import CardDisplay from '../components/CardDisplay'
import AddCardModal from '../components/AddCardModal'
import type { PaymentSource, Transaction } from '../types'
```

Inside the `Dashboard` component, add new state:

```typescript
const { sources, transactions, addCard, updateCard, removeCard, resetAll } = useSession()
const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)
const [showAddFunds, setShowAddFunds] = useState(false)
const [showAddCard, setShowAddCard] = useState(false)
const [editingCard, setEditingCard] = useState<PaymentSource | null>(null)
```

- [ ] **Step 2: Replace the Credit Cards section**

Replace the existing Credit Cards section (the `{cardSources.length > 0 && (...)}` block) with:

```tsx
{/* Credit Cards */}
<div>
  <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide mb-3">
    Credit Cards
  </p>
  <div className={cardSources.length >= 4
    ? 'flex gap-3 overflow-x-auto pb-2 scrollbar-none'
    : 'grid grid-cols-2 gap-3'
  }>
    {cardSources.map(source => (
      <CardDisplay
        key={source.id}
        source={source}
        onEdit={(id) => {
          const card = cardSources.find(c => c.id === id)
          if (card) {
            setEditingCard(card)
            setShowAddCard(true)
          }
        }}
        onDelete={(id) => {
          if (window.confirm('¿Eliminar esta tarjeta?')) {
            removeCard(id)
          }
        }}
      />
    ))}
  </div>
  {/* Add card button */}
  <button
    onClick={() => { setEditingCard(null); setShowAddCard(true) }}
    className="w-full mt-3 border-2 border-dashed border-[#334155] rounded-2xl py-4 text-[#64748B] text-sm font-medium hover:border-[#F59E0B] hover:text-[#F59E0B] transition-all"
  >
    + Agregar tarjeta
  </button>
</div>
```

- [ ] **Step 3: Add reset button to header**

In the header `<div>` (where the avatar "JD" is), add a reset button before the avatar:

```tsx
<div className="w-8 h-8 bg-[#272F42] rounded-full flex items-center justify-center text-sm font-medium text-[#F8FAFC]">
  JD
</div>
```

Replace with:

```tsx
<div className="flex items-center gap-2">
  <button
    onClick={() => {
      if (window.confirm('¿Resetear todos los datos? Se borrarán las tarjetas y transacciones.')) {
        resetAll()
      }
    }}
    className="w-8 h-8 bg-[#272F42] rounded-full flex items-center justify-center text-[#64748B] hover:text-[#F87171] hover:bg-[#F87171]/10 transition-all"
    title="Resetear datos"
  >
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
    </svg>
  </button>
  <div className="w-8 h-8 bg-[#272F42] rounded-full flex items-center justify-center text-sm font-medium text-[#F8FAFC]">
    JD
  </div>
</div>
```

- [ ] **Step 4: Add the AddCardModal at the bottom of the component**

Before the closing `</div>` of the component, add:

```tsx
{showAddCard && (
  <AddCardModal
    onClose={() => { setShowAddCard(false); setEditingCard(null) }}
    onSave={(card) => {
      if (editingCard) {
        updateCard(editingCard.id, {
          bank: card.bank,
          network: card.network,
          customName: card.customName,
          currency: card.currency,
          creditLimit: card.creditLimit,
          available: card.creditLimit,
          closingDay: card.closingDay,
          dueDay: card.dueDay,
          feeRate: card.feeRate,
          symbol: card.currency === 'ARS' ? '₱' : '$',
        })
      } else {
        addCard(card)
      }
    }}
    editCard={editingCard}
  />
)}
```

- [ ] **Step 5: Run dev server and test manually**

Run: `npm run dev`

Test in browser:
1. Dashboard shows credit cards as physical card style
2. Click "Agregar tarjeta" → modal opens with all fields
3. Fill in and save → new card appears
4. Click "..." on a card → Edit/Delete menu appears
5. Edit → modal opens pre-populated
6. Delete → confirmation, card removed
7. Reload page → cards persist from localStorage
8. Click reset button → confirmation, cards reset to defaults

- [ ] **Step 6: Commit**

```bash
git add src/pages/Dashboard.tsx
git commit -m "feat: redesign Dashboard credit cards with CardDisplay, AddCardModal, and reset"
```

---

### Task 11: Add billing cycle banner to Checkout

**Files:**
- Modify: `src/pages/Checkout.tsx`

- [ ] **Step 1: Add cycle-awareness banner**

In `src/pages/Checkout.tsx`, add import:

```typescript
import { getCycleStatus } from '../lib/billing-cycle'
```

Inside the component, after the `const isValid = ...` line, add:

```typescript
const cardSources = sources.filter(s => s.kind === 'credit_card')
const closingSoonCards = cardSources.filter(s => {
  if (!s.closingDay || !s.dueDay) return false
  const cycle = getCycleStatus(s.closingDay, s.dueDay, new Date())
  return cycle.status === 'closing-soon'
})
```

In the JSX, between the `{/* AI Info Banner */}` section and the `{/* Pay Button */}`, add:

```tsx
{/* Billing cycle warning */}
{closingSoonCards.length > 0 && (
  <div className="bg-[#FBBF24]/10 rounded-xl px-4 py-3 border border-[#FBBF24]/20 flex items-start gap-3">
    <span className="text-[#FBBF24] text-sm mt-0.5">⚠</span>
    <p className="text-xs text-[#FBBF24] leading-relaxed">
      {closingSoonCards.map(c => c.label).join(', ')} cierra pronto — el optimizador lo tendrá en cuenta.
    </p>
  </div>
)}
```

- [ ] **Step 2: Run TypeScript check**

Run: `npx tsc --noEmit`
Expected: PASS

- [ ] **Step 3: Verify in browser**

Run dev server, navigate to Checkout. If a card has `closingDay` within 3 days of today, the amber banner should appear.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Checkout.tsx
git commit -m "feat: add billing cycle warning banner to Checkout page"
```

---

### Task 12: Final integration test

**Files:** None (verification only)

- [ ] **Step 1: Run all tests**

Run: `npx vitest run`
Expected: All tests PASS

- [ ] **Step 2: Run TypeScript strict check**

Run: `npx tsc --noEmit`
Expected: PASS (no errors)

- [ ] **Step 3: Run linter**

Run: `npm run lint`
Expected: PASS (or only pre-existing warnings)

- [ ] **Step 4: Full manual smoke test**

Run: `npm run dev`

Test this flow:
1. Open Dashboard — see 2 default credit cards in physical card style
2. Add a new card (Galicia, Visa, Gold, $500000 ARS, cierra 17, vence 7)
3. Verify card appears with correct data and cycle indicator
4. Edit the card — change limit to $600000
5. Verify edit persisted
6. Reload page — verify card still exists (localStorage)
7. Go to Checkout — verify billing cycle banner if applicable
8. Complete a payment — verify optimizer used cards with cycle-adjusted priorities
9. Click reset — verify all data returns to defaults
10. Reload — verify reset stuck (localStorage cleared)

- [ ] **Step 5: Commit any remaining fixes**

```bash
git add -A
git commit -m "feat: complete credit cards management feature"
```
