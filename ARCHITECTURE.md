# MixPay — Technical Documentation

## What is MixPay

MixPay is an AI-powered payment optimization app. Instead of paying with a single source (card, cash, crypto), MixPay analyzes all your payment sources and picks the **optimal combination** considering fees, yields, AND the inflation rate of each currency.

**Key concept (True Cost):** Sometimes it's cheaper to pay with a credit card (2.5% fee) and keep your pesos invested, than to spend those pesos that are losing value to inflation.

---

## What AI Does vs. What Math Does

The **math is always the same** — with or without a Claude API key. What AI adds is the explanation and personalization layer.

| Feature | Without API key | With API key |
|---------|----------------|-------------|
| **Live rates** | Direct HTTP fetch (dolarapi, INDEC, rendimientos) | Same — cache handles it |
| **True cost ranking** | Math tools compute optimal order | Same — same math tools |
| **Payment allocation** | Math tools compute exact amounts | Same — same math tools |
| **Reasoning** | Generic text | **Opus explains WHY** each source was chosen |
| **Risk evaluation** | Always "low risk" | **Haiku evaluates** if the transaction is unusual |
| **Investment insights** | Template with FCI data | **Sonnet generates** personalized recommendations with product names and inflation comparison |
| **Dashboard explanation** | Template text | **Claude generates** personalized explanation per transaction |

**Summary:** AI doesn't do the math (it's deterministic and precise). AI **explains, evaluates, and recommends**.

---

## Multi-Agent Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Orchestrator                          │
│              (src/lib/agents/orchestrator.ts)             │
│                                                          │
│  Step 1: Resolve rates (cache → fetch → Rates Agent)     │
│  Step 2: Optimization + Risk (in parallel)               │
│  Step 3: Explanation                                     │
└────────┬──────────────┬──────────────┬───────────────────┘
         │              │              │
         ▼              ▼              ▼
   ┌───────────┐  ┌───────────┐  ┌───────────┐
   │   Rates   │  │ Optimize  │  │   Risk    │
   │   Agent   │  │   Agent   │  │   Agent   │
   │  (Haiku)  │  │  (Opus)   │  │  (Haiku)  │
   │ tool_use  │  │math+reason│  │   fast    │
   └───────────┘  └───────────┘  └───────────┘
                        │
                        ▼
                  ┌───────────┐
                  │Explanation│
                  │   Agent   │
                  │ (Sonnet)  │
                  └───────────┘
```

Additionally, each transaction on the Dashboard has an **"AI Explanation"** button that calls Claude directly (`src/lib/ai-explanation.ts`) to generate a personalized explanation for that specific transaction.

---

## Agents in Detail

### 1. Rates Agent — Live Market Data

**File:** `src/lib/agents/rates-agent.ts`
**Model:** `claude-haiku-4-5-20251001`
**Claude feature:** `tool_use`

**When used:** Only as a last resort. Normally rates are fetched via direct HTTP (no Claude) and cached for 2 minutes.

**Tools:**

| Tool | What it fetches |
|------|----------------|
| `get_ars_exchange_rate` | Official/MEP dollar rate |
| `get_investment_yields` | FCI and savings account yields |
| `get_inflation_data` | CER index from BCRA |

---

### 2. Optimization Agent — Precise Math + Claude Reasoning

**File:** `src/lib/agents/optimization-agent.ts`
**Model:** `claude-opus-4-6` (configurable in `config.ts`)

**Two-step process:**

**Step 1 — Deterministic math (no LLM):**

The math tools (`src/lib/agents/math-tools.ts`) compute with precision:

1. `calculate_true_costs()` — Ranks sources by true cost per dollar, returns `optimalOrder`
2. `allocate_payment(source_order)` — Exact allocation using that order

**True Cost Formula (per dollar spent):**
```
realYield = nominalYield - currencyInflation

For ARS: realYield = 29% TNA - 35% Argentine inflation = -6%
For USD: realYield = 4.2% - 3% US inflation = +1.2%
For USDC: realYield = 5.1% - 3% US inflation = +2.1%
For cards: opportunityCost = 0 (borrowed money)

monthlyOpportunityCost = realYield / 12
trueCost = fee + monthlyOpportunityCost
```

**Example with real data:**
| Source | Fee | Real Yield | True Cost |
|--------|-----|------------|-----------|
| ARS | 0.5% | -6%/12 = -0.50% | **0.00%** (better to spend them) |
| USD Cash | 0% | +1.2%/12 = +0.10% | **0.10%** |
| USDC | 0% | +2.1%/12 = +0.18% | **0.18%** |
| Mastercard | 2.5% | 0% | **2.50%** |
| Visa | 3.5% | 0% | **3.50%** |

**Optimal order:** ARS → USD → USDC → Mastercard → Visa

**Key insight:** Argentine pesos are spent first because their real yield is negative — they lose value to inflation faster than they earn in an FCI.

**Step 2 — Claude explains (only with API key):**

Opus receives the math tools result and generates:
- `reasoning`: "Mastercard was chosen over Visa because 2.5% < 3.5%. Pesos were spent first because they lose real value."
- `alternativeConsidered`: "Keeping pesos and using only cards would have cost more in fees."

---

### 3. Risk Agent — Risk Evaluation

**File:** `src/lib/agents/risk-agent.ts`
**Model:** `claude-haiku-4-5-20251001`
**Claude feature:** fast single call (no tools)

**What it evaluates:**
- Is the amount unusually high compared to history?
- Is the merchant suspicious?
- Would the payment deplete a large portion of funds?

**Without API key:** Always returns "low risk".
**With API key:** Haiku analyzes in real-time. Runs in **parallel** with the Optimization Agent.

---

### 4. Explanation Agent — Smart Insights

**File:** `src/lib/agents/explanation-agent.ts`
**Model:** `claude-sonnet-4-6`

**Generates exactly 3 insights with strict rules:**

| # | Type | What it shows |
|---|------|-------------|
| 1 | `savings` | Fee savings vs 3.5% Visa |
| 2 | `opportunity_cost` | Inflation-adjusted real yield (ARS vs Argentine inflation, USD vs US inflation — never mixed) |
| 3 | `invest_suggestion` | Specific product recommendations by name and TNA vs inflation |

**Prompt rules:**
- Never compare USD/USDC against Argentine inflation
- Never suggest "investing" credit card limits
- Only use the exact numbers provided
- deltaUSD must always be a number

---

### 5. AI Explanation (Dashboard)

**File:** `src/lib/ai-explanation.ts`

When the user taps **"AI Explanation"** on a transaction in the history, a direct Claude call (not the agent pipeline) generates a personalized explanation for that transaction.

**With API key:** Claude generates 2-3 sentences explaining why that combination was chosen.
**Without API key:** Locally generated template text.

---

### 6. Fallback — No API Key Mode

**File:** `src/lib/agents/fallback.ts`

**When used:**
- No `VITE_CLAUDE_API_KEY` configured
- Any unexpected error in the pipeline

**What it does:**
- Uses the **same math tools** as the AI pipeline (same ranking, same allocation)
- Generates template insights (no AI)
- Emits events so the UI animation still works
- If payment exceeds available funds, the button is disabled

---

## Math Tools — The Calculation Engine

**File:** `src/lib/agents/math-tools.ts`

These tools do ALL the math. Neither Claude nor any LLM does arithmetic.

| Tool | Input | Output |
|------|-------|--------|
| `calculate_true_costs` | (none) | Source ranking by true cost + `optimalOrder` |
| `allocate_payment` | `source_order: string[]` | Precise allocation: amounts, fees, opportunity cost |
| `compare_strategies` | Two different orderings | Side-by-side comparison, winner, savings difference |

---

## Cache and Live Data System

**File:** `src/lib/rates-cache.ts`

**Data fetched (in parallel on app load):**

| Source | Proxy | External API | Data |
|--------|-------|-------------|------|
| Official dollar | `/api/rates?type=oficial` | dolarapi.com | Buy/sell rate |
| MEP dollar | `/api/rates?type=mep` | dolarapi.com | Buy/sell rate |
| FCI/Yields | `/api/yields?source=config` | rendimientos.co | Name, TNA, type |
| CER | `/api/yields?source=cer-ultimo` | rendimientos.co | BCRA CER index |
| IPC (inflation) | `/api/ipc` | datos.gob.ar (INDEC) | Last 2 IPC values |

**How it computes inflation:**
```
monthly inflation = (current IPC - previous IPC) / previous IPC
Example: (10,991 - 10,683) / 10,683 = 2.88%
```

**How it picks the exchange rate:**
```
arsExchangeRate = max(oficial.venta, mep.venta) || 1400
```

**Cache TTL:** 2 minutes. Prefetched when the user opens the Dashboard.

**Fallback values** (if all APIs fail):
- ARS/USD: 1400
- FCI: Bank Money Market (est.) at 20% TNA
- Inflation: 2.9% monthly
- US inflation: 3% annual

---

## Data Persistence

**File:** `src/context/SessionContext.tsx`

Data survives browser refresh (F5):

| Data | Storage Key | What it stores |
|------|------------|---------------|
| Sources (balances + cards) | `mixpay_sources` | Full PaymentSource array |
| Transactions | `mixpay_transactions` | Payment history |
| Cards (legacy) | `mixpay_cards` | Credit cards only |

The **Reset** button (in the header) clears everything and restores defaults.

---

## API Proxy (CORS)

### Local Development (Vite proxy in `vite.config.mjs`)

| Local route | External API |
|-------------|-------------|
| `/api/rates?type=oficial` | dolarapi.com/v1/dolares/oficial |
| `/api/rates?type=mep` | dolarapi.com/v1/dolares/bolsa |
| `/api/yields?source=config` | rendimientos.co/api/config |
| `/api/yields?source=cer-ultimo` | rendimientos.co/api/cer-ultimo |
| `/api/ipc` | datos.gob.ar (INDEC IPC series 103.1) |

### Production (Vercel serverless in `api/`)

| File | Routes | Server cache |
|------|--------|-------------|
| `api/rates.ts` | `all`, `blue`, `oficial`, `mep`, `ccl`, `tarjeta`, `cripto` | 60s |
| `api/yields.ts` | `fci`, `config`, `cer`, `cer-ultimo`, `lecaps`, `mundo` | 120s |
| `api/ipc.ts` | INDEC IPC series | 1 hour |

---

## MCP Server — Argentina Finance

**Directory:** `mcp-servers/argentina-finance/`

Standalone server for Claude Desktop or Claude Code with 7 tools:

| Tool | Data |
|------|------|
| `get_dollar_rates` | All exchange rates (oficial, blue, MEP, CCL, tarjeta, cripto) |
| `get_fci_yields` | FCI mutual fund yields |
| `get_inflation_rate` | BCRA CER index |
| `get_market_data` | Global indicators (S&P, Bitcoin, Gold) |
| `get_lecap_rates` | LECAPs/BONCAPs with TIR/TNA |
| `calculate_true_costs` | True cost ranking per source |
| `allocate_payment` | Optimal payment allocation |

---

## Monetization Model

**Commission:** 25% of savings generated (configurable in `config.ts`)

| Plan | Price | Commission | Features |
|------|-------|-----------|----------|
| Free | $0/mo | 25% | AI optimization, up to 5 sources, basic insights |
| Pro | $4.99/mo | 0% | Unlimited sources, advanced insights, priority AI, export history |
| Business | $19.99/mo | 0% | Everything in Pro + team accounts, API access, custom strategies |

---

## Configuration (`src/lib/config.ts`)

| Variable | Value | Description |
|----------|-------|-------------|
| `COMMISSION_RATE` | 0.25 | 25% of savings |
| `OPTIMIZATION_MODEL` | `claude-opus-4-6` | Model for optimization (demo) |
| `EXPLANATION_MODEL` | `claude-sonnet-4-6` | Model for explanation |
| `RISK_MODEL` | `claude-haiku-4-5-20251001` | Model for risk |
| `RATES_MODEL` | `claude-haiku-4-5-20251001` | Model for rates |
| `WORST_CASE_FEE_RATE` | 0.035 | Visa 3.5% (benchmark) |
| `ARG_MONTHLY_INFLATION` | 0.029 | Argentine monthly inflation (fallback) |
| `US_ANNUAL_INFLATION` | 0.03 | US annual inflation |

For production, switching `OPTIMIZATION_MODEL` to `claude-sonnet-4-6` reduces cost from ~$0.17 to ~$0.04 per payment.

---

## Claude API Features Used

| Feature | Where | Purpose |
|---------|-------|---------|
| **Tool Use** | Rates Agent (3 financial tools) | Query market APIs |
| **Tool Use** | Optimization Agent (3 math tools) | Precise allocation calculations |
| **Multi-Model** | Opus, Sonnet, Haiku | Each agent uses the optimal model |
| **Streaming SSE** | Optimizing page | Real-time animation |
| **MCP** | Standalone server | Tools for Claude Desktop/Code |

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Frontend | React 19 + TypeScript |
| Routing | React Router 7 |
| Styling | Tailwind CSS 4 |
| Build | Vite 8 |
| Deploy | Vercel |
| AI | Claude API (Opus 4.6, Sonnet 4.6, Haiku 4.5) |
| Financial Data | dolarapi.com, datos.gob.ar (INDEC), rendimientos.co |
| Persistence | localStorage |
| Number Format | es-AR (. for thousands, , for decimals) |

---

## Full User Flow

```
1. Dashboard (/)
   ├── prefetchRates() loads rates in background (dollar, FCI, IPC)
   ├── Live rates strip: USD/ARS · Best FCI · Inflation
   ├── "Saved $X" badge with total accumulated savings
   ├── Shows balances, cards (add/edit/delete), transaction history
   ├── "AI Explanation" button per transaction (direct Claude call)
   └── State persists in localStorage (survives F5)

2. Checkout (/checkout)
   └── User picks merchant and amount (no limit, es-AR format)

3. Optimizing (/optimizing)
   ├── Stepper: ● Rates → ● Optimize → ● Risk → ● Insight
   ├── Math tools compute optimal allocation (deterministic)
   ├── Claude Opus explains reasoning (if API key present)
   ├── Claude Haiku evaluates risk (in parallel)
   ├── Claude Sonnet generates personalized insights
   ├── Tool call badge: ⚡ calculate_true_costs()
   ├── If insufficient funds: red warning + disabled button
   └── "Confirm Payment" button appears on completion

4. Success (/success)
   ├── Payment breakdown (es-AR format)
   ├── Savings vs Visa + MixPay commission (25% of savings)
   ├── "Remove commission → Pro" upgrade button
   └── "Smart Insights" panel with 3 insights:
       ├── Fee savings
       ├── Real yield vs inflation (per currency)
       └── Investment recommendation with specific product

5. Pro (/pro)
   └── 3 plans: Free / Pro / Business with upgrade CTAs
```
