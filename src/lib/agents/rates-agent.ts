// Rates Agent — Claude Haiku with tool_use
// Fetches live ARS exchange rate, FCI yields, and inflation data.

import type { PaymentSource } from '../../types'
import { callClaudeWithTools } from '../claude-client'
import type { ClaudeTool } from '../claude-client'
import type { AgentEvent, EnrichedSource, LiveRates } from './types'

// ── Tool definitions ─────────────────────────────────────────────────

const tools: ClaudeTool[] = [
  {
    name: 'get_ars_exchange_rate',
    description: 'Returns the current ARS/USD blue market exchange rate from dolarapi.com',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_investment_yields',
    description: 'Returns current Argentine FCI (mutual fund) annual yield rates from rendimientos.co',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_inflation_data',
    description: 'Returns latest Argentine CER inflation index from the BCRA',
    input_schema: { type: 'object', properties: {}, required: [] },
  },
]

// ── Tool handlers (browser-safe, with fallbacks) ─────────────────────

async function fetchJson(proxyUrl: string, directUrl: string): Promise<unknown> {
  // Try local/Vercel proxy first (avoids CORS), then direct API, then null
  for (const url of [proxyUrl, directUrl]) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
      if (res.ok) return await res.json()
    } catch { /* CORS or timeout */ }
  }
  return null
}

const toolHandlers: Record<string, (input: Record<string, unknown>) => Promise<unknown>> = {
  get_ars_exchange_rate: async () => {
    const data = await fetchJson(
      '/api/rates?type=blue',
      'https://dolarapi.com/v1/dolares/blue',
    ) as { compra?: number; venta?: number } | null

    if (data?.venta) {
      return { rate: data.venta, buy: data.compra, source: 'dolarapi.com/blue', live: true }
    }
    return { rate: 1400, source: 'fallback', live: false }
  },

  get_investment_yields: async () => {
    const data = await fetchJson(
      '/api/yields?source=config',
      'https://rendimientos.co/api/config',
    ) as Record<string, unknown> | null

    if (data && typeof data === 'object') {
      // /api/config returns { garantizados: [...], especiales: [...], ... } with TNA values
      const allProducts = [
        ...((data.garantizados ?? []) as Record<string, unknown>[]),
        ...((data.especiales ?? []) as Record<string, unknown>[]),
      ]

      const funds = allProducts
        .filter((f) => typeof f.tna === 'number' && f.activo !== false)
        .map((f) => ({
          name: String(f.nombre ?? 'Unknown'),
          tna: Number(f.tna),
          tipo: String(f.tipo ?? ''),
        }))
        .sort((a, b) => b.tna - a.tna)
        .slice(0, 5)

      const bestTna = funds.length > 0 ? funds[0].tna : 40
      return {
        topFunds: funds,
        bestAnnualYield: bestTna / 100,
        source: 'rendimientos.co/config',
        live: true,
      }
    }
    return {
      topFunds: [{ name: 'FCI Money Market (est.)', tna: 40 }],
      bestAnnualYield: 0.40,
      source: 'fallback',
      live: false,
    }
  },

  get_inflation_data: async () => {
    const data = await fetchJson(
      '/api/yields?source=cer',
      'https://rendimientos.co/api/cer-ultimo',
    )

    if (data && typeof data === 'object' && 'valor' in (data as Record<string, unknown>)) {
      return { cer: (data as Record<string, unknown>).valor, source: 'BCRA CER', live: true }
    }
    return { monthlyInflation: 0.029, source: 'fallback', live: false }
  },
}

// ── Agent entry point ────────────────────────────────────────────────

const SYSTEM_PROMPT = `You are MixPay's market data agent. You gather live Argentine financial data.

Instructions:
1. Call ALL three tools: get_ars_exchange_rate, get_investment_yields, get_inflation_data
2. Analyze the results
3. Return ONLY a JSON object (no markdown fences) with this schema:

{
  "arsExchangeRate": <number, ARS per 1 USD>,
  "monthlyInflation": <number, e.g. 0.029 for 2.9%>,
  "yieldRates": {
    "usd": <number, annual yield for USD money market, estimate ~0.042>,
    "usdc": <number, annual yield for USDC DeFi, estimate ~0.051>,
    "ars": <number, best FCI annual yield as decimal>,
    "visa": 0,
    "mastercard": 0
  },
  "fciTopFunds": [{ "name": "<fund name>", "tna": <number, annual rate %> }],
  "marketData": {}
}`

export async function runRatesAgent(
  sources: PaymentSource[],
  onEvent: (e: AgentEvent) => void,
): Promise<{ enrichedSources: EnrichedSource[]; liveRates: LiveRates }> {
  onEvent({ kind: 'agent_start', agentName: 'RatesAgent', timestamp: Date.now() })

  const sourceList = sources.map(s => `${s.id}: ${s.label} (${s.currency}, available: ${s.available})`).join('\n')

  const responseText = await callClaudeWithTools(
    [{ role: 'user', content: `Gather current market data for MixPay. Sources:\n${sourceList}` }],
    tools,
    toolHandlers,
    {
      model: 'claude-haiku-4-5-20251001',
      maxTokens: 1024,
      systemPrompt: SYSTEM_PROMPT,
    },
    (name, input) => {
      onEvent({ kind: 'agent_tool_call', agentName: 'RatesAgent', toolName: name, toolArgs: input, timestamp: Date.now() })
    },
    (name, result) => {
      onEvent({ kind: 'agent_tool_result', agentName: 'RatesAgent', toolName: name, toolResult: result, timestamp: Date.now() })
    },
  )

  // Parse Claude's JSON response
  let parsed: Record<string, unknown> = {}
  try {
    const cleaned = responseText.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
    parsed = JSON.parse(cleaned)
  } catch {
    // Claude didn't return valid JSON — use fallback values
  }

  const arsRate = Number(parsed.arsExchangeRate) || 1400
  const yieldRatesRaw = (parsed.yieldRates ?? {}) as Record<string, number>
  const fciTopFunds = (Array.isArray(parsed.fciTopFunds) ? parsed.fciTopFunds : []) as { name: string; tna: number }[]
  const monthlyInflation = Number(parsed.monthlyInflation) || 0.029

  const liveRates: LiveRates = {
    arsExchangeRate: arsRate,
    fciTopFunds: fciTopFunds.length > 0 ? fciTopFunds : [{ name: 'FCI Money Market (est.)', tna: 40 }],
    monthlyInflation,
    marketData: (parsed.marketData ?? {}) as Record<string, number>,
  }

  // Map sources → enriched sources
  const enrichedSources: EnrichedSource[] = sources.map(s => ({
    ...s,
    effectiveYieldRate: Number(yieldRatesRaw[s.id]) || (s.yieldRate ?? 0),
    liveExchangeRate: s.currency === 'ARS' ? arsRate : undefined,
  }))

  onEvent({ kind: 'agent_done', agentName: 'RatesAgent', timestamp: Date.now() })

  return { enrichedSources, liveRates }
}
