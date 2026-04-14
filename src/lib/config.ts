// ── MixPay configuration ──────────────────────────────────────────────
// All tunable values in one place.

/** Commission rate as a fraction of gross savings (0.10 = 10%). */
export const COMMISSION_RATE = 0.10

/** Claude model for the Optimization Agent. 'claude-opus-4-6' for demo, 'claude-sonnet-4-6' for production. */
export const OPTIMIZATION_MODEL = 'claude-sonnet-4-6'

/** Claude model for the Explanation Agent. */
export const EXPLANATION_MODEL = 'claude-sonnet-4-6'

/** Claude model for the Risk Agent. */
export const RISK_MODEL = 'claude-haiku-4-5-20251001'

/** Claude model for the Rates Agent (tool_use). */
export const RATES_MODEL = 'claude-haiku-4-5-20251001'

/** Worst-case fee rate used for savings comparison (Visa 3.5%). */
export const WORST_CASE_FEE_RATE = 0.035

/** Monthly Argentine inflation estimate (used in insight calculations). */
export const ARG_MONTHLY_INFLATION = 0.029
