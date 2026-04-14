# Credit Cards Management — Design Spec

**Date:** 2026-04-14
**Status:** Approved
**Scope:** Add dynamic credit card management to MixPay with billing cycle awareness

## Summary

Allow users to add, edit, and remove credit cards from different banks. Each card stores its credit limit, statement closing day, and due day. The optimizer uses billing cycle position to adjust card priority dynamically. Visual indicators alert users when closing or due dates approach.

## 1. Data Model

Extend `PaymentSource` in `src/types/index.ts` with optional fields for credit cards:

```typescript
export interface PaymentSource {
  // Existing fields (unchanged)
  id: string
  label: string
  symbol: string
  kind: PaymentSourceKind  // 'balance' | 'credit_card'
  currency: string         // 'USD' | 'USDC' | 'ARS'
  available: number
  feeRate: number
  priority: number

  // New fields (credit_card only)
  bank?: string            // e.g. "Galicia", "Macro", "BBVA"
  network?: string         // "visa" | "mastercard" | "amex"
  customName?: string      // e.g. "Gold", "Black", "Platinum"
  creditLimit?: number     // total limit set by user
  closingDay?: number      // day of month statement closes (1-28)
  dueDay?: number          // day of month payment is due (1-28)
}
```

### Conventions

- `id` for user-created cards: `card-{timestamp}` (e.g. `card-1713100000`)
- `label` auto-generated: `"{Network} {Bank} {CustomName}"` (e.g. "Visa Galicia Gold")
- `available` represents current available balance (limit minus current period usage)
- `creditLimit` is the fixed ceiling entered by the user
- `symbol`: `$` for USD cards, `₱` for ARS cards
- Days clamped to 1-28 to avoid month-length edge cases

### Default cards migration

The existing hardcoded Visa ($500) and Mastercard ($300) gain the new fields:

| Field | Visa | Mastercard |
|-------|------|------------|
| bank | "Default" | "Default" |
| network | "visa" | "mastercard" |
| customName | (empty) | (empty) |
| creditLimit | 500 | 300 |
| closingDay | 15 | 22 |
| dueDay | 5 | 12 |

These are editable and deletable like any user-created card.

## 2. Persistence

### localStorage strategy

- **Key:** `mixpay_cards`
- **Value:** JSON-serialized array of `PaymentSource` objects with `kind: 'credit_card'`
- **Read:** On `SessionContext` initialization, load cards from localStorage and merge with default balance sources (USD, USDC, ARS)
- **Write:** On every add, edit, or delete operation
- **Balances remain in-memory only**, consistent with existing behavior

### Reset button

- Location: Dashboard header, next to the avatar ("JD")
- Icon: logout/reset style
- Behavior: shows a confirmation dialog — "¿Resetear todos los datos? Se borrarán las tarjetas y transacciones"
- On confirm: clears `mixpay_cards` from localStorage, resets `SessionContext` to defaults (including the 2 example cards)

## 3. Dashboard UI — Card Display

### Credit cards section redesign

Replace the current compact list with **physical credit card styled cards** (option B from brainstorming).

Each card renders as a mini credit card with:
- **Top-left:** bank name (small gray text)
- **Top-right:** network badge (VISA blue `#60A5FA`, MC red `#F87171`, AMEX green `#34D399`)
- **Middle:** generated last-4 digits (cosmetic, random at creation)
- **Large:** available amount in amber (`#F59E0B`)
- **Bottom:** `Cierra {day} · Vence {day}`
- **Alert indicator** (when applicable, see Section 6)

### Layout

- 2-column grid by default; switches to horizontal scroll when there are 4+ cards
- Below the cards: an "Agregar tarjeta" button styled as a dashed-border card placeholder

### Card actions

- "..." button or long-press opens a small menu: **Editar** / **Eliminar**
- Edit opens the add-card modal pre-populated
- Delete asks for confirmation before removing

## 4. Modal — Add/Edit Card

Bottom-sheet modal (slides up from bottom), consistent with the existing "Agregar fondos" modal.

### Fields in order

1. **Banco** — dropdown with common Argentine banks: Galicia, Macro, BBVA, Santander, HSBC, Brubank, Ualá, Mercado Pago, Naranja X, Otro (free text)
2. **Red** — toggle buttons: Visa | Mastercard | Amex (styled like currency tabs in Add Funds)
3. **Nombre** (optional) — text input, placeholder "Ej: Gold, Black, Platinum..."
4. **Límite** + **Moneda** — numeric input + ARS/USD select, same row
5. **Día de cierre** — numeric input (1-28)
6. **Día de vencimiento** — numeric input (1-28)
7. **Fee %** (optional) — numeric input with placeholder showing default by network (Visa: 3.5%, MC: 2.5%, Amex: 3.0%)

### Validation

- Required: banco, red, límite, cierre, vencimiento
- Days must be integers 1-28
- Límite must be > 0
- Fee defaults: Visa 3.5%, Mastercard 2.5%, Amex 3.0% (applied if field left empty)

### Edit mode

Same modal, pre-populated with existing values. Button text changes to "Guardar cambios".

## 5. Optimizer — Billing Cycle Awareness

### New function: `getAdjustedSources`

A pure function in `src/lib/billing-cycle.ts` that adjusts priorities based on billing cycle position:

```
function getAdjustedSources(sources: PaymentSource[], today: Date): PaymentSource[]
```

**Logic per credit card:**

1. Calculate `daysToClose` — days until the next closing day
2. **Closing imminent (daysToClose <= 3):** penalty, `priority + 2`
   - Rationale: purchase enters current statement with near-term due date
3. **Already closed (between closing and due):** bonus, `priority - 1`
   - Rationale: purchase goes to next period, more time to pay = lower opportunity cost
4. **Normal state:** no adjustment

The function returns a shallow copy with adjusted priorities. It does not mutate the original sources.

### Integration points

- **Deterministic optimizer** (`optimizePayment`): calls `getAdjustedSources` before sorting by priority
- **Agent pipeline** (`Optimization Agent`): receives billing cycle metadata as additional context so the LLM can reason about it in extended thinking

## 6. Visual Indicators

### Dashboard — on each card

| Condition | Indicator | Color |
|-----------|-----------|-------|
| Closing in ≤ 3 days | `⚠ Cierra en X días` | Amber `#FBBF24` |
| Due in ≤ 3 days | `⚠ Vence en X días` | Red `#F87171` |
| Already closed, before due | `Período nuevo` badge | Green `#34D399` |
| Normal (mid-cycle) | No indicator | — |

### Checkout — pre-optimization banner

If any credit card has closing imminent (≤ 3 days), show a subtle info banner:
> "Visa Galicia cierra en 2 días — el optimizador lo tendrá en cuenta"

## 7. SessionContext Changes

### New functions to expose

- `addCard(card: Omit<PaymentSource, 'id' | 'label' | 'symbol' | 'priority'>)` — generates id, label, symbol, assigns next priority, persists to localStorage
- `updateCard(id: string, updates: Partial<PaymentSource>)` — updates fields, recalculates label if needed, persists
- `removeCard(id: string)` — removes from sources, persists
- `resetAll()` — clears localStorage, resets to defaults

### Priority assignment

New cards get `priority = max(existing priorities) + 1`. User can reorder later if needed (not in initial scope).

## 8. Files to Create or Modify

| File | Action | Purpose |
|------|--------|---------|
| `src/types/index.ts` | Modify | Add optional fields to PaymentSource |
| `src/lib/mock-data.ts` | Modify | Update default cards with new fields |
| `src/context/SessionContext.tsx` | Modify | Add card CRUD, localStorage persistence, resetAll |
| `src/lib/optimizer.ts` | Modify | Add `getAdjustedSources`, integrate into `optimizePayment` |
| `src/lib/billing-cycle.ts` | Create | Pure functions: `daysUntilClose`, `getCycleStatus`, `getAdjustedSources` |
| `src/pages/Dashboard.tsx` | Modify | Redesign credit cards section, add reset button |
| `src/components/CardDisplay.tsx` | Create | Physical card styled component with cycle indicators |
| `src/components/AddCardModal.tsx` | Create | Bottom-sheet modal for add/edit card |
| `src/pages/Checkout.tsx` | Modify | Add billing cycle banner |
| `src/lib/__tests__/billing-cycle.test.ts` | Create | Tests for cycle calculations and priority adjustments |
| `src/lib/__tests__/optimizer.test.ts` | Modify | Add tests for cycle-aware optimization |

## 9. Out of Scope

- Real bank API integration
- Credit card number storage or validation
- Payment processing
- Card reordering / drag-and-drop priority
- Notifications / push alerts for dates
- Multi-user / account system
