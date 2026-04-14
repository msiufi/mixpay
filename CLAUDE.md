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

MixPay is a React 19 + TypeScript SPA that uses AI-powered payment optimization. Vite, React Router 7, Tailwind CSS 4. Deployed to Vercel. Build output goes to `build/` (not `dist/`).

### Route flow

```
/ (Dashboard) → /checkout → /optimizing → /success
                                                → /pro (upgrade page)
```

### Multi-Agent Pipeline

The optimization is handled by a pipeline (`src/lib/agents/orchestrator.ts`):

```
Orchestrator (TypeScript)
├── Rates Agent      (Haiku + tool_use → live ARS rates, FCI yields, inflation)
├── Optimization Agent (Opus + math tools → deterministic allocation + AI reasoning)
├── Risk Agent       (Haiku → transaction safety check)
└── Explanation Agent (Sonnet → smart investment insights)
```

**Math is always deterministic** — `src/lib/agents/math-tools.ts` computes the allocation. Claude only explains the reasoning. Without an API key, the exact same math runs — only explanations fall back to templates.

**True cost formula**: `trueCost = fee + (realYield / 12)` where `realYield = nominalYield - inflation`. ARS uses Argentine inflation (~35%/yr), USD/USDC use US inflation (~3%/yr). Credit cards have 0 opportunity cost.

### Live data

Rates are prefetched on Dashboard load (`src/lib/rates-cache.ts`), cached 2 minutes:
- Dollar rates (oficial + MEP) from dolarapi.com
- FCI yields from rendimientos.co
- CER index from rendimientos.co
- IPC inflation from INDEC (datos.gob.ar)

CORS solved via Vite proxy (dev) and Vercel serverless functions (prod) in `api/`.

### State persistence

`SessionContext` persists sources + transactions to localStorage. Survives F5. Reset button clears all.

### Key file locations

- `src/lib/agents/` — all agents + math tools + types + fallback
- `src/lib/claude-client.ts` — 3 functions: `callClaude`, `callClaudeStreaming`, `callClaudeWithTools`
- `src/lib/config.ts` — all configurable values (models, commission, inflation rates)
- `src/lib/format.ts` — `fmt()` helper for es-AR number formatting
- `src/lib/rates-cache.ts` — live data fetching + caching
- `src/hooks/useOptimizationStream.ts` — maps agent events to React state
- `src/components/SmartInsightPanel.tsx` — investment insights on Success page
- `api/` — Vercel serverless routes proxying external APIs
- `mcp-servers/argentina-finance/` — standalone MCP server for Claude Desktop/Code

### Styling

Tailwind CSS, dark theme (`#0F172A` bg, `#F59E0B` amber accent), mobile-first. All numbers use `es-AR` locale via `fmt()`.

## Environment

Set `VITE_CLAUDE_API_KEY` to enable the AI agents. The app works without it (deterministic math + template insights).

## TypeScript config

Strict mode: `noUnusedLocals` and `noUnusedParameters` enforced. Target ES2023, bundler resolution.
