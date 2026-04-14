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
