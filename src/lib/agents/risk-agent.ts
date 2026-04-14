// Risk Agent — fast Claude Haiku call to flag unusual transactions.

import { callClaude } from '../claude-client'
import { RISK_MODEL } from '../config'
import type { AgentEvent, RiskAssessment } from './types'

const SYSTEM_PROMPT = `You are MixPay's risk assessment agent. Evaluate whether a payment transaction looks normal or suspicious.

Consider:
- Is the amount unusually large compared to recent history?
- Is the merchant unusual or potentially fraudulent?
- Would this payment deplete a large portion of the user's funds?

Return ONLY a JSON object (no markdown fences):
{
  "level": "low" | "medium" | "high",
  "flags": ["string array of specific concerns, empty if none"],
  "recommendation": "one sentence recommendation"
}`

export async function runRiskAgent(
  merchant: string,
  amount: number,
  recentTransactions: { merchant: string; amount: number }[],
  onEvent: (e: AgentEvent) => void,
): Promise<RiskAssessment> {
  onEvent({ kind: 'agent_start', agentName: 'RiskAgent', timestamp: Date.now() })

  const recentSummary = recentTransactions.length > 0
    ? recentTransactions.map(t => `${t.merchant}: $${t.amount}`).join(', ')
    : 'No recent transactions'

  const avgAmount = recentTransactions.length > 0
    ? recentTransactions.reduce((s, t) => s + t.amount, 0) / recentTransactions.length
    : 0

  const prompt = `Assess this payment:
- Merchant: ${merchant}
- Amount: $${amount.toFixed(2)}
- Recent transactions: ${recentSummary}
- Average recent amount: $${avgAmount.toFixed(2)}

Is this transaction normal?`

  const responseText = await callClaude(prompt, {
    model: RISK_MODEL,
    maxTokens: 256,
    systemPrompt: SYSTEM_PROMPT,
  })

  let assessment: RiskAssessment = {
    level: 'low',
    flags: [],
    recommendation: 'Transaction appears normal.',
  }

  try {
    const cleaned = responseText.replace(/^```json\n?/, '').replace(/\n?```$/, '').trim()
    const parsed = JSON.parse(cleaned)
    assessment = {
      level: parsed.level ?? 'low',
      flags: Array.isArray(parsed.flags) ? parsed.flags : [],
      recommendation: parsed.recommendation ?? 'Transaction appears normal.',
    }
  } catch {
    // Parse failed — default to low risk
  }

  onEvent({ kind: 'agent_done', agentName: 'RiskAgent', timestamp: Date.now() })
  return assessment
}
