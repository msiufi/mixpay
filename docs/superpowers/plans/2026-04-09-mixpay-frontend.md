# MixPay Frontend Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a polished hackathon-ready fintech demo for MixPay — a smart payment card that automatically optimizes multi-currency payments (USD, USDC, ARS) across 4 screens.

**Architecture:** Single-page React application with 4 routes (Dashboard → Checkout → Optimizing → Success). All data is mocked. State flows between screens via React Router `location.state`. Core logic lives in pure utility functions (`optimizer.ts`, `ai-explanation.ts`) that are fully testable and replaceable.

**Tech Stack:** React 19 + Vite 6, TypeScript, Tailwind CSS v4 (`@tailwindcss/vite` plugin), React Router v7 (declarative mode), Vitest for unit tests on utility functions.

---

## File Map

```
mixpay/
├── src/
│   ├── types/
│   │   └── index.ts                   # All shared TypeScript interfaces
│   ├── lib/
│   │   ├── optimizer.ts               # optimizePayment() — core logic
│   │   ├── ai-explanation.ts          # getAIExplanation() — mock, swappable for Claude API
│   │   ├── mock-data.ts               # mockBalances, mockCard, mockTransactions
│   │   └── __tests__/
│   │       └── optimizer.test.ts      # Vitest unit tests for optimizer
│   ├── components/
│   │   ├── BalanceBar.tsx             # Animated progress bar (used in Optimizing page)
│   │   └── AIExplanationModal.tsx     # Bottom-sheet modal with AI text
│   ├── pages/
│   │   ├── Dashboard.tsx              # Home: balances + card + transactions
│   │   ├── Checkout.tsx               # Purchase simulation + strategy toggle
│   │   ├── Optimizing.tsx             # Animated multi-step optimization screen
│   │   └── Success.tsx                # Confirmation + breakdown + highlights
│   ├── App.tsx                        # Router setup
│   ├── main.tsx                       # React entry point
│   └── index.css                      # Tailwind v4 import + Inter font + check animation
├── index.html
├── vite.config.ts                     # Vite + React + Tailwind plugins + Vitest config
├── tsconfig.json
└── package.json
```

---

## Task 1: Project Scaffolding

**Files:**
- Create: `mixpay/` (entire project)
- Modify: `vite.config.ts`
- Modify: `src/index.css`
- Modify: `package.json` (add test script)

- [ ] **Step 1: Scaffold the Vite + React + TypeScript project**

```bash
npm create vite@latest mixpay -- --template react-ts
cd mixpay
```

- [ ] **Step 2: Install all dependencies**

```bash
npm install react-router
npm install tailwindcss @tailwindcss/vite
npm install -D vitest
```

- [ ] **Step 3: Replace `vite.config.ts` with Tailwind v4 plugin + Vitest config**

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'node',
  },
})
```

- [ ] **Step 4: Add test script to `package.json`**

Open `package.json` and add to the `"scripts"` object:
```json
"test": "vitest run",
"test:watch": "vitest"
```

- [ ] **Step 5: Replace `src/index.css` with Tailwind v4 import + Inter font + checkmark animation**

```css
/* src/index.css */
@import "tailwindcss";
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap");

@layer base {
  body {
    font-family: 'Inter', sans-serif;
    -webkit-font-smoothing: antialiased;
  }
}

@layer utilities {
  .animate-check {
    stroke-dasharray: 100;
    stroke-dashoffset: 100;
    animation: draw-check 0.6s ease-out 0.2s forwards;
  }

  @keyframes draw-check {
    to {
      stroke-dashoffset: 0;
    }
  }
}
```

- [ ] **Step 6: Verify dev server runs**

```bash
npm run dev
```

Expected: Vite dev server starts on `http://localhost:5173` with no errors.

- [ ] **Step 7: Commit**

```bash
git init
git add .
git commit -m "chore: scaffold Vite+React+TS+Tailwind v4+React Router v7+Vitest"
```

---

## Task 2: TypeScript Types

**Files:**
- Create: `src/types/index.ts`

- [ ] **Step 1: Create `src/types/index.ts`**

```ts
// src/types/index.ts

export interface Balances {
  usd: number;
  usdc: number;
  ars: number;
}

export type PaymentStrategy = 'minimize-fees' | 'preserve-usd';

export interface OptimizationResult {
  usdUsed: number;
  usdcUsed: number;
  arsUsed: number;       // raw ARS amount
  arsUsedUSD: number;    // ARS converted to USD equivalent
  totalUSD: number;      // sum of all parts in USD
  fees: number;          // estimated fees in USD (0.5% of ARS portion)
  arsRate: number;       // ARS per USD rate used
  strategy: PaymentStrategy;
  success: boolean;      // false if balances were insufficient
}

export interface Transaction {
  id: string;
  merchant: string;
  amount: number;        // USD
  date: string;          // YYYY-MM-DD
  result: OptimizationResult;
}

export interface Card {
  last4: string;
  network: string;
  label: string;
}
```

- [ ] **Step 2: Commit**

```bash
git add src/types/index.ts
git commit -m "feat: add shared TypeScript types"
```

---

## Task 3: Payment Optimizer (TDD)

**Files:**
- Create: `src/lib/__tests__/optimizer.test.ts`
- Create: `src/lib/optimizer.ts`

- [ ] **Step 1: Write the failing tests**

```ts
// src/lib/__tests__/optimizer.test.ts
import { describe, it, expect } from 'vitest';
import { optimizePayment, ARS_RATE } from '../optimizer';

const balances = { usd: 5, usdc: 5, ars: 14000 };

describe('optimizePayment — minimize-fees strategy', () => {
  it('uses USD first', () => {
    const result = optimizePayment(20, balances, 'minimize-fees');
    expect(result.usdUsed).toBe(5);
  });

  it('uses USDC second after USD is exhausted', () => {
    const result = optimizePayment(20, balances, 'minimize-fees');
    expect(result.usdcUsed).toBe(5);
  });

  it('uses ARS to cover the remaining amount', () => {
    const result = optimizePayment(20, balances, 'minimize-fees');
    expect(result.arsUsedUSD).toBeCloseTo(10, 2);
  });

  it('marks success when balances cover the full amount', () => {
    const result = optimizePayment(20, balances, 'minimize-fees');
    expect(result.success).toBe(true);
  });

  it('marks failure when balances are insufficient', () => {
    const result = optimizePayment(100, balances, 'minimize-fees');
    expect(result.success).toBe(false);
  });

  it('totalUSD equals amountUSD when successful', () => {
    const result = optimizePayment(20, balances, 'minimize-fees');
    expect(result.totalUSD).toBeCloseTo(20, 2);
  });

  it('calculates fees as 0.5% of ARS usage in USD', () => {
    const result = optimizePayment(20, balances, 'minimize-fees');
    expect(result.fees).toBeCloseTo(result.arsUsedUSD * 0.005, 4);
  });
});

describe('optimizePayment — preserve-usd strategy', () => {
  it('uses USDC before USD', () => {
    const result = optimizePayment(8, balances, 'preserve-usd');
    expect(result.usdcUsed).toBe(5);
  });

  it('does not touch USD when ARS covers the rest', () => {
    // $8 needed: USDC covers $5, ARS covers remaining $3 → USD untouched
    const result = optimizePayment(8, balances, 'preserve-usd');
    expect(result.usdUsed).toBe(0);
  });

  it('falls back to USD only when USDC and ARS are insufficient', () => {
    const smallBalances = { usd: 10, usdc: 0, ars: 0 };
    const result = optimizePayment(8, smallBalances, 'preserve-usd');
    expect(result.usdUsed).toBe(8);
  });
});

describe('optimizePayment — ARS rate', () => {
  it('uses the exported ARS_RATE constant', () => {
    expect(ARS_RATE).toBe(1400);
  });

  it('exposes arsRate in the result', () => {
    const result = optimizePayment(20, balances);
    expect(result.arsRate).toBe(ARS_RATE);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm test
```

Expected: All tests fail with `Cannot find module '../optimizer'`.

- [ ] **Step 3: Implement `src/lib/optimizer.ts`**

```ts
// src/lib/optimizer.ts
import type { Balances, OptimizationResult, PaymentStrategy } from '../types';

export const ARS_RATE = 1400; // 1 USD = 1400 ARS

export function optimizePayment(
  amountUSD: number,
  balances: Balances,
  strategy: PaymentStrategy = 'minimize-fees'
): OptimizationResult {
  let remaining = amountUSD;
  let usdUsed = 0;
  let usdcUsed = 0;
  let arsUsed = 0;

  if (strategy === 'minimize-fees') {
    usdUsed = Math.min(balances.usd, remaining);
    remaining = parseFloat((remaining - usdUsed).toFixed(10));

    if (remaining > 0) {
      usdcUsed = Math.min(balances.usdc, remaining);
      remaining = parseFloat((remaining - usdcUsed).toFixed(10));
    }

    if (remaining > 0) {
      const arsAvailableUSD = balances.ars / ARS_RATE;
      const arsUsedUSD = Math.min(arsAvailableUSD, remaining);
      arsUsed = parseFloat((arsUsedUSD * ARS_RATE).toFixed(2));
      remaining = parseFloat((remaining - arsUsedUSD).toFixed(10));
    }
  } else {
    // preserve-usd: USDC → ARS → USD (last resort)
    usdcUsed = Math.min(balances.usdc, remaining);
    remaining = parseFloat((remaining - usdcUsed).toFixed(10));

    if (remaining > 0) {
      const arsAvailableUSD = balances.ars / ARS_RATE;
      const arsUsedUSD = Math.min(arsAvailableUSD, remaining);
      arsUsed = parseFloat((arsUsedUSD * ARS_RATE).toFixed(2));
      remaining = parseFloat((remaining - arsUsedUSD).toFixed(10));
    }

    if (remaining > 0) {
      usdUsed = Math.min(balances.usd, remaining);
      remaining = parseFloat((remaining - usdUsed).toFixed(10));
    }
  }

  const arsUsedUSD = parseFloat((arsUsed / ARS_RATE).toFixed(4));
  const fees = parseFloat((arsUsedUSD * 0.005).toFixed(4));

  return {
    usdUsed,
    usdcUsed,
    arsUsed,
    arsUsedUSD,
    totalUSD: parseFloat((usdUsed + usdcUsed + arsUsedUSD).toFixed(4)),
    fees,
    arsRate: ARS_RATE,
    strategy,
    success: remaining < 0.001,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm test
```

Expected: All tests pass. Output: `✓ src/lib/__tests__/optimizer.test.ts (12 tests)`.

- [ ] **Step 5: Commit**

```bash
git add src/lib/optimizer.ts src/lib/__tests__/optimizer.test.ts
git commit -m "feat: implement optimizePayment utility with full test coverage"
```

---

## Task 4: AI Explanation Utility

**Files:**
- Create: `src/lib/ai-explanation.ts`

- [ ] **Step 1: Create `src/lib/ai-explanation.ts`**

```ts
// src/lib/ai-explanation.ts
// To replace mock with Claude API: update getAIExplanation() body only.
// The rest of the app consumes only this async function.

import type { OptimizationResult } from '../types';

export async function getAIExplanation(
  merchant: string,
  amount: number,
  result: OptimizationResult
): Promise<string> {
  // Simulate network delay for realism
  await new Promise(resolve => setTimeout(resolve, 600));
  return buildExplanation(merchant, amount, result);
}

function buildExplanation(
  merchant: string,
  amount: number,
  result: OptimizationResult
): string {
  const parts: string[] = [];

  if (result.usdUsed > 0 && result.usdcUsed > 0) {
    parts.push(
      `MixPay used $${result.usdUsed} USD and $${result.usdcUsed} USDC first because they carry zero conversion fees.`
    );
  } else if (result.usdUsed > 0) {
    parts.push(
      `MixPay used $${result.usdUsed} USD first because it has no conversion fees.`
    );
  } else if (result.usdcUsed > 0) {
    parts.push(
      `MixPay used $${result.usdcUsed} USDC first to preserve your USD balance.`
    );
  }

  if (result.arsUsed > 0) {
    parts.push(
      `ARS ${result.arsUsed.toLocaleString()} (≈$${result.arsUsedUSD.toFixed(2)} USD at ${result.arsRate} ARS/USD) covered the remaining amount with only a $${result.fees.toFixed(4)} USD conversion fee.`
    );
  }

  const strategyLabel =
    result.strategy === 'minimize-fees' ? 'minimum fees' : 'USD preservation';

  parts.push(
    `No credit card was charged. Total fees: $${result.fees.toFixed(4)} USD — payment optimized for ${strategyLabel}.`
  );

  return parts.join(' ');
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/ai-explanation.ts
git commit -m "feat: add modular AI explanation utility (mock, ready for Claude API)"
```

---

## Task 5: Mock Data

**Files:**
- Create: `src/lib/mock-data.ts`

- [ ] **Step 1: Create `src/lib/mock-data.ts`**

```ts
// src/lib/mock-data.ts
import type { Balances, Card, Transaction } from '../types';
import { optimizePayment } from './optimizer';

export const mockBalances: Balances = {
  usd: 5,
  usdc: 5,
  ars: 14000,
};

export const mockCard: Card = {
  last4: '1234',
  network: 'Visa',
  label: 'MixPay Visa',
};

export const mockTransactions: Transaction[] = [
  {
    id: 'tx-001',
    merchant: 'Nike Store',
    amount: 20,
    date: '2026-04-08',
    result: optimizePayment(20, { usd: 5, usdc: 5, ars: 14000 }, 'minimize-fees'),
  },
  {
    id: 'tx-002',
    merchant: 'Spotify',
    amount: 10,
    date: '2026-04-07',
    result: optimizePayment(10, { usd: 5, usdc: 5, ars: 14000 }, 'minimize-fees'),
  },
  {
    id: 'tx-003',
    merchant: 'Amazon',
    amount: 35,
    date: '2026-04-05',
    result: optimizePayment(35, { usd: 5, usdc: 5, ars: 14000 }, 'preserve-usd'),
  },
];
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/mock-data.ts
git commit -m "feat: add mock balances, card, and transaction data"
```

---

## Task 6: App Router

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/main.tsx`

- [ ] **Step 1: Replace `src/App.tsx` with router setup**

```tsx
// src/App.tsx
import { BrowserRouter, Routes, Route } from 'react-router';
import Dashboard from './pages/Dashboard';
import Checkout from './pages/Checkout';
import Optimizing from './pages/Optimizing';
import Success from './pages/Success';

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/checkout" element={<Checkout />} />
        <Route path="/optimizing" element={<Optimizing />} />
        <Route path="/success" element={<Success />} />
      </Routes>
    </BrowserRouter>
  );
}
```

- [ ] **Step 2: Replace `src/main.tsx` with standard React 19 entry**

```tsx
// src/main.tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
```

- [ ] **Step 3: Create placeholder page files so the app compiles**

Create `src/pages/Dashboard.tsx`:
```tsx
export default function Dashboard() {
  return <div>Dashboard</div>;
}
```

Create `src/pages/Checkout.tsx`:
```tsx
export default function Checkout() {
  return <div>Checkout</div>;
}
```

Create `src/pages/Optimizing.tsx`:
```tsx
export default function Optimizing() {
  return <div>Optimizing</div>;
}
```

Create `src/pages/Success.tsx`:
```tsx
export default function Success() {
  return <div>Success</div>;
}
```

- [ ] **Step 4: Verify app compiles and routes render**

```bash
npm run dev
```

Navigate to `http://localhost:5173/`, `/checkout`, `/optimizing`, `/success`. Each shows its placeholder text. No console errors.

- [ ] **Step 5: Commit**

```bash
git add src/App.tsx src/main.tsx src/pages/
git commit -m "feat: set up React Router v7 with 4 routes and placeholder pages"
```

---

## Task 7: BalanceBar Component

**Files:**
- Create: `src/components/BalanceBar.tsx`

- [ ] **Step 1: Create `src/components/BalanceBar.tsx`**

```tsx
// src/components/BalanceBar.tsx
import { useEffect, useState } from 'react';

interface BalanceBarProps {
  label: string;
  symbol: string;       // "$" for USD/USDC, "" for ARS
  total: number;
  used: number;
  color: string;        // Tailwind bg color class, e.g. "bg-blue-500"
  delay?: number;       // ms before bar starts animating
}

export default function BalanceBar({
  label,
  symbol,
  total,
  used,
  color,
  delay = 0,
}: BalanceBarProps) {
  const [width, setWidth] = useState(0);
  const percentage = total > 0 ? Math.min((used / total) * 100, 100) : 0;

  useEffect(() => {
    if (used === 0) {
      setWidth(0);
      return;
    }
    const timer = setTimeout(() => setWidth(percentage), delay);
    return () => clearTimeout(timer);
  }, [used, percentage, delay]);

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-gray-600 font-medium">{label}</span>
        <span className="text-gray-500">
          {symbol}
          {used.toLocaleString()}{' '}
          <span className="text-gray-300">
            / {symbol}
            {total.toLocaleString()}
          </span>
        </span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${color}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/BalanceBar.tsx
git commit -m "feat: add animated BalanceBar component"
```

---

## Task 8: AIExplanationModal Component

**Files:**
- Create: `src/components/AIExplanationModal.tsx`

- [ ] **Step 1: Create `src/components/AIExplanationModal.tsx`**

```tsx
// src/components/AIExplanationModal.tsx
import { useEffect, useState } from 'react';
import type { OptimizationResult } from '../types';
import { getAIExplanation } from '../lib/ai-explanation';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  merchant: string;
  amount: number;
  result: OptimizationResult;
}

export default function AIExplanationModal({
  isOpen,
  onClose,
  merchant,
  amount,
  result,
}: Props) {
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setExplanation('');
    getAIExplanation(merchant, amount, result).then(text => {
      setExplanation(text);
      setLoading(false);
    });
  }, [isOpen, merchant, amount, result]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-indigo-600 rounded-md flex items-center justify-center">
              <span className="text-white text-xs font-bold">✦</span>
            </div>
            <h3 className="font-semibold text-gray-900">AI Explanation</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </div>

        {/* Body */}
        <div className="bg-gray-50 rounded-xl p-4 min-h-[80px]">
          {loading ? (
            <div className="flex items-center gap-2 text-gray-400">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-indigo-600 rounded-full animate-spin" />
              <span className="text-sm">Generating explanation...</span>
            </div>
          ) : (
            <p className="text-sm text-gray-700 leading-relaxed">{explanation}</p>
          )}
        </div>

        <p className="text-xs text-gray-400 text-center">
          Powered by MixPay AI · Replace body of{' '}
          <code className="bg-gray-100 px-1 rounded">getAIExplanation()</code> with
          Claude API
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/AIExplanationModal.tsx
git commit -m "feat: add AIExplanationModal with loading state"
```

---

## Task 9: Dashboard Page

**Files:**
- Modify: `src/pages/Dashboard.tsx`

- [ ] **Step 1: Replace `src/pages/Dashboard.tsx` with full implementation**

```tsx
// src/pages/Dashboard.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { mockBalances, mockCard, mockTransactions } from '../lib/mock-data';
import { ARS_RATE } from '../lib/optimizer';
import AIExplanationModal from '../components/AIExplanationModal';
import type { Transaction } from '../types';

export default function Dashboard() {
  const navigate = useNavigate();
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const totalUSD =
    mockBalances.usd + mockBalances.usdc + mockBalances.ars / ARS_RATE;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-100 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
              <span className="text-white text-xs font-bold">M</span>
            </div>
            <span className="text-lg font-semibold text-gray-900">MixPay</span>
          </div>
          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
            JD
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-6 py-8 space-y-6">
        {/* Total Balance Hero */}
        <div className="bg-black rounded-2xl p-6 text-white">
          <p className="text-gray-400 text-sm mb-1">Total Balance</p>
          <p className="text-4xl font-bold">${totalUSD.toFixed(2)}</p>
          <p className="text-gray-500 text-sm mt-1">USD equivalent</p>
        </div>

        {/* Balances Grid */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Balances
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <div className="text-2xl mb-2">🇺🇸</div>
              <p className="text-xs text-gray-500 mb-0.5">USD</p>
              <p className="text-lg font-bold text-gray-900">
                ${mockBalances.usd}
              </p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <div className="text-2xl mb-2">🔷</div>
              <p className="text-xs text-gray-500 mb-0.5">USDC</p>
              <p className="text-lg font-bold text-gray-900">
                ${mockBalances.usdc}
              </p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <div className="text-2xl mb-2">🇦🇷</div>
              <p className="text-xs text-gray-500 mb-0.5">ARS</p>
              <p className="text-lg font-bold text-gray-900">
                {mockBalances.ars.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        {/* Linked Card */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Linked Card
          </p>
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-8 bg-gray-900 rounded flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">VISA</span>
            </div>
            <div>
              <p className="font-medium text-gray-900 text-sm">
                {mockCard.label}
              </p>
              <p className="text-xs text-gray-500">
                •••• •••• •••• {mockCard.last4}
              </p>
            </div>
            <div className="ml-auto">
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                Active
              </span>
            </div>
          </div>
        </div>

        {/* Simulate Purchase CTA */}
        <button
          onClick={() => navigate('/checkout')}
          className="w-full bg-black text-white py-4 rounded-xl font-semibold text-base hover:bg-gray-800 active:scale-95 transition-all"
        >
          Simulate Purchase →
        </button>

        {/* Recent Transactions */}
        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Recent Transactions
          </p>
          <div className="space-y-3">
            {mockTransactions.map(tx => (
              <div
                key={tx.id}
                className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{tx.merchant}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{tx.date}</p>
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {tx.result.usdUsed > 0 && (
                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                          USD ${tx.result.usdUsed}
                        </span>
                      )}
                      {tx.result.usdcUsed > 0 && (
                        <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                          USDC ${tx.result.usdcUsed}
                        </span>
                      )}
                      {tx.result.arsUsed > 0 && (
                        <span className="text-xs bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full font-medium">
                          ARS {tx.result.arsUsed.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-gray-900">
                      -${tx.amount}
                    </p>
                    <button
                      onClick={() => setSelectedTx(tx)}
                      className="text-xs text-indigo-600 font-medium mt-2 hover:underline"
                    >
                      AI explanation ✦
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedTx && (
        <AIExplanationModal
          isOpen={true}
          onClose={() => setSelectedTx(null)}
          merchant={selectedTx.merchant}
          amount={selectedTx.amount}
          result={selectedTx.result}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify dashboard renders correctly**

```bash
npm run dev
```

Open `http://localhost:5173/`. Verify: hero balance card, 3 balance tiles, linked card, CTA button, and 3 transaction rows each with color badges and "AI explanation ✦" button. Clicking AI explanation opens modal.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Dashboard.tsx
git commit -m "feat: implement Dashboard page with balances, card, and transactions"
```

---

## Task 10: Checkout Page

**Files:**
- Modify: `src/pages/Checkout.tsx`

- [ ] **Step 1: Replace `src/pages/Checkout.tsx` with full implementation**

```tsx
// src/pages/Checkout.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { PaymentStrategy } from '../types';
import { mockBalances, mockCard } from '../lib/mock-data';

const MERCHANT = 'Nike Store';
const AMOUNT = 20;

export default function Checkout() {
  const navigate = useNavigate();
  const [strategy, setStrategy] = useState<PaymentStrategy>('minimize-fees');

  function handlePay() {
    navigate('/optimizing', {
      state: { merchant: MERCHANT, amount: AMOUNT, strategy, balances: mockBalances },
    });
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4">

        {/* Back */}
        <button
          onClick={() => navigate('/')}
          className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1"
        >
          ← Back
        </button>

        {/* Merchant Card */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm text-center">
          <div className="w-16 h-16 bg-black rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <svg viewBox="0 0 24 14" className="w-10 fill-white">
              <path d="M1 13 C8 13 20 0 23 0 C25 0 24 3 20 5 C14 8 3 13 1 13Z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900">{MERCHANT}</h2>
          <p className="text-gray-400 text-sm mt-1">nike.com</p>
        </div>

        {/* Amount */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <p className="text-sm text-gray-400 mb-1">Amount due</p>
          <p className="text-5xl font-bold text-gray-900 tracking-tight">
            ${AMOUNT}.00
          </p>
          <p className="text-sm text-gray-400 mt-1">United States Dollar</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-12 h-8 bg-gray-900 rounded flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">VISA</span>
          </div>
          <div>
            <p className="font-medium text-gray-900 text-sm">{mockCard.label}</p>
            <p className="text-xs text-gray-400">
              •••• •••• •••• {mockCard.last4}
            </p>
          </div>
          <span className="ml-auto text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full font-medium">
            Smart Pay
          </span>
        </div>

        {/* Strategy Toggle */}
        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Optimization Strategy
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setStrategy('minimize-fees')}
              className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all ${
                strategy === 'minimize-fees'
                  ? 'bg-black text-white shadow-sm'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              Minimize Fees
            </button>
            <button
              onClick={() => setStrategy('preserve-usd')}
              className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all ${
                strategy === 'preserve-usd'
                  ? 'bg-black text-white shadow-sm'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              Preserve USD
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {strategy === 'minimize-fees'
              ? 'Uses USD → USDC → ARS. Lowest possible fees.'
              : 'Uses USDC → ARS → USD. Keeps your USD intact.'}
          </p>
        </div>

        {/* Pay Button */}
        <button
          onClick={handlePay}
          className="w-full bg-black text-white py-4 rounded-xl font-bold text-lg hover:bg-gray-800 active:scale-95 transition-all shadow-lg shadow-black/10"
        >
          Pay with MixPay
        </button>

        <p className="text-center text-xs text-gray-400">
          Secured by MixPay · No credit card charged
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify checkout renders and navigates**

Open `http://localhost:5173/checkout`. Verify: Nike logo, $20 amount, card display, strategy toggle switches styles, "Pay with MixPay" button navigates to `/optimizing` with state.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Checkout.tsx
git commit -m "feat: implement Checkout page with strategy toggle"
```

---

## Task 11: Optimizing Page

**Files:**
- Modify: `src/pages/Optimizing.tsx`

- [ ] **Step 1: Replace `src/pages/Optimizing.tsx` with full implementation**

```tsx
// src/pages/Optimizing.tsx
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { Balances, OptimizationResult, PaymentStrategy } from '../types';
import { optimizePayment } from '../lib/optimizer';
import BalanceBar from '../components/BalanceBar';

interface LocationState {
  merchant: string;
  amount: number;
  strategy: PaymentStrategy;
  balances: Balances;
}

export default function Optimizing() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState | null;

  const [step, setStep] = useState(0);
  const [result, setResult] = useState<OptimizationResult | null>(null);

  useEffect(() => {
    if (!state) {
      navigate('/');
      return;
    }

    const timers = [
      setTimeout(() => setStep(1), 700),    // show balances section
      setTimeout(() => setStep(2), 1400),   // animate available balance bars
      setTimeout(() => {                     // compute + show selected combination
        const r = optimizePayment(state.amount, state.balances, state.strategy);
        setResult(r);
        setStep(3);
      }, 2400),
      setTimeout(() => setStep(4), 3100),   // show fees/rate
      setTimeout(() => setStep(5), 3700),   // show confirm button
    ];

    return () => timers.forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!state) return null;

  const { merchant, amount, balances } = state;

  function handleConfirm() {
    if (!result) return;
    navigate('/success', { state: { merchant, amount, strategy: state!.strategy, result } });
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">

        {/* Header status */}
        <div className="text-center mb-6 h-8 flex items-center justify-center">
          {step === 0 ? (
            <div className="flex items-center gap-2 text-gray-400">
              <div className="w-4 h-4 border-2 border-gray-700 border-t-gray-400 rounded-full animate-spin" />
              <span className="text-sm">Analyzing your balances...</span>
            </div>
          ) : (
            <span className="text-white font-semibold text-sm tracking-wide uppercase">
              Payment Optimization
            </span>
          )}
        </div>

        {/* Main white card */}
        <div className="bg-white rounded-2xl overflow-hidden shadow-2xl">

          {/* Merchant + amount row */}
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">Paying to</p>
              <p className="font-bold text-gray-900">{merchant}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">Amount</p>
              <p className="text-2xl font-bold text-gray-900">
                ${amount.toFixed(2)}
              </p>
            </div>
          </div>

          <div className="px-6 py-5 space-y-5">

            {/* Available balances */}
            <div
              className={`transition-all duration-500 ${
                step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
              }`}
            >
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Available Balances
              </p>
              <div className="space-y-3">
                <BalanceBar
                  label="USD"
                  symbol="$"
                  total={balances.usd}
                  used={step >= 2 ? balances.usd : 0}
                  color="bg-blue-500"
                  delay={0}
                />
                <BalanceBar
                  label="USDC"
                  symbol="$"
                  total={balances.usdc}
                  used={step >= 2 ? balances.usdc : 0}
                  color="bg-purple-500"
                  delay={150}
                />
                <BalanceBar
                  label="ARS"
                  symbol=""
                  total={balances.ars}
                  used={step >= 2 ? balances.ars : 0}
                  color="bg-sky-400"
                  delay={300}
                />
              </div>
            </div>

            {/* Selected combination */}
            {result ? (
              <div
                className={`transition-all duration-500 ${
                  step >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
                }`}
              >
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Selected Combination
                </p>
                <div className="space-y-2">
                  {result.usdUsed > 0 && (
                    <div className="flex justify-between items-center bg-blue-50 rounded-lg px-3 py-2.5">
                      <span className="text-sm font-semibold text-blue-800">
                        🇺🇸 USD
                      </span>
                      <span className="text-sm font-bold text-blue-900">
                        ${result.usdUsed.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {result.usdcUsed > 0 && (
                    <div className="flex justify-between items-center bg-purple-50 rounded-lg px-3 py-2.5">
                      <span className="text-sm font-semibold text-purple-800">
                        🔷 USDC
                      </span>
                      <span className="text-sm font-bold text-purple-900">
                        ${result.usdcUsed.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {result.arsUsed > 0 && (
                    <div className="flex justify-between items-center bg-sky-50 rounded-lg px-3 py-2.5">
                      <span className="text-sm font-semibold text-sky-800">
                        🇦🇷 ARS
                      </span>
                      <div className="text-right">
                        <p className="text-sm font-bold text-sky-900">
                          ≈${result.arsUsedUSD.toFixed(2)}
                        </p>
                        <p className="text-xs text-sky-600">
                          {result.arsUsed.toLocaleString()} ARS
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {/* Fees & rate summary */}
            {result ? (
              <div
                className={`transition-all duration-500 ${
                  step >= 4 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
                }`}
              >
                <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Estimated fees</span>
                    <span className="font-medium text-gray-900">
                      ${result.fees.toFixed(4)} USD
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">ARS exchange rate</span>
                    <span className="font-medium text-gray-900">
                      1 USD = {result.arsRate} ARS
                    </span>
                  </div>
                  <div className="flex justify-between text-sm border-t border-gray-200 pt-2">
                    <span className="font-semibold text-gray-900">Total</span>
                    <span className="font-bold text-gray-900">
                      ${amount.toFixed(2)} USD
                    </span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {/* Confirm button */}
          <div
            className={`px-6 pb-6 transition-all duration-500 ${
              step >= 5 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
            }`}
          >
            <button
              onClick={handleConfirm}
              className="w-full bg-black text-white py-4 rounded-xl font-bold text-base hover:bg-gray-800 active:scale-95 transition-all"
            >
              Confirm Payment →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify optimizing page animation sequence**

Navigate from `http://localhost:5173/checkout` → click "Pay with MixPay". Watch:
1. t=0s: spinner + "Analyzing your balances..."
2. t=0.7s: "Available Balances" section fades in
3. t=1.4s: balance bars animate to 100%
4. t=2.4s: "Selected Combination" section appears with color tiles
5. t=3.1s: fees/rate summary fades in
6. t=3.7s: "Confirm Payment →" button slides up

Expected: Smooth, no layout jumps.

- [ ] **Step 3: Commit**

```bash
git add src/pages/Optimizing.tsx
git commit -m "feat: implement Optimizing page with 5-step animation sequence"
```

---

## Task 12: Success Page

**Files:**
- Modify: `src/pages/Success.tsx`

- [ ] **Step 1: Replace `src/pages/Success.tsx` with full implementation**

```tsx
// src/pages/Success.tsx
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { OptimizationResult, PaymentStrategy } from '../types';

interface LocationState {
  merchant: string;
  amount: number;
  strategy: PaymentStrategy;
  result: OptimizationResult;
}

export default function Success() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState | null;

  useEffect(() => {
    if (!state) navigate('/');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!state) return null;

  const { merchant, amount, result } = state;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4">

        {/* Success indicator */}
        <div className="text-center py-4">
          <div className="w-20 h-20 bg-green-50 rounded-full mx-auto flex items-center justify-center mb-5">
            <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="20" r="18" stroke="#16a34a" strokeWidth="1.5" />
              <path
                d="M12 21 L18 27 L28 15"
                stroke="#16a34a"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="animate-check"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Payment Approved</h1>
          <p className="text-gray-400 mt-1 text-sm">
            {merchant} · ${amount.toFixed(2)} USD
          </p>
        </div>

        {/* Breakdown */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
            Payment Breakdown
          </p>
          <div className="space-y-3">
            {result.usdUsed > 0 && (
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-base">🇺🇸</span>
                  <span className="text-sm font-medium text-gray-700">USD</span>
                </div>
                <span className="font-semibold text-gray-900">
                  ${result.usdUsed.toFixed(2)}
                </span>
              </div>
            )}
            {result.usdcUsed > 0 && (
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-base">🔷</span>
                  <span className="text-sm font-medium text-gray-700">USDC</span>
                </div>
                <span className="font-semibold text-gray-900">
                  ${result.usdcUsed.toFixed(2)}
                </span>
              </div>
            )}
            {result.arsUsed > 0 && (
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-base">🇦🇷</span>
                  <span className="text-sm font-medium text-gray-700">ARS</span>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">
                    ≈${result.arsUsedUSD.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {result.arsUsed.toLocaleString()} ARS @ {result.arsRate}
                  </p>
                </div>
              </div>
            )}
            <div className="flex justify-between items-center border-t border-gray-100 pt-3">
              <span className="text-sm text-gray-400">Conversion fees</span>
              <span className="text-sm text-gray-600">
                ${result.fees.toFixed(4)}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-bold text-gray-900">Total charged</span>
              <span className="font-bold text-gray-900 text-lg">
                ${amount.toFixed(2)}
              </span>
            </div>
          </div>
        </div>

        {/* Highlights */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-50 rounded-xl p-4 border border-green-100">
            <div className="text-xl mb-2">✅</div>
            <p className="text-sm font-semibold text-green-800 leading-snug">
              No credit card used
            </p>
          </div>
          <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
            <div className="text-xl mb-2">⚡</div>
            <p className="text-sm font-semibold text-indigo-800 leading-snug">
              Optimized for low fees
            </p>
          </div>
        </div>

        {/* Back to Dashboard */}
        <button
          onClick={() => navigate('/')}
          className="w-full bg-black text-white py-4 rounded-xl font-semibold hover:bg-gray-800 active:scale-95 transition-all"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify success page renders correctly**

Navigate the full flow: Dashboard → Checkout → Optimizing → Confirm → Success. Verify:
- Animated green checkmark draws in after 0.2s
- Breakdown shows correct USD/USDC/ARS splits
- "No credit card used" and "Optimized for low fees" highlights visible
- "Back to Dashboard" returns to `/`

- [ ] **Step 3: Run all tests one final time**

```bash
npm test
```

Expected: All tests pass.

- [ ] **Step 4: Final commit**

```bash
git add src/pages/Success.tsx
git commit -m "feat: implement Success page with animated checkmark and payment breakdown"
```

---

## Self-Review

### Spec Coverage Check

| Requirement | Task |
|---|---|
| Checkout page: merchant, amount, card, Pay button | Task 10 |
| Strategy toggle (Minimize Fees / Preserve USD) | Task 10 |
| Optimization screen with loading/decision process | Task 11 |
| Balance display: USD 5, USDC 5, ARS 14000 | Task 11 |
| Selected combination with ARS equivalent | Task 11 |
| Estimated fees + exchange rate shown | Task 11 |
| Success page with breakdown | Task 12 |
| "No credit card used" + "Optimized for low fees" highlights | Task 12 |
| Dashboard: balances, card, transactions | Task 9 |
| Transaction breakdown badges | Task 9 |
| "View AI explanation" per transaction | Tasks 8, 9 |
| Mock AI explanation string | Task 4 |
| Modular `getAIExplanation()` replaceable with Claude API | Task 4 |
| `optimizePayment(amountUSD, balances)` function | Task 3 |
| Rules: USD → USDC → ARS, avoid credit card | Task 3 |
| React + Vite + TypeScript + TailwindCSS + React Router | Task 1 |
| Animated balance bars | Task 7 |
| Fintech premium style | All pages |

### Placeholder Scan

No TBDs, TODOs, or "implement later" present. Every step contains complete code.

### Type Consistency

- `OptimizationResult.arsUsed` — raw ARS — consistent across `optimizer.ts`, `mock-data.ts`, `Optimizing.tsx`, `Success.tsx`, `Dashboard.tsx`, `ai-explanation.ts`
- `OptimizationResult.arsUsedUSD` — USD equivalent — used for display in Optimizing and Success
- `ARS_RATE` — exported from `optimizer.ts`, imported in `mock-data.ts` and `Dashboard.tsx`
- `getAIExplanation(merchant, amount, result)` — signature consistent between `ai-explanation.ts` and `AIExplanationModal.tsx`
- `LocationState` interfaces in `Optimizing.tsx` and `Success.tsx` match the `navigate()` call payloads in `Checkout.tsx` and `Optimizing.tsx`

---

## Running the Demo

```bash
cd mixpay
npm run dev
# → http://localhost:5173
```

**Demo script (under 2 minutes):**
1. Open Dashboard — show balances, linked card, past transactions
2. Click "AI explanation" on a transaction — show modal with explanation
3. Click "Simulate Purchase" → Checkout — show Nike Store, $20, strategy toggle
4. Click "Pay with MixPay" → watch Optimizing screen animate in real-time
5. "Confirm Payment" → Success — show breakdown + highlights
6. "Back to Dashboard" — demo complete
