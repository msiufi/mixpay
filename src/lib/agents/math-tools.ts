// Math tools for the Optimization Agent.
// Opus calls these via tool_use for precise calculations — no LLM math.

import type { ClaudeTool } from '../claude-client'
import type { EnrichedSource } from './types'

// ── Tool definitions (sent to Claude API) ────────────────────────────

export const mathTools: ClaudeTool[] = [
  {
    name: 'calculate_true_costs',
    description: 'Calculates the true cost (fee + opportunity cost) for each payment source per 1 USD spent. Returns sources ranked from cheapest to most expensive. Use this FIRST to understand which sources are best.',
    input_schema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'allocate_payment',
    description: 'Given an ordered list of source IDs (your chosen priority), allocates the payment amount precisely across those sources respecting available balances and currency conversion. Returns exact amounts, fees, and opportunity costs. Call this AFTER you decide the allocation strategy.',
    input_schema: {
      type: 'object',
      properties: {
        source_order: {
          type: 'array',
          items: { type: 'string' },
          description: 'Source IDs in your chosen priority order (first = use first)',
        },
      },
      required: ['source_order'],
    },
  },
  {
    name: 'compare_strategies',
    description: 'Compares two allocation strategies side by side. Pass two different source orderings and see which one has lower total true cost. Use this to validate your reasoning.',
    input_schema: {
      type: 'object',
      properties: {
        strategy_a: {
          type: 'array',
          items: { type: 'string' },
          description: 'First strategy: source IDs in priority order',
        },
        strategy_b: {
          type: 'array',
          items: { type: 'string' },
          description: 'Second strategy: source IDs in priority order',
        },
      },
      required: ['strategy_a', 'strategy_b'],
    },
  },
]

// ── Precise math functions ───────────────────────────────────────────

interface SourceCost {
  sourceId: string
  label: string
  currency: string
  feeRate: number
  effectiveYieldRate: number
  realYieldRate: number
  feePerDollar: number
  opportunityCostPerDollar: number
  trueCostPerDollar: number
  availableUSD: number
}

/** Get the annual inflation rate for a given currency. */
function inflationForCurrency(currency: string, argMonthlyInflation: number, usAnnualInflation: number): number {
  return currency === 'ARS' ? argMonthlyInflation * 12 : usAnnualInflation
}

function computeSourceCosts(sources: EnrichedSource[], arsRate: number, argMonthlyInflation: number, usAnnualInflation: number): SourceCost[] {
  return sources.map(s => {
    const availableUSD = s.currency === 'ARS'
      ? s.available / arsRate
      : s.available

    const feePerDollar = s.feeRate

    // Opportunity cost uses REAL yield (nominal - currency-specific inflation).
    // ARS at 29% with 35% inflation → real yield = -6% → negative opportunity cost (benefit to spend!)
    // USD at 4.2% with 3% inflation → real yield = +1.2% → small cost to spend
    // Credit cards → 0 (borrowed money, no opportunity cost)
    const realYield = s.effectiveYieldRate - inflationForCurrency(s.currency, argMonthlyInflation, usAnnualInflation)
    const opportunityCostPerDollar = s.kind === 'credit_card'
      ? 0
      : realYield / 12  // can be negative = benefit to spend
    const trueCostPerDollar = feePerDollar + opportunityCostPerDollar

    return {
      sourceId: s.id,
      label: s.label,
      currency: s.currency,
      feeRate: s.feeRate,
      effectiveYieldRate: s.effectiveYieldRate,
      realYieldRate: round(realYield),
      feePerDollar: round(feePerDollar),
      opportunityCostPerDollar: round(opportunityCostPerDollar),
      trueCostPerDollar: round(trueCostPerDollar),
      availableUSD: round(availableUSD),
    }
  }).sort((a, b) => a.trueCostPerDollar - b.trueCostPerDollar)
}

interface AllocationItem {
  sourceId: string
  label: string
  symbol: string
  currency: string
  amountUSD: number
  amountOriginal: number
  fee: number
  feeRate: number
  opportunityCostUSD: number
  trueCostUSD: number
}

interface AllocationResult {
  allocations: AllocationItem[]
  totalUSD: number
  totalFees: number
  totalOpportunityCost: number
  totalTrueCost: number
  success: boolean
  remainingUSD: number
}

function computeAllocation(
  sourceOrder: string[],
  amountUSD: number,
  sources: EnrichedSource[],
  arsRate: number,
  argMonthlyInflation: number,
  usAnnualInflation: number,
): AllocationResult {
  let remaining = amountUSD
  const allocations: AllocationItem[] = []

  for (const sid of sourceOrder) {
    if (remaining < 0.01) break
    const s = sources.find(src => src.id === sid)
    if (!s) continue

    let usedUSD: number
    let amountOriginal: number

    if (s.currency === 'ARS') {
      const availableUSD = s.available / arsRate
      const maxMerchantUSD = availableUSD / (1 + s.feeRate)
      usedUSD = Math.min(remaining, round(maxMerchantUSD))
      if (usedUSD <= 0) continue
      amountOriginal = round(usedUSD * (1 + s.feeRate) * arsRate)
    } else {
      const maxMerchantUSD = s.available / (1 + s.feeRate)
      usedUSD = Math.min(remaining, round(maxMerchantUSD))
      if (usedUSD <= 0) continue
      amountOriginal = round(usedUSD * (1 + s.feeRate))
    }

    const fee = round(usedUSD * s.feeRate)
    const realYield = s.effectiveYieldRate - inflationForCurrency(s.currency, argMonthlyInflation, usAnnualInflation)
    const oppCost = s.kind === 'credit_card'
      ? 0
      : round(usedUSD * realYield / 12)

    allocations.push({
      sourceId: s.id,
      label: s.label,
      symbol: s.symbol,
      currency: s.currency,
      amountUSD: round(usedUSD),
      amountOriginal: round(amountOriginal),
      fee,
      feeRate: s.feeRate,
      opportunityCostUSD: oppCost,
      trueCostUSD: round(fee + oppCost),
    })

    remaining = round(remaining - usedUSD)
  }

  return {
    allocations,
    totalUSD: round(allocations.reduce((s, a) => s + a.amountUSD, 0)),
    totalFees: round(allocations.reduce((s, a) => s + a.fee, 0)),
    totalOpportunityCost: round(allocations.reduce((s, a) => s + a.opportunityCostUSD, 0)),
    totalTrueCost: round(allocations.reduce((s, a) => s + a.trueCostUSD, 0)),
    success: remaining < 0.01,
    remainingUSD: round(remaining),
  }
}

function round(v: number): number {
  return parseFloat(v.toFixed(6))
}

// ── Tool handlers factory ────────────────────────────────────────────

export function createMathToolHandlers(
  amountUSD: number,
  sources: EnrichedSource[],
  arsRate: number,
  argMonthlyInflation: number,
  usAnnualInflation: number,
): Record<string, (input: Record<string, unknown>) => Promise<unknown>> {
  return {
    calculate_true_costs: async () => {
      const costs = computeSourceCosts(sources, arsRate, argMonthlyInflation, usAnnualInflation)
      return {
        amount: amountUSD,
        sources: costs,
        optimalOrder: costs.map(c => c.sourceId),
        recommendation: `Use this exact order for allocate_payment: [${costs.map(c => `"${c.sourceId}"`).join(', ')}]`,
      }
    },

    allocate_payment: async (input) => {
      const order = (input.source_order as string[]) ?? []
      return computeAllocation(order, amountUSD, sources, arsRate, argMonthlyInflation, usAnnualInflation)
    },

    compare_strategies: async (input) => {
      const a = (input.strategy_a as string[]) ?? []
      const b = (input.strategy_b as string[]) ?? []
      const resultA = computeAllocation(a, amountUSD, sources, arsRate, argMonthlyInflation, usAnnualInflation)
      const resultB = computeAllocation(b, amountUSD, sources, arsRate, argMonthlyInflation, usAnnualInflation)
      return {
        strategy_a: { order: a, totalTrueCost: resultA.totalTrueCost, totalFees: resultA.totalFees, success: resultA.success },
        strategy_b: { order: b, totalTrueCost: resultB.totalTrueCost, totalFees: resultB.totalFees, success: resultB.success },
        winner: resultA.totalTrueCost <= resultB.totalTrueCost ? 'strategy_a' : 'strategy_b',
        savings: round(Math.abs(resultA.totalTrueCost - resultB.totalTrueCost)),
      }
    },
  }
}
