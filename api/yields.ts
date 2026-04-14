// Vercel serverless function — proxies rendimientos.co APIs for the browser
// (solves CORS when calling from the client-side React app)

import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()

  const source = (req.query.source as string) ?? 'fci'

  const endpoints: Record<string, string> = {
    fci: 'https://rendimientos.co/api/fci',
    config: 'https://rendimientos.co/api/config',
    cer: 'https://rendimientos.co/api/cer-ultimo',
    'cer-ultimo': 'https://rendimientos.co/api/cer-ultimo',
    lecaps: 'https://rendimientos.co/api/lecaps',
    mundo: 'https://rendimientos.co/api/mundo',
  }

  const url = endpoints[source]
  if (!url) return res.status(400).json({ error: `Unknown source: ${source}` })

  try {
    const upstream = await fetch(url, { headers: { Accept: 'application/json' } })
    const data = await upstream.json()
    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=300')
    return res.status(200).json(data)
  } catch (err) {
    return res.status(502).json({ error: 'Upstream API failed', detail: String(err) })
  }
}
