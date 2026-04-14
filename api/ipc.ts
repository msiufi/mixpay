// Vercel serverless function — proxies INDEC IPC data from datos.gob.ar

import type { VercelRequest, VercelResponse } from '@vercel/node'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const upstream = await fetch(
      'https://apis.datos.gob.ar/series/api/series/?ids=103.1_I2N_2016_M_15&last=2&format=json',
      { headers: { Accept: 'application/json' } },
    )
    const data = await upstream.json()
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200')
    return res.status(200).json(data)
  } catch (err) {
    return res.status(502).json({ error: 'Upstream API failed', detail: String(err) })
  }
}
