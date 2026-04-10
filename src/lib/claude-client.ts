const CLAUDE_API_KEY = import.meta.env.VITE_CLAUDE_API_KEY as string | undefined

export async function callClaude(prompt: string): Promise<string> {
  if (!CLAUDE_API_KEY) return ''

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': CLAUDE_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-opus-4-6',
        max_tokens: 300,
        messages: [{ role: 'user', content: prompt }],
      }),
    })

    if (!response.ok) return ''
    const data = await response.json()
    return (data.content?.[0]?.text as string) ?? ''
  } catch {
    return ''
  }
}
