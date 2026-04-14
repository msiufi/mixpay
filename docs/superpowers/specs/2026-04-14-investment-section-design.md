# Investment Section — Design Spec
**Date:** 2026-04-14
**Project:** MixPay

---

## Overview

Add a new `/invest` page where a Claude-powered AI agent helps users simulate investing a virtual $100 USD credit. The user writes a free-text investment objective; the AI interprets it conversationally, suggests an allocation across MixPay sources and simulated external assets, and refines the strategy through back-and-forth chat.

---

## Architecture

### New files
| File | Purpose |
|------|---------|
| `src/pages/Invest.tsx` | Main page — two-panel layout (chat + portfolio) |
| `src/lib/investment-agent.ts` | Conversation logic with Claude API, allocation parsing |
| `src/lib/investment-assets.ts` | Static list of simulated investable assets |

### Modified files
| File | Change |
|------|--------|
| `src/App.tsx` | Add route `/invest` |
| `src/pages/Dashboard.tsx` | Add "Invest $100" button |
| `src/types/index.ts` | Add `ChatMessage`, `InvestmentAllocation`, `InvestmentAsset` types |

---

## New Types (`src/types/index.ts`)

```typescript
export interface InvestmentAsset {
  id: string
  label: string
  category: 'mixpay' | 'external'
  annualReturnRate: number   // e.g. 0.045 for 4.5%
  riskLevel: 'low' | 'medium' | 'high'
  symbol: string
}

export interface InvestmentAllocation {
  assets: {
    assetId: string
    label: string
    amount: number       // USD
    pct: number          // 0–100
  }[]
  riskLevel: 'low' | 'medium' | 'high'
  projectedReturnUSD: number
  projectedReturnPct: number
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  allocation?: InvestmentAllocation
}
```

---

## Simulated Assets (`src/lib/investment-assets.ts`)

Six investable assets — three from MixPay sources, three external:

| ID | Label | Category | Annual Return | Risk |
|----|-------|----------|---------------|------|
| `usd` | USD Cash | mixpay | 0% | low |
| `usdc` | USDC | mixpay | 0.5% | low |
| `ars` | Pesos ARS | mixpay | 2% (net, inflation-adjusted sim.) | medium |
| `btc` | Bitcoin | external | 40% simulated (high volatility) | high |
| `sp500` | S&P 500 ETF | external | 10% simulated | medium |
| `tbond` | Treasury Bond | external | 4.5% simulated | low |

---

## Investment Agent (`src/lib/investment-agent.ts`)

### System prompt
Injected once at the start of every conversation:

```
You are MixPay's investment advisor AI. The user has $100 virtual USD to allocate.
Available assets: [asset list with IDs, labels, risk, return]
Your job: interpret the user's goal and suggest an allocation.

Rules:
- Allocations must sum to exactly $100.
- When suggesting or updating an allocation, embed it as:
  <!-- ALLOCATION: {"assets":[...],"riskLevel":"...","projectedReturnUSD":X,"projectedReturnPct":X} -->
- Be conversational, concise, and friendly. No markdown.
```

### Parsing
`parseAllocation(text: string): InvestmentAllocation | null`
- Extracts JSON from `<!-- ALLOCATION: {...} -->` using a regex
- Returns `null` if no block found (text-only reply)
- Returns `null` on JSON parse error (graceful degradation)

### Fallback (no API key)
`buildFallbackAllocation(objective: string): InvestmentAllocation`
- Keyword matching on the objective string:
  - "seguro" / "conservador" → 60% tbond, 30% usdc, 10% sp500
  - "crecimiento" / "máximo" → 50% btc, 30% sp500, 20% usdc
  - default / "balance" → 40% tbond, 30% sp500, 20% usdc, 10% btc
- Returns a `ChatMessage` with canned text + the allocation

### Public API
```typescript
export async function sendMessage(
  history: ChatMessage[],
  userText: string,
  assets: InvestmentAsset[],
): Promise<ChatMessage>  // returns the assistant's reply
```

---

## Page Layout (`src/pages/Invest.tsx`)

Two-panel layout, consistent with MixPay's dark theme (`#0F172A` background, amber accent `#F59E0B`):

### Left panel — Chat
- Header: "Agente IA ✦" label
- Scrollable message list (user right-aligned, assistant left-aligned)
- Input bar + send button at bottom
- On submit: appends user message, calls `sendMessage`, appends assistant reply, scrolls to bottom

### Right panel — Portfolio (220px fixed width)
- Section label: "Portafolio"
- Donut chart: CSS `conic-gradient` built from `allocation.assets`, with `$100` center label
- Asset colors for the donut and legend:
  | Asset ID | Color |
  |----------|-------|
  | `usd` | `#22C55E` (green) |
  | `usdc` | `#3B82F6` (blue) |
  | `ars` | `#A78BFA` (violet) |
  | `btc` | `#F59E0B` (amber) |
  | `sp500` | `#10B981` (emerald) |
  | `tbond` | `#6366F1` (indigo) |
- Risk badge: color-coded (green=low, yellow=medium, red=high)
- Projected return card: shows `+$X.XX (~X.XX%)` in amber
- "Confirmar estrategia →" button

### Confirm button behavior
- Disabled until the user has at least one allocation in the chat
- On click: shows a success banner inline ("¡Estrategia confirmada! Tu simulación quedó guardada.")
- No navigation — stays on the same page
- After 3 seconds, button label changes to "Reiniciar simulación"; clicking it resets `messages` to the initial greeting and clears `allocation` back to `null`

### Initial state
- Chat pre-populated with one assistant greeting message (no allocation)
- Portfolio panel shows empty state: "Contale tu objetivo al agente para ver tu portafolio"

---

## Dashboard integration (`src/pages/Dashboard.tsx`)

Add an "Invest $100" button directly below the existing "Simulate Purchase →" CTA, styled consistently (same width, secondary styling — outlined amber border, transparent background).

```tsx
<button onClick={() => navigate('/invest')} className="w-full border border-[#F59E0B] text-[#F59E0B] py-4 rounded-xl font-semibold text-base hover:bg-[#F59E0B]/10 active:scale-95 transition-all">
  Invest $100 →
</button>
```

---

## Error handling

| Scenario | Behavior |
|----------|---------|
| Claude API unavailable (no key) | Fallback allocation + canned text, seamless to user |
| Claude returns no `ALLOCATION` block | Show text reply only, keep previous allocation in right panel |
| JSON parse error in allocation block | Log to console, treat as text-only reply |
| User sends empty message | Send button disabled |

---

## Out of scope

- Persisting investment simulations to `SessionContext` or localStorage
- Real financial data or live prices
- Multiple simultaneous simulations
- Animated chart transitions (donut is static CSS gradient)
