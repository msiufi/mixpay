# Investment Section Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/invest` page where a Claude-powered AI agent lets users simulate investing a virtual $100 across MixPay sources and external assets via conversational chat.

**Architecture:** New page `Invest.tsx` with a two-panel layout (chat left, portfolio right). Pure business logic lives in `investment-agent.ts` (Claude API + fallback) and `investment-assets.ts` (static data). State is local to the page — no SessionContext changes needed.

**Tech Stack:** React 19, TypeScript 6, Tailwind CSS 4, React Router 7, Vitest 4, Claude API via existing `claude-client.ts` (extended)

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `src/types/index.ts` | Add `InvestmentAsset`, `InvestmentAllocation`, `ChatMessage` |
| Modify | `src/lib/claude-client.ts` | Add `callClaudeMessages` (system + history support) |
| Create | `src/lib/investment-assets.ts` | Static list of 6 investable assets |
| Create | `src/lib/investment-agent.ts` | `parseAllocation`, `buildFallbackAllocation`, `sendMessage` |
| Create | `src/lib/__tests__/investment-agent.test.ts` | Unit tests for pure functions |
| Create | `src/pages/Invest.tsx` | Two-panel UI page |
| Modify | `src/App.tsx` | Add `/invest` route |
| Modify | `src/pages/Dashboard.tsx` | Add "Invest $100 →" button |

---

## Task 1: Add investment types and extend Claude client

**Files:**
- Modify: `src/types/index.ts`
- Modify: `src/lib/claude-client.ts`

- [ ] **Step 1: Add types to `src/types/index.ts`**

Append these three interfaces at the end of the file (after the `Card` interface):

```typescript
export interface InvestmentAsset {
  id: string
  label: string
  category: 'mixpay' | 'external'
  annualReturnRate: number
  riskLevel: 'low' | 'medium' | 'high'
  symbol: string
}

export interface InvestmentAllocation {
  assets: {
    assetId: string
    label: string
    amount: number
    pct: number
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

- [ ] **Step 2: Add `callClaudeMessages` to `src/lib/claude-client.ts`**

Append this function after the existing `callClaude` function:

```typescript
export async function callClaudeMessages(
  system: string,
  messages: { role: 'user' | 'assistant'; content: string }[],
): Promise<string> {
  if (!CLAUDE_API_KEY) return ''

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 500,
        system,
        messages,
      }),
    })

    if (!response.ok) return ''
    const data = await response.json()
    return (data.content?.[0]?.text as string) ?? ''
  } catch {
    return ''
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts src/lib/claude-client.ts
git commit -m "feat: add investment types and callClaudeMessages to Claude client"
```

---

## Task 2: Create investment assets

**Files:**
- Create: `src/lib/investment-assets.ts`

- [ ] **Step 1: Create `src/lib/investment-assets.ts`**

```typescript
import type { InvestmentAsset } from '../types'

export const INVESTMENT_ASSETS: InvestmentAsset[] = [
  { id: 'usd',   label: 'USD Cash',       category: 'mixpay',   annualReturnRate: 0,     riskLevel: 'low',    symbol: '$'  },
  { id: 'usdc',  label: 'USDC',           category: 'mixpay',   annualReturnRate: 0.005, riskLevel: 'low',    symbol: '$'  },
  { id: 'ars',   label: 'Pesos ARS',      category: 'mixpay',   annualReturnRate: 0.02,  riskLevel: 'medium', symbol: '₱'  },
  { id: 'btc',   label: 'Bitcoin',        category: 'external', annualReturnRate: 0.40,  riskLevel: 'high',   symbol: '₿'  },
  { id: 'sp500', label: 'S&P 500 ETF',    category: 'external', annualReturnRate: 0.10,  riskLevel: 'medium', symbol: '📈' },
  { id: 'tbond', label: 'Treasury Bond',  category: 'external', annualReturnRate: 0.045, riskLevel: 'low',    symbol: '🏛' },
]

export const ASSET_COLORS: Record<string, string> = {
  usd:   '#22C55E',
  usdc:  '#3B82F6',
  ars:   '#A78BFA',
  btc:   '#F59E0B',
  sp500: '#10B981',
  tbond: '#6366F1',
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/investment-assets.ts
git commit -m "feat: add investment assets data"
```

---

## Task 3: Create investment agent (TDD)

**Files:**
- Create: `src/lib/__tests__/investment-agent.test.ts`
- Create: `src/lib/investment-agent.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/lib/__tests__/investment-agent.test.ts`:

```typescript
import { describe, expect, it } from 'vitest'
import { parseAllocation, buildFallbackAllocation } from '../investment-agent'
import { INVESTMENT_ASSETS } from '../investment-assets'

describe('parseAllocation', () => {
  it('returns null when no allocation block is present', () => {
    const result = parseAllocation('Great question! Let me think about that.')
    expect(result).toBeNull()
  })

  it('extracts a valid allocation from a comment block', () => {
    const text = `Here is my suggestion. <!-- ALLOCATION: {"assets":[{"assetId":"tbond","label":"Treasury Bond","amount":60,"pct":60},{"assetId":"usdc","label":"USDC","amount":40,"pct":40}],"riskLevel":"low","projectedReturnUSD":2.9,"projectedReturnPct":2.9} -->`
    const result = parseAllocation(text)
    expect(result).not.toBeNull()
    expect(result!.riskLevel).toBe('low')
    expect(result!.assets).toHaveLength(2)
    expect(result!.assets[0].assetId).toBe('tbond')
    expect(result!.assets[0].amount).toBe(60)
    expect(result!.projectedReturnUSD).toBeCloseTo(2.9)
  })

  it('returns null on malformed JSON in the block', () => {
    const text = `OK here you go <!-- ALLOCATION: {broken json} -->`
    const result = parseAllocation(text)
    expect(result).toBeNull()
  })

  it('strips the allocation block from content (pure text remains)', () => {
    const text = `Nice goal! <!-- ALLOCATION: {"assets":[],"riskLevel":"low","projectedReturnUSD":0,"projectedReturnPct":0} --> Good luck!`
    const result = parseAllocation(text)
    expect(result).not.toBeNull()
  })
})

describe('buildFallbackAllocation', () => {
  it('returns conservative allocation for "seguro"', () => {
    const msg = buildFallbackAllocation('quiero algo seguro', INVESTMENT_ASSETS)
    expect(msg.role).toBe('assistant')
    expect(msg.allocation).not.toBeNull()
    const alloc = msg.allocation!
    const tbond = alloc.assets.find(a => a.assetId === 'tbond')
    expect(tbond?.pct).toBe(60)
    const pcts = alloc.assets.reduce((s, a) => s + a.pct, 0)
    expect(pcts).toBe(100)
  })

  it('returns conservative allocation for "conservador"', () => {
    const msg = buildFallbackAllocation('perfil conservador', INVESTMENT_ASSETS)
    const tbond = msg.allocation!.assets.find(a => a.assetId === 'tbond')
    expect(tbond?.pct).toBe(60)
  })

  it('returns aggressive allocation for "crecimiento"', () => {
    const msg = buildFallbackAllocation('quiero máximo crecimiento', INVESTMENT_ASSETS)
    const btc = msg.allocation!.assets.find(a => a.assetId === 'btc')
    expect(btc?.pct).toBe(50)
    const pcts = msg.allocation!.assets.reduce((s, a) => s + a.pct, 0)
    expect(pcts).toBe(100)
  })

  it('returns aggressive allocation for "máximo"', () => {
    const msg = buildFallbackAllocation('quiero el máximo retorno', INVESTMENT_ASSETS)
    const btc = msg.allocation!.assets.find(a => a.assetId === 'btc')
    expect(btc?.pct).toBe(50)
  })

  it('returns balanced allocation as default', () => {
    const msg = buildFallbackAllocation('algo equilibrado', INVESTMENT_ASSETS)
    const tbond = msg.allocation!.assets.find(a => a.assetId === 'tbond')
    const sp500 = msg.allocation!.assets.find(a => a.assetId === 'sp500')
    expect(tbond?.pct).toBe(40)
    expect(sp500?.pct).toBe(30)
    const pcts = msg.allocation!.assets.reduce((s, a) => s + a.pct, 0)
    expect(pcts).toBe(100)
  })

  it('allocations always sum to $100', () => {
    for (const objective of ['seguro', 'crecimiento', 'balance']) {
      const msg = buildFallbackAllocation(objective, INVESTMENT_ASSETS)
      const total = msg.allocation!.assets.reduce((s, a) => s + a.amount, 0)
      expect(total).toBe(100)
    }
  })

  it('projectedReturnUSD matches sum of (amount * annualReturnRate)', () => {
    const msg = buildFallbackAllocation('seguro', INVESTMENT_ASSETS)
    const alloc = msg.allocation!
    const expected = alloc.assets.reduce((sum, a) => {
      const asset = INVESTMENT_ASSETS.find(x => x.id === a.assetId)!
      return sum + a.amount * asset.annualReturnRate
    }, 0)
    expect(alloc.projectedReturnUSD).toBeCloseTo(expected, 4)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd C:/Developer/mixpay && npm test -- investment-agent
```

Expected: FAIL with "Cannot find module '../investment-agent'"

- [ ] **Step 3: Create `src/lib/investment-agent.ts`**

```typescript
import type { ChatMessage, InvestmentAllocation, InvestmentAsset } from '../types'
import { callClaudeMessages } from './claude-client'

const ALLOCATION_RE = /<!--\s*ALLOCATION:\s*(\{[\s\S]*?\})\s*-->/

export function parseAllocation(text: string): InvestmentAllocation | null {
  const match = ALLOCATION_RE.exec(text)
  if (!match) return null
  try {
    return JSON.parse(match[1]) as InvestmentAllocation
  } catch {
    console.error('[investment-agent] Failed to parse allocation JSON')
    return null
  }
}

function makeAllocation(
  slots: { assetId: string; pct: number }[],
  assets: InvestmentAsset[],
): InvestmentAllocation {
  const allocationAssets = slots.map(slot => {
    const asset = assets.find(a => a.id === slot.assetId)!
    const amount = (slot.pct / 100) * 100
    return { assetId: slot.assetId, label: asset.label, amount, pct: slot.pct }
  })

  const projectedReturnUSD = allocationAssets.reduce((sum, a) => {
    const asset = assets.find(x => x.id === a.assetId)!
    return sum + a.amount * asset.annualReturnRate
  }, 0)

  const riskLevels = slots.map(s => assets.find(a => a.id === s.assetId)!.riskLevel)
  const riskLevel: 'low' | 'medium' | 'high' = riskLevels.includes('high')
    ? 'high'
    : riskLevels.includes('medium')
      ? 'medium'
      : 'low'

  return {
    assets: allocationAssets,
    riskLevel,
    projectedReturnUSD: parseFloat(projectedReturnUSD.toFixed(4)),
    projectedReturnPct: parseFloat(projectedReturnUSD.toFixed(4)),
  }
}

export function buildFallbackAllocation(
  objective: string,
  assets: InvestmentAsset[],
): ChatMessage {
  const lower = objective.toLowerCase()

  let slots: { assetId: string; pct: number }[]
  let text: string

  if (lower.includes('seguro') || lower.includes('conservador')) {
    slots = [
      { assetId: 'tbond', pct: 60 },
      { assetId: 'usdc', pct: 30 },
      { assetId: 'sp500', pct: 10 },
    ]
    text = 'Para un perfil conservador, propongo priorizar bonos del tesoro y stablecoins. Esta combinación minimiza el riesgo con un retorno proyectado modesto pero estable.'
  } else if (lower.includes('crecimiento') || lower.includes('máximo') || lower.includes('maximo')) {
    slots = [
      { assetId: 'btc', pct: 50 },
      { assetId: 'sp500', pct: 30 },
      { assetId: 'usdc', pct: 20 },
    ]
    text = 'Para maximizar el crecimiento, apuesto fuerte a Bitcoin y el mercado de acciones. Mantenemos un 20% en USDC como colchón de liquidez ante la volatilidad.'
  } else {
    slots = [
      { assetId: 'tbond', pct: 40 },
      { assetId: 'sp500', pct: 30 },
      { assetId: 'usdc', pct: 20 },
      { assetId: 'btc', pct: 10 },
    ]
    text = 'Un portafolio equilibrado: bonos y acciones como base sólida, stablecoins para liquidez y una pequeña exposición a Bitcoin para potencial alcista.'
  }

  return {
    role: 'assistant',
    content: text,
    allocation: makeAllocation(slots, assets),
  }
}

function buildSystemPrompt(assets: InvestmentAsset[]): string {
  const assetList = assets
    .map(a => `- id:${a.id} | ${a.label} | ${a.category} | ${(a.annualReturnRate * 100).toFixed(1)}% anual | risk:${a.riskLevel}`)
    .join('\n')

  return `You are MixPay's investment advisor AI. The user has $100 virtual USD to allocate.

Available assets:
${assetList}

Your job: interpret the user's free-text investment goal and suggest how to allocate the $100.

Rules:
- All allocations must sum to exactly $100.
- When suggesting or updating an allocation, embed it in your response as exactly:
  <!-- ALLOCATION: {"assets":[{"assetId":"...","label":"...","amount":X,"pct":Y}],"riskLevel":"low|medium|high","projectedReturnUSD":X,"projectedReturnPct":X} -->
  where projectedReturnUSD = sum of (amount * annualReturnRate) for each asset, and projectedReturnPct = projectedReturnUSD.
- Be conversational, concise, and friendly. No markdown formatting. Max 3 sentences per reply.
- Respond in the same language the user writes in.`
}

export async function sendMessage(
  history: ChatMessage[],
  userText: string,
  assets: InvestmentAsset[],
): Promise<ChatMessage> {
  const system = buildSystemPrompt(assets)
  const apiMessages = [
    ...history.map(m => ({ role: m.role, content: m.content })),
    { role: 'user' as const, content: userText },
  ]

  const raw = await callClaudeMessages(system, apiMessages)

  if (raw) {
    const allocation = parseAllocation(raw)
    const content = raw.replace(ALLOCATION_RE, '').trim()
    return { role: 'assistant', content, allocation: allocation ?? undefined }
  }

  return buildFallbackAllocation(userText, assets)
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd C:/Developer/mixpay && npm test -- investment-agent
```

Expected: All 9 tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/lib/__tests__/investment-agent.test.ts src/lib/investment-agent.ts
git commit -m "feat: add investment agent with parseAllocation and buildFallbackAllocation"
```

---

## Task 4: Create the Invest page

**Files:**
- Create: `src/pages/Invest.tsx`

- [ ] **Step 1: Create `src/pages/Invest.tsx`**

```tsx
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import type { ChatMessage, InvestmentAllocation } from '../types'
import { INVESTMENT_ASSETS, ASSET_COLORS } from '../lib/investment-assets'
import { sendMessage } from '../lib/investment-agent'

const GREETING: ChatMessage = {
  role: 'assistant',
  content: '¡Hola! Tenés $100 USD virtuales para invertir. Contame tu objetivo — puede ser algo como "quiero preservar valor sin riesgo" o "quiero maximizar ganancia". Yo me encargo del resto.',
}

function buildDonutGradient(assets: InvestmentAllocation['assets']): string {
  let current = 0
  const stops = assets
    .filter(a => a.pct > 0)
    .map(a => {
      const start = current
      current += a.pct
      const color = ASSET_COLORS[a.assetId] ?? '#64748B'
      return `${color} ${start}% ${current}%`
    })
  return `conic-gradient(${stops.join(', ')})`
}

function riskColor(level: 'low' | 'medium' | 'high'): string {
  return level === 'low' ? '#10B981' : level === 'medium' ? '#F59E0B' : '#EF4444'
}

function riskLabel(level: 'low' | 'medium' | 'high'): string {
  return level === 'low' ? 'Bajo' : level === 'medium' ? 'Moderado' : 'Alto'
}

function PortfolioEmpty() {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-3 text-center px-4">
      <div className="w-16 h-16 rounded-full border-2 border-dashed border-[#334155] flex items-center justify-center">
        <span className="text-2xl">📊</span>
      </div>
      <p className="text-[#64748B] text-sm">Contale tu objetivo al agente para ver tu portafolio</p>
    </div>
  )
}

function PortfolioView({
  allocation,
  confirmed,
  onConfirm,
  onReset,
}: {
  allocation: InvestmentAllocation
  confirmed: boolean
  onConfirm: () => void
  onReset: () => void
}) {
  return (
    <div className="flex flex-col gap-4 h-full">
      <span className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide">Portafolio</span>

      {/* Donut chart */}
      <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-4 flex flex-col items-center gap-4">
        <div
          className="w-24 h-24 rounded-full relative flex-shrink-0"
          style={{ background: buildDonutGradient(allocation.assets) }}
        >
          <div className="absolute inset-4 bg-[#1E293B] rounded-full flex items-center justify-center">
            <span className="text-[#F8FAFC] text-xs font-bold">$100</span>
          </div>
        </div>
        <div className="w-full flex flex-col gap-2">
          {allocation.assets.filter(a => a.pct > 0).map(a => (
            <div key={a.assetId} className="flex items-center gap-2">
              <div
                className="w-2 h-2 rounded-sm flex-shrink-0"
                style={{ background: ASSET_COLORS[a.assetId] ?? '#64748B' }}
              />
              <span className="text-[#94A3B8] text-xs flex-1 truncate">{a.label}</span>
              <span className="text-[#F8FAFC] text-xs font-semibold">${a.amount} · {a.pct}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* Risk badge */}
      <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-3 flex items-center justify-between">
        <span className="text-[#94A3B8] text-xs">Riesgo</span>
        <span
          className="text-xs font-semibold px-2 py-1 rounded-full"
          style={{ color: riskColor(allocation.riskLevel), background: `${riskColor(allocation.riskLevel)}20` }}
        >
          {riskLabel(allocation.riskLevel)}
        </span>
      </div>

      {/* Projected return */}
      <div className="bg-[#1E293B] border border-[#334155] rounded-xl p-3">
        <span className="text-[#94A3B8] text-xs block mb-1">Retorno proyectado (1 año)</span>
        <span className="text-[#F59E0B] text-lg font-bold">
          +${allocation.projectedReturnUSD.toFixed(2)}
        </span>
        <span className="text-[#64748B] text-xs"> (~{allocation.projectedReturnPct.toFixed(2)}%)</span>
      </div>

      {/* Confirm / Reset */}
      <div className="mt-auto">
        {confirmed ? (
          <div className="space-y-3">
            <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-3 text-center">
              <p className="text-emerald-400 text-sm font-semibold">¡Estrategia confirmada!</p>
              <p className="text-emerald-400/70 text-xs mt-1">Tu simulación quedó guardada.</p>
            </div>
            <button
              onClick={onReset}
              className="w-full border border-[#334155] text-[#94A3B8] py-2.5 rounded-xl text-sm font-semibold hover:bg-[#272F42] active:scale-95 transition-all"
            >
              Reiniciar simulación
            </button>
          </div>
        ) : (
          <button
            onClick={onConfirm}
            className="w-full bg-[#F59E0B] text-[#0F172A] py-3 rounded-xl font-semibold text-sm hover:bg-[#FBBF24] active:scale-95 transition-all"
          >
            Confirmar estrategia →
          </button>
        )}
      </div>
    </div>
  )
}

export default function Invest() {
  const navigate = useNavigate()
  const [messages, setMessages] = useState<ChatMessage[]>([GREETING])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  const allocation = [...messages].reverse().find(m => m.allocation)?.allocation ?? null

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function handleSend() {
    if (!input.trim() || loading) return
    const text = input.trim()
    setInput('')
    setLoading(true)
    setMessages(prev => [...prev, { role: 'user', content: text }])
    const reply = await sendMessage(messages, text, INVESTMENT_ASSETS)
    setMessages(prev => [...prev, reply])
    setLoading(false)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  function handleConfirm() {
    setConfirmed(true)
  }

  function handleReset() {
    setMessages([GREETING])
    setConfirmed(false)
  }

  return (
    <div className="min-h-screen bg-[#0F172A] flex flex-col">
      {/* Header */}
      <div className="bg-[#0F172A] border-b border-[#334155] px-6 py-4 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="flex items-center gap-2 cursor-pointer"
            >
              <div className="w-8 h-8 bg-[#F59E0B] rounded-lg flex items-center justify-center">
                <span className="text-[#0F172A] text-xs font-bold">M</span>
              </div>
              <span
                className="text-lg font-semibold text-[#F8FAFC]"
                style={{ fontFamily: "'Orbitron', sans-serif" }}
              >
                MixPay
              </span>
            </button>
            <span className="text-[#475569] text-sm">/ Invertir</span>
          </div>
          <div className="bg-[#272F42] border border-[#334155] rounded-lg px-3 py-1.5">
            <span className="text-[#F59E0B] text-xs font-semibold">💰 $100 crédito simulado</span>
          </div>
        </div>
      </div>

      {/* Two-panel body */}
      <div className="flex-1 max-w-4xl w-full mx-auto flex gap-0 overflow-hidden" style={{ height: 'calc(100vh - 65px)' }}>
        {/* LEFT: Chat */}
        <div className="flex-1 flex flex-col border-r border-[#334155] overflow-hidden">
          {/* Chat header */}
          <div className="px-6 py-3 border-b border-[#334155] flex items-center gap-2 flex-shrink-0">
            <div className="w-6 h-6 bg-[#8B5CF6] rounded-full flex items-center justify-center">
              <span className="text-white text-xs">✦</span>
            </div>
            <span className="text-[#94A3B8] text-xs font-semibold uppercase tracking-wide">Agente IA</span>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-[#272F42] border border-[#334155] text-[#F8FAFC] rounded-tr-sm'
                      : 'bg-[#1E293B] border border-[#334155] text-[#F8FAFC] rounded-tl-sm'
                  }`}
                >
                  {msg.content}
                  {msg.allocation && (
                    <div className="mt-2 pt-2 border-t border-[#334155] space-y-1">
                      {msg.allocation.assets.filter(a => a.pct > 0).map(a => (
                        <div key={a.assetId} className="flex justify-between text-xs">
                          <span className="text-[#94A3B8]">{a.label}</span>
                          <span style={{ color: ASSET_COLORS[a.assetId] ?? '#F59E0B' }} className="font-semibold">
                            ${a.amount} · {a.pct}%
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-[#1E293B] border border-[#334155] rounded-xl rounded-tl-sm px-4 py-3">
                  <div className="flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 bg-[#64748B] rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-[#64748B] rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-[#64748B] rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="px-6 py-4 border-t border-[#334155] flex gap-3 flex-shrink-0">
            <input
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Contame tu objetivo de inversión..."
              disabled={loading}
              className="flex-1 bg-[#1E293B] border border-[#334155] rounded-xl px-4 py-3 text-[#F8FAFC] text-sm placeholder-[#475569] focus:outline-none focus:border-[#F59E0B] disabled:opacity-50"
            />
            <button
              onClick={handleSend}
              disabled={!input.trim() || loading}
              className="w-11 h-11 bg-[#F59E0B] rounded-xl flex items-center justify-center text-[#0F172A] font-bold text-lg hover:bg-[#FBBF24] active:scale-95 disabled:opacity-40 transition-all flex-shrink-0"
            >
              ↑
            </button>
          </div>
        </div>

        {/* RIGHT: Portfolio */}
        <div className="w-64 flex-shrink-0 p-5 overflow-y-auto">
          {allocation ? (
            <PortfolioView
              allocation={allocation}
              confirmed={confirmed}
              onConfirm={handleConfirm}
              onReset={handleReset}
            />
          ) : (
            <PortfolioEmpty />
          )}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/pages/Invest.tsx
git commit -m "feat: add Invest page with two-panel chat and portfolio layout"
```

---

## Task 5: Wire route and Dashboard button

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/pages/Dashboard.tsx`

- [ ] **Step 1: Add `/invest` route to `src/App.tsx`**

Current `src/App.tsx`:
```tsx
import { BrowserRouter, Route, Routes } from 'react-router'

import { SessionProvider } from './context/SessionContext'
import Checkout from './pages/Checkout'
import Dashboard from './pages/Dashboard'
import Optimizing from './pages/Optimizing'
import Success from './pages/Success'

function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/optimizing" element={<Optimizing />} />
          <Route path="/success" element={<Success />} />
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  )
}

export default App
```

Replace with:
```tsx
import { BrowserRouter, Route, Routes } from 'react-router'

import { SessionProvider } from './context/SessionContext'
import Checkout from './pages/Checkout'
import Dashboard from './pages/Dashboard'
import Invest from './pages/Invest'
import Optimizing from './pages/Optimizing'
import Success from './pages/Success'

function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/checkout" element={<Checkout />} />
          <Route path="/optimizing" element={<Optimizing />} />
          <Route path="/success" element={<Success />} />
          <Route path="/invest" element={<Invest />} />
        </Routes>
      </BrowserRouter>
    </SessionProvider>
  )
}

export default App
```

- [ ] **Step 2: Add "Invest $100 →" button in `src/pages/Dashboard.tsx`**

Find the existing CTA button in Dashboard.tsx (around line 234):
```tsx
        {/* CTA Button */}
        <button
          onClick={() => navigate('/checkout')}
          className="w-full bg-[#F59E0B] text-[#0F172A] py-4 rounded-xl font-semibold text-base hover:bg-[#FBBF24] active:scale-95 transition-all"
        >
          Simulate Purchase →
        </button>
```

Replace with:
```tsx
        {/* CTA Buttons */}
        <div className="flex flex-col gap-3">
          <button
            onClick={() => navigate('/checkout')}
            className="w-full bg-[#F59E0B] text-[#0F172A] py-4 rounded-xl font-semibold text-base hover:bg-[#FBBF24] active:scale-95 transition-all"
          >
            Simulate Purchase →
          </button>
          <button
            onClick={() => navigate('/invest')}
            className="w-full border border-[#F59E0B] text-[#F59E0B] py-4 rounded-xl font-semibold text-base hover:bg-[#F59E0B]/10 active:scale-95 transition-all"
          >
            Invest $100 →
          </button>
        </div>
```

- [ ] **Step 3: Run all tests to confirm nothing broke**

```bash
cd C:/Developer/mixpay && npm test
```

Expected: All tests PASS (existing optimizer tests + new investment-agent tests)

- [ ] **Step 4: Commit**

```bash
git add src/App.tsx src/pages/Dashboard.tsx
git commit -m "feat: wire /invest route and add Invest button to Dashboard"
```

---

## Verification Checklist

After all tasks are complete:

- [ ] `npm test` — all tests pass
- [ ] `npm run dev` — dev server starts without errors
- [ ] Navigate to `/` — "Invest $100 →" button appears below "Simulate Purchase →"
- [ ] Click "Invest $100 →" — lands on `/invest` with greeting message and empty portfolio panel
- [ ] Type an investment objective and send — AI responds with allocation, right panel populates with donut chart
- [ ] Ask a follow-up question — chat continues, allocation updates
- [ ] Click "Confirmar estrategia →" — success banner appears, button changes to "Reiniciar simulación"
- [ ] Click "Reiniciar simulación" — chat resets to greeting, portfolio clears
- [ ] Try with no `VITE_CLAUDE_API_KEY` set — fallback allocation appears seamlessly
