// ── Claude API client ────────────────────────────────────────────────
// Three primitives: callClaude (one-shot), callClaudeStreaming (SSE),
// callClaudeWithTools (tool-use loop).  All browser-safe.

const CLAUDE_API_KEY = import.meta.env.VITE_CLAUDE_API_KEY as string | undefined
const BASE_URL = 'https://api.anthropic.com/v1/messages'

export function hasApiKey(): boolean {
  return !!CLAUDE_API_KEY
}

// ── Types ────────────────────────────────────────────────────────────

export interface ClaudeMessage {
  role: 'user' | 'assistant'
  content: string | ClaudeContentBlock[]
}

export type ClaudeContentBlock =
  | { type: 'text'; text: string }
  | { type: 'thinking'; thinking: string }
  | { type: 'tool_use'; id: string; name: string; input: Record<string, unknown> }
  | { type: 'tool_result'; tool_use_id: string; content: string; is_error?: boolean }

export interface ClaudeTool {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

export interface ClaudeCallOptions {
  model?: string
  maxTokens?: number
  systemPrompt?: string
  thinking?: { type: 'enabled'; budgetTokens: number }
  temperature?: number
}

export interface ClaudeStreamEvent {
  type: string
  index?: number
  content_block?: { type: string; id?: string; name?: string }
  delta?: { type: string; text?: string; thinking?: string }
  message?: Record<string, unknown>
}

// ── Helpers ──────────────────────────────────────────────────────────

function headers(useThinking: boolean): Record<string, string> {
  const h: Record<string, string> = {
    'x-api-key': CLAUDE_API_KEY ?? '',
    'anthropic-version': '2023-06-01',
    'content-type': 'application/json',
    'anthropic-dangerous-direct-browser-access': 'true',
  }
  if (useThinking) {
    h['anthropic-beta'] = 'interleaved-thinking-2025-05-14'
  }
  return h
}

function buildBody(
  messages: ClaudeMessage[],
  options: ClaudeCallOptions,
  extra?: Record<string, unknown>,
): Record<string, unknown> {
  const body: Record<string, unknown> = {
    model: options.model ?? 'claude-sonnet-4-6',
    max_tokens: options.maxTokens ?? 1024,
    messages,
    ...extra,
  }
  if (options.systemPrompt) body.system = options.systemPrompt
  if (options.thinking) {
    body.thinking = { type: 'enabled', budget_tokens: options.thinking.budgetTokens }
    body.temperature = 1 // required by Anthropic when thinking is on
  } else if (options.temperature !== undefined) {
    body.temperature = options.temperature
  }
  return body
}

// ── 1. One-shot call (backward-compatible) ───────────────────────────

export async function callClaude(
  promptOrMessages: string | ClaudeMessage[],
  options: ClaudeCallOptions = {},
): Promise<string> {
  if (!CLAUDE_API_KEY) return ''

  const messages: ClaudeMessage[] =
    typeof promptOrMessages === 'string'
      ? [{ role: 'user', content: promptOrMessages }]
      : promptOrMessages

  try {
    const res = await fetch(BASE_URL, {
      method: 'POST',
      headers: headers(!!options.thinking),
      body: JSON.stringify(buildBody(messages, options)),
    })
    if (!res.ok) return ''
    const data = await res.json()
    const textBlock = (data.content as ClaudeContentBlock[])?.find(
      (b): b is { type: 'text'; text: string } => b.type === 'text',
    )
    return textBlock?.text ?? ''
  } catch {
    return ''
  }
}

// ── 2. Streaming call ────────────────────────────────────────────────

export async function* callClaudeStreaming(
  messages: ClaudeMessage[],
  options: ClaudeCallOptions = {},
): AsyncGenerator<ClaudeStreamEvent> {
  if (!CLAUDE_API_KEY) return

  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: headers(!!options.thinking),
    body: JSON.stringify(buildBody(messages, options, { stream: true })),
  })

  if (!res.ok || !res.body) return

  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break

    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data: ')) continue
      const payload = trimmed.slice(6)
      if (payload === '[DONE]') return
      try {
        yield JSON.parse(payload) as ClaudeStreamEvent
      } catch {
        // skip malformed SSE lines
      }
    }
  }
}

// ── 3. Tool-use call (multi-round loop) ──────────────────────────────

export async function callClaudeWithTools(
  initialMessages: ClaudeMessage[],
  tools: ClaudeTool[],
  toolHandlers: Record<string, (input: Record<string, unknown>) => Promise<unknown>>,
  options: ClaudeCallOptions = {},
  onToolCall?: (name: string, input: Record<string, unknown>) => void,
  onToolResult?: (name: string, result: unknown) => void,
): Promise<string> {
  if (!CLAUDE_API_KEY) return ''

  let messages = [...initialMessages]
  const baseBody = buildBody(messages, options, { tools })

  try {
    for (let round = 0; round < 10; round++) {
      const res = await fetch(BASE_URL, {
        method: 'POST',
        headers: headers(false),
        body: JSON.stringify({ ...baseBody, messages }),
      })
      if (!res.ok) return ''
      const data = await res.json()
      const content = data.content as ClaudeContentBlock[]

      const toolUseBlocks = content.filter(
        (b): b is Extract<ClaudeContentBlock, { type: 'tool_use' }> => b.type === 'tool_use',
      )

      if (toolUseBlocks.length === 0) {
        const textBlock = content.find(
          (b): b is { type: 'text'; text: string } => b.type === 'text',
        )
        return textBlock?.text ?? ''
      }

      // Append assistant response (preserving all content blocks)
      messages = [...messages, { role: 'assistant' as const, content }]

      // Execute tool calls and collect results
      const results: ClaudeContentBlock[] = []
      for (const tc of toolUseBlocks) {
        onToolCall?.(tc.name, tc.input)
        let result: unknown
        try {
          const handler = toolHandlers[tc.name]
          result = handler ? await handler(tc.input) : { error: `Unknown tool: ${tc.name}` }
        } catch (err) {
          result = { error: String(err) }
        }
        onToolResult?.(tc.name, result)
        results.push({
          type: 'tool_result',
          tool_use_id: tc.id,
          content: JSON.stringify(result),
        })
      }

      messages = [...messages, { role: 'user' as const, content: results }]
    }
    return ''
  } catch {
    return ''
  }
}
