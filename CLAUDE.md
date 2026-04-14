# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Start Vite dev server with HMR
npm run build        # TypeScript compile + Vite build → outputs to build/
npm run lint         # Run ESLint
npm run preview      # Serve the built output locally
npm test             # Run Vitest once
npm run test:watch   # Run Vitest in watch mode
```

## Architecture

MixPay is a React 19 + TypeScript SPA that uses AI-powered payment optimization. It uses Vite, React Router 7, and Tailwind CSS 4. Deployed to Vercel (`vercel.json` rewrites all routes to `index.html` for client-side routing). Build output goes to `build/` (not `dist/`).

### Route flow

```
/ (Dashboard) → /checkout → /optimizing → /success
```

### Multi-Agent Pipeline

The optimization is handled by a Claude-powered agent pipeline (`src/lib/agents/orchestrator.ts`):

```
Orchestrator (TypeScript)
├── Rates Agent      (Haiku + tool_use → live ARS rates, FCI yields, inflation)
├── Optimization Agent (Opus + extended thinking → true-cost allocation)
├── Risk Agent       (Haiku → transaction safety check)
└── Explanation Agent (Sonnet → Infleta-style insights)
```

**Agent data flow:**
1. `Rates Agent` fetches live data from dolarapi.com + rendimientos.co via `callClaudeWithTools`
2. `Optimization Agent` streams extended thinking while reasoning about fees vs. opportunity cost
3. `Risk Agent` runs in parallel with optimization (doesn't depend on its output)
4. `Explanation Agent` receives everything and generates insights
5. Orchestrator maps `OptimizationAgentResult` → `OptimizationResult` for backward compat

The streaming hook (`src/hooks/useOptimizationStream.ts`) feeds agent events into `Optimizing.tsx` animation.

**No API key?** Falls back to the deterministic greedy optimizer in `src/lib/agents/fallback.ts`.

### Key concept: True Cost (Infleta)

Unlike simple fee minimization, the optimizer considers opportunity cost:
```
trueCost = fee + (amountUSD × yieldRate / 12)
```
Paying a 2.5% card fee can be cheaper than spending USDC earning 5% APY.

### Global state

`SessionContext` (`src/context/SessionContext.tsx`) holds the entire app state:
- `sources` — payment source balances (USD, USDC, ARS, credit card) with `yieldRate`
- `transactions` — history of completed payments
- `applyPayment()` — deducts from sources and appends to transaction history

State is in-memory only; it resets on page reload.

### Key file locations

- `src/lib/agents/` — all 5 agents + types + fallback
- `src/lib/claude-client.ts` — 3 functions: `callClaude`, `callClaudeStreaming`, `callClaudeWithTools`
- `src/lib/optimizer.ts` — deterministic fallback algorithm
- `src/hooks/useOptimizationStream.ts` — maps agent events to React state
- `src/components/InfletaInsightPanel.tsx` — opportunity cost insights on Success page
- `api/` — Vercel serverless routes proxying dolarapi.com + rendimientos.co (CORS)
- `mcp-servers/argentina-finance/` — standalone MCP server for Claude Desktop/Code

### Styling

Pure Tailwind utility classes; no component library. Dark blue theme (`#0F172A` background, `#F59E0B` amber accent), mobile-first (`max-w-sm` containers).

## Environment

Set `VITE_CLAUDE_API_KEY` to enable the AI agent pipeline. The app degrades gracefully without it (uses deterministic optimizer + template insights).

## TypeScript config

Strict mode is on: `noUnusedLocals` and `noUnusedParameters` are enforced. Target is ES2023, module resolution is `bundler`.
