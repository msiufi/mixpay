// Client-side rates cache — fetches on app load, reuses during payment.
// TTL-based: refreshes in background every 2 minutes.

import type { PaymentSource } from '../types'
import type { EnrichedSource, LiveRates } from './agents/types'

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
  const [dollarData, configData, cerData] = await Promise.all([
    fetchJson('/api/rates?type=blue', 'https://dolarapi.com/v1/dolares/blue'),
    fetchJson('/api/yields?source=config', 'https://rendimientos.co/api/config'),
    fetchJson('/api/yields?source=cer-ultimo', 'https://rendimientos.co/api/cer-ultimo'),
  ])

  // Parse dollar rate
  const dollar = dollarData as { compra?: number; venta?: number } | null
  const arsExchangeRate = dollar?.venta ?? 1400

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

  // Parse CER inflation
  const cer = cerData as { cer?: number; valor?: number } | null
  const monthlyInflation = 0.029 // approximate; CER is an index, not a direct monthly rate

  return {
    arsExchangeRate,
    fciTopFunds,
    monthlyInflation,
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
      monthlyInflation: 0.029,
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
