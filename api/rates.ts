// Vercel serverless function — proxies dolarapi.com for the browser

import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()

  const type = (req.query.type as string) ?? 'all'

  const endpoints: Record<string, string> = {
    all: 'https://dolarapi.com/v1/dolares',
    blue: 'https://dolarapi.com/v1/dolares/blue',
    oficial: 'https://dolarapi.com/v1/dolares/oficial',
    mep: 'https://dolarapi.com/v1/dolares/bolsa',
    ccl: 'https://dolarapi.com/v1/dolares/contadoconliqui',
    tarjeta: 'https://dolarapi.com/v1/dolares/tarjeta',
    cripto: 'https://dolarapi.com/v1/dolares/cripto',
  }

  const url = endpoints[type]
  if (!url) return res.status(400).json({ error: `Unknown type: ${type}` })

  try {
    const upstream = await fetch(url, { headers: { Accept: 'application/json' } })
    const data = await upstream.json()
    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=120')
    return res.status(200).json(data)
  } catch (err) {
    return res.status(502).json({ error: 'Upstream API failed', detail: String(err) })
  }
}
