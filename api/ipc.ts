// Vercel serverless function — proxies INDEC IPC data from datos.gob.ar

import type { VercelRequest, VercelResponse } from '@vercel/node'

const IPC_URL = 'https://apis.datos.gob.ar/series/api/series/'

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')

  if (req.method === 'OPTIONS') return res.status(200).end()

  try {
    const url = new URL(IPC_URL)
    url.searchParams.set('ids', '103.1_I2N_2016_M_15')
    url.searchParams.set('last', '2')
    url.searchParams.set('format', 'json')

    const upstream = await fetch(url.toString(), {
      headers: {
        'Accept': 'application/json',
        'User-Agent': 'MixPay/1.0',
      },
      redirect: 'follow',
    })

    const text = await upstream.text()

    // Check if we got HTML instead of JSON (redirect/block)
    if (text.startsWith('<!') || text.startsWith('<html')) {
      return res.status(502).json({ error: 'Upstream returned HTML instead of JSON' })
    }

    const data = JSON.parse(text)
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=7200')
    return res.status(200).json(data)
  } catch (err) {
    return res.status(502).json({ error: 'Upstream API failed', detail: String(err) })
  }
}
