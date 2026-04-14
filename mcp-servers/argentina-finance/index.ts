#!/usr/bin/env node

// MCP Server: Argentina Finance
// Provides real-time Argentine financial data via the Model Context Protocol.
//
// Tools:
//   get_dollar_rates     — All ARS/USD exchange rates (blue, oficial, MEP, CCL, tarjeta, cripto)
//   get_fci_yields       — FCI (mutual fund) annual yields from rendimientos.co
//   get_inflation_rate   — Latest CER inflation index from BCRA
//   get_market_data      — Global market indicators (S&P, Bitcoin, Gold, etc.)
//
// Usage:
//   npx ts-node index.ts          (development)
//   node index.js                 (after tsc build)
//
// Claude Desktop config (claude_desktop_config.json):
//   {
//     "mcpServers": {
//       "argentina-finance": {
//         "command": "node",
//         "args": ["/path/to/mcp-servers/argentina-finance/index.js"]
//       }
//     }
//   }

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'

const server = new McpServer({
  name: 'argentina-finance',
  version: '1.0.0',
})

// ── Helper ───────────────────────────────────────────────────────────

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url, {
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(8000),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)
  return res.json()
}

// ── Tool: get_dollar_rates ───────────────────────────────────────────

server.tool(
  'get_dollar_rates',
  'Returns all ARS/USD exchange rates from dolarapi.com (blue, oficial, MEP, CCL, tarjeta, cripto)',
  {
    type: z.enum(['all', 'blue', 'oficial', 'mep', 'ccl', 'tarjeta', 'cripto']).default('all'),
  },
  async ({ type }) => {
    const endpoints: Record<string, string> = {
      all: 'https://dolarapi.com/v1/dolares',
      blue: 'https://dolarapi.com/v1/dolares/blue',
      oficial: 'https://dolarapi.com/v1/dolares/oficial',
      mep: 'https://dolarapi.com/v1/dolares/bolsa',
      ccl: 'https://dolarapi.com/v1/dolares/contadoconliqui',
      tarjeta: 'https://dolarapi.com/v1/dolares/tarjeta',
      cripto: 'https://dolarapi.com/v1/dolares/cripto',
    }

    try {
      const data = await fetchJson(endpoints[type])
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error fetching dollar rates: ${err}` }], isError: true }
    }
  },
)

// ── Tool: get_fci_yields ─────────────────────────────────────────────

server.tool(
  'get_fci_yields',
  'Returns Argentine FCI (mutual fund) data with calculated TNA (annual nominal rate) from rendimientos.co via CAFCI/ArgentinaDatos',
  {},
  async () => {
    try {
      const data = await fetchJson('https://rendimientos.co/api/fci')
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error fetching FCI data: ${err}` }], isError: true }
    }
  },
)

// ── Tool: get_inflation_rate ─────────────────────────────────────────

server.tool(
  'get_inflation_rate',
  'Returns the latest CER (Coeficiente de Estabilización de Referencia) inflation index value from the Argentine Central Bank (BCRA)',
  {},
  async () => {
    try {
      const data = await fetchJson('https://rendimientos.co/api/cer-ultimo')
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error fetching CER data: ${err}` }], isError: true }
    }
  },
)

// ── Tool: get_market_data ────────────────────────────────────────────

server.tool(
  'get_market_data',
  'Returns real-time global market indicators (S&P 500, Nasdaq, WTI, Gold, Bitcoin, Ethereum, EUR/USD, 10Y USD) from rendimientos.co',
  {},
  async () => {
    try {
      const data = await fetchJson('https://rendimientos.co/api/mundo')
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error fetching market data: ${err}` }], isError: true }
    }
  },
)

// ── Tool: get_lecap_rates ────────────────────────────────────────────

server.tool(
  'get_lecap_rates',
  'Returns live LECAP/BONCAP (Argentine treasury notes) prices with calculated TIR/TNA from rendimientos.co',
  {},
  async () => {
    try {
      const data = await fetchJson('https://rendimientos.co/api/lecaps')
      return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] }
    } catch (err) {
      return { content: [{ type: 'text' as const, text: `Error fetching LECAP data: ${err}` }], isError: true }
    }
  },
)

// ── Tool: calculate_true_costs ────────────────────────────────────────

server.tool(
  'calculate_true_costs',
  'Calculates the true cost (fee + opportunity cost) for each payment source per 1 USD spent. Opportunity cost = annual yield / 12 (monthly). Credit cards have 0 opportunity cost since they use borrowed money. Returns sources ranked cheapest to most expensive.',
  {
    sources: z.array(z.object({
      id: z.string(),
      label: z.string(),
      currency: z.string(),
      available: z.number(),
      feeRate: z.number().describe('Fee rate as decimal, e.g. 0.025 for 2.5%'),
      yieldRate: z.number().describe('Annual yield as decimal, e.g. 0.29 for 29%'),
      kind: z.enum(['balance', 'credit_card']),
      exchangeRate: z.number().optional().describe('For ARS: ARS per 1 USD'),
    })),
  },
  async ({ sources }) => {
    const costs = sources.map(s => {
      const availableUSD = s.currency === 'ARS' && s.exchangeRate
        ? s.available / s.exchangeRate
        : s.available
      const feePerDollar = s.feeRate
      const oppCostPerDollar = s.kind === 'credit_card' ? 0 : s.yieldRate / 12
      const trueCostPerDollar = feePerDollar + oppCostPerDollar
      return {
        ...s,
        availableUSD: parseFloat(availableUSD.toFixed(4)),
        feePerDollar: parseFloat(feePerDollar.toFixed(6)),
        opportunityCostPerDollar: parseFloat(oppCostPerDollar.toFixed(6)),
        trueCostPerDollar: parseFloat(trueCostPerDollar.toFixed(6)),
      }
    }).sort((a, b) => a.trueCostPerDollar - b.trueCostPerDollar)

    return { content: [{ type: 'text' as const, text: JSON.stringify(costs, null, 2) }] }
  },
)

// ── Tool: allocate_payment ───────────────────────────────────────────

server.tool(
  'allocate_payment',
  'Allocates a USD payment across sources in the given priority order, handling fees and currency conversion precisely. Returns exact amounts, fees, and opportunity costs for each source used.',
  {
    amountUSD: z.number().describe('Total payment amount in USD'),
    sourceOrder: z.array(z.string()).describe('Source IDs in priority order'),
    sources: z.array(z.object({
      id: z.string(),
      label: z.string(),
      symbol: z.string().default('$'),
      currency: z.string(),
      available: z.number(),
      feeRate: z.number(),
      yieldRate: z.number(),
      kind: z.enum(['balance', 'credit_card']),
      exchangeRate: z.number().optional(),
    })),
  },
  async ({ amountUSD, sourceOrder, sources }) => {
    let remaining = amountUSD
    const allocations = []

    for (const sid of sourceOrder) {
      if (remaining < 0.01) break
      const s = sources.find(src => src.id === sid)
      if (!s) continue

      let usedUSD: number
      let amountOriginal: number
      const rate = s.exchangeRate ?? 1

      if (s.currency === 'ARS' && s.exchangeRate) {
        const availableUSD = s.available / rate
        const maxUSD = availableUSD / (1 + s.feeRate)
        usedUSD = Math.min(remaining, parseFloat(maxUSD.toFixed(6)))
        if (usedUSD <= 0) continue
        amountOriginal = parseFloat((usedUSD * (1 + s.feeRate) * rate).toFixed(2))
      } else {
        const maxUSD = s.available / (1 + s.feeRate)
        usedUSD = Math.min(remaining, parseFloat(maxUSD.toFixed(6)))
        if (usedUSD <= 0) continue
        amountOriginal = parseFloat((usedUSD * (1 + s.feeRate)).toFixed(6))
      }

      const fee = parseFloat((usedUSD * s.feeRate).toFixed(6))
      const oppCost = s.kind === 'credit_card' ? 0 : parseFloat((usedUSD * s.yieldRate / 12).toFixed(6))

      allocations.push({
        sourceId: s.id, label: s.label, symbol: s.symbol, currency: s.currency,
        amountUSD: parseFloat(usedUSD.toFixed(6)), amountOriginal,
        fee, feeRate: s.feeRate, opportunityCostUSD: oppCost,
        trueCostUSD: parseFloat((fee + oppCost).toFixed(6)),
      })

      remaining = parseFloat((remaining - usedUSD).toFixed(6))
    }

    const result = {
      allocations,
      totalUSD: parseFloat(allocations.reduce((s, a) => s + a.amountUSD, 0).toFixed(6)),
      totalFees: parseFloat(allocations.reduce((s, a) => s + a.fee, 0).toFixed(6)),
      totalOpportunityCost: parseFloat(allocations.reduce((s, a) => s + a.opportunityCostUSD, 0).toFixed(6)),
      success: remaining < 0.01,
    }

    return { content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }] }
  },
)

// ── Start server ─────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport()
  await server.connect(transport)
  console.error('MCP Argentina Finance server running on stdio')
}

main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
