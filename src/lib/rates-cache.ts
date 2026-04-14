// Client-side rates cache — fetches on app load, reuses during payment.
// TTL-based: refreshes in background every 2 minutes.

import type { PaymentSource } from '../types'
import type { EnrichedSource, LiveRates } from './agents/types'
import { ARG_MONTHLY_INFLATION, US_ANNUAL_INFLATION } from './config'

const CACHE_TTL = 2 * 60 * 1000 // 2 minutes

interface CacheEntry {
  liveRates: LiveRates
  fetchedAt: number
}

let cache: CacheEntry | null = null
let fetchPromise: Promise<void> | null = null

// ── Fetch helpers ────────────────────────────────────────────────────

async function fetchJson(proxyUrl: string, directUrl: string): Promise<unknown> {
  for (const url of [proxyUrl, directUrl]) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
      if (res.ok) return await res.json()
    } catch { /* CORS or timeout */ }
  }
  return null
}

async function fetchLiveRates(): Promise<LiveRates> {
  // Fetch all 3 data sources in parallel
  const [oficialData, mepData, configData, cerData] = await Promise.all([
    fetchJson('/api/rates?type=oficial', '/api/rates?type=oficial'),
    fetchJson('/api/rates?type=mep', '/api/rates?type=mep'),
    fetchJson('/api/yields?source=config', '/api/yields?source=config'),
    fetchJson('/api/yields?source=cer-ultimo', '/api/yields?source=cer-ultimo'),
  ])

  // Parse dollar rates — take the best (highest) sell rate between oficial and MEP
  const oficial = oficialData as { compra?: number; venta?: number } | null
  const mep = mepData as { compra?: number; venta?: number } | null
  const oficialRate = oficial?.venta ?? 0
  const mepRate = mep?.venta ?? 0
  const arsExchangeRate = Math.max(oficialRate, mepRate) || 1400

  // Parse FCI yields from config
  let fciTopFunds: { name: string; tna: number }[] = []
  if (configData && typeof configData === 'object') {
    const config = configData as Record<string, unknown>
    const allProducts = [
      ...((config.garantizados ?? []) as Record<string, unknown>[]),
      ...((config.especiales ?? []) as Record<string, unknown>[]),
    ]
    fciTopFunds = allProducts
      .filter(f => typeof f.tna === 'number' && f.activo !== false)
      .map(f => ({ name: String(f.nombre ?? 'Unknown'), tna: Number(f.tna) }))
      .sort((a, b) => b.tna - a.tna)
      .slice(0, 5)
  }
  if (fciTopFunds.length === 0) {
    fciTopFunds = [{ name: 'FCI Money Market (est.)', tna: 40 }]
  }

  // Parse CER inflation — CER is an index, not a direct rate.
  // We store the index; monthly inflation estimate comes from config as default
  // but can be overridden by live data sources in the future.
  const cer = cerData as { cer?: number; valor?: number } | null
  const monthlyInflation = ARG_MONTHLY_INFLATION // from config, updated manually as new data comes in
  const usAnnualInflation = US_ANNUAL_INFLATION  // from config

  return {
    arsExchangeRate,
    fciTopFunds,
    monthlyInflation,
    usAnnualInflation,
    marketData: cer ? { cer: Number(cer.cer ?? cer.valor ?? 0) } : {},
  }
}

// ── Public API ───────────────────────────────────────────────────────

/** Trigger a background fetch. Safe to call multiple times — deduplicates. */
export function prefetchRates(): void {
  if (fetchPromise) return
  fetchPromise = fetchLiveRates()
    .then(rates => {
      cache = { liveRates: rates, fetchedAt: Date.now() }
    })
    .catch(() => {
      // Silently fail — getCachedRates returns fallback
    })
    .finally(() => {
      fetchPromise = null
    })
}

/** Wait for rates to be available. Returns cached if fresh, fetches if stale. */
export async function getRates(): Promise<LiveRates> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL) {
    return cache.liveRates
  }

  // Fetch fresh
  try {
    const rates = await fetchLiveRates()
    cache = { liveRates: rates, fetchedAt: Date.now() }
    return rates
  } catch {
    // Return cached even if stale, or fallback
    if (cache) return cache.liveRates
    return {
      arsExchangeRate: 1400,
      fciTopFunds: [{ name: 'FCI Money Market (est.)', tna: 40 }],
      monthlyInflation: ARG_MONTHLY_INFLATION,
      usAnnualInflation: US_ANNUAL_INFLATION,
      marketData: {},
    }
  }
}

/** Get cached rates synchronously (may be null if not yet fetched). */
export function getCachedRates(): LiveRates | null {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL) {
    return cache.liveRates
  }
  return null
}

/** Build enriched sources from cached rates + user sources. */
export function enrichSources(sources: PaymentSource[], liveRates: LiveRates): EnrichedSource[] {
  const bestFciYield = Math.max(...liveRates.fciTopFunds.map(f => f.tna)) / 100

  return sources.map(s => {
    let effectiveYieldRate = s.yieldRate ?? 0

    // Override ARS yield with live FCI data if available
    if (s.currency === 'ARS' && bestFciYield > 0) {
      effectiveYieldRate = bestFciYield
    }

    return {
      ...s,
      effectiveYieldRate,
      liveExchangeRate: s.currency === 'ARS' ? liveRates.arsExchangeRate : undefined,
    }
  })
}
