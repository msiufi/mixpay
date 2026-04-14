# MixPay

**AI-powered payment optimization that saves you money on every transaction.**

MixPay analyzes your payment sources (cash, crypto, cards) and finds the cheapest combination — accounting for fees, investment yields, and inflation. It's not just a fee minimizer. It's a financial advisor that knows when paying with your credit card is actually cheaper than spending your invested cash.

## The Problem

You have money in multiple places: dollars, stablecoins, pesos, credit cards. Each has different fees and your balances are earning yield. When you need to pay, choosing wrong costs you money — either in fees or in lost investment returns.

## The Solution

MixPay calculates the **true cost** of each payment source:

```
True Cost = Transaction Fee + Opportunity Cost (yield you lose by spending)
```

A credit card at 2.5% fee can be cheaper than spending pesos earning 29% TNA when inflation is 35% — because those pesos are losing value anyway. MixPay figures this out automatically.

## How It Works

### Multi-Agent Claude Pipeline

MixPay uses 4 specialized Claude agents, each optimized for their task:

| Agent | Model | What It Does |
|-------|-------|-------------|
| **Rates Agent** | Haiku (tool_use) | Fetches live ARS exchange rates, FCI yields, and inflation data |
| **Optimization Agent** | Opus (tool_use) | Computes optimal allocation via math tools, explains reasoning |
| **Risk Agent** | Haiku | Evaluates transaction safety in real-time |
| **Explanation Agent** | Sonnet | Generates personalized investment insights |

The math is always **deterministic and precise** — Claude never does arithmetic. TypeScript math tools handle the calculations, Claude handles the reasoning. The app works without an API key too (same math, template insights).

### Live Financial Data

Real-time data from multiple sources, cached and prefetched:

- **Dollar rates** (oficial + MEP) from dolarapi.com
- **FCI mutual fund yields** from rendimientos.co
- **CER inflation index** from the Argentine Central Bank (BCRA)
- **IPC consumer price index** from INDEC (datos.gob.ar)

### MCP Server

Standalone Model Context Protocol server with 7 tools for use with Claude Desktop or Claude Code:

```bash
cd mcp-servers/argentina-finance && npm install && npm start
```

Tools: `get_dollar_rates`, `get_fci_yields`, `get_inflation_rate`, `get_market_data`, `get_lecap_rates`, `calculate_true_costs`, `allocate_payment`

## Claude API Features Showcased

- **Tool Use** — Rates Agent calls financial APIs; Optimization Agent calls math tools
- **Multi-Model** — Opus for reasoning, Sonnet for explanations, Haiku for fast tasks
- **Streaming SSE** — Real-time animation showing agent progress and tool calls
- **MCP** — Standalone financial data server for Claude Desktop/Code

## Getting Started

```bash
npm install
npm run dev
```

Set `VITE_CLAUDE_API_KEY` in a `.env` file to enable the AI agents:

```
VITE_CLAUDE_API_KEY=sk-ant-...
```

Without the key, the app runs with deterministic optimization (same math, no AI explanations).

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | React 19 + TypeScript |
| Routing | React Router 7 |
| Styling | Tailwind CSS 4 |
| Build | Vite 8 |
| Deploy | Vercel |
| AI | Claude API (Opus 4.6, Sonnet 4.6, Haiku 4.5) |
| Financial Data | dolarapi.com, datos.gob.ar, rendimientos.co |

## Architecture

See [ARCHITECTURE.md](ARCHITECTURE.md) for full technical documentation in Spanish.

## License

MIT
