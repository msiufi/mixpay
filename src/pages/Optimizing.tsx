// src/pages/Optimizing.tsx
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import type { PaymentSource } from '../types'
import type { StreamPhase } from '../lib/agents/types'
import { getSourceColors } from '../lib/source-colors'
import { useSession } from '../context/SessionContext'
import { useOptimizationStream } from '../hooks/useOptimizationStream'
import BalanceBar from '../components/BalanceBar'
import { COMMISSION_RATE } from '../lib/config'
import { fmt } from '../lib/format'

interface LocationState {
  merchant: string
  amount: number
  sources: PaymentSource[]
}

/** Map stream phases to step numbers for the existing CSS transitions. */
const PHASE_STEP: Record<StreamPhase, number> = {
  idle: 0,
  fetching_rates: 1,
  optimizing: 2,
  assessing_risk: 3,
  generating_insight: 4,
  complete: 5,
  error: 0,
}

/** The 4 visible agent phases for the stepper (idle/complete/error are not shown as steps). */
const AGENT_PHASES: { phase: StreamPhase; label: string }[] = [
  { phase: 'fetching_rates', label: 'Rates' },
  { phase: 'optimizing', label: 'Optimize' },
  { phase: 'assessing_risk', label: 'Risk' },
  { phase: 'generating_insight', label: 'Insight' },
]

export default function Optimizing() {
  const location = useLocation()
  const navigate = useNavigate()
  const { applyPayment, transactions } = useSession()
  const state = location.state as LocationState | null

  // Always call hook (React rules) — pass safe defaults when state is null
  const streamState = useOptimizationStream(
    state?.merchant ?? '',
    state?.amount ?? 0,
    state?.sources ?? [],
    transactions,
  )

  // Track previous phase for fade-in transition on phase label
  const [phaseLabelVisible, setPhaseLabelVisible] = useState(true)
  const prevPhaseRef = useRef<StreamPhase>(streamState.phase)

  useEffect(() => {
    if (streamState.phase !== prevPhaseRef.current) {
      // Trigger a quick fade-out then fade-in
      setPhaseLabelVisible(false)
      const timer = setTimeout(() => {
        setPhaseLabelVisible(true)
        prevPhaseRef.current = streamState.phase
      }, 150)
      return () => clearTimeout(timer)
    }
  }, [streamState.phase])

  if (!state) {
    navigate('/')
    return null
  }

  const { merchant, amount, sources } = state
  const step = PHASE_STEP[streamState.phase]
  const result = streamState.result?.optimizationResult ?? null

  const canConfirm = result?.success === true

  function handleConfirm() {
    if (!result || !canConfirm) return
    applyPayment(result, merchant, amount)
    navigate('/success', {
      state: {
        merchant,
        amount,
        result,
        pipelineResult: streamState.result,
      },
    })
  }

  /** Determine the status of a stepper phase: 'completed' | 'active' | 'upcoming' */
  function getPhaseStatus(phaseStep: number): 'completed' | 'active' | 'upcoming' {
    if (step > phaseStep) return 'completed'
    if (step === phaseStep) return 'active'
    return 'upcoming'
  }

  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-6">
      <div className="w-full max-w-sm">

        {/* ── Phase Step Indicator (Stepper) ─────────────────────────── */}
        {step >= 1 && step <= 5 && (
          <div className="mb-5">
            <div className="flex items-center justify-between px-2">
              {AGENT_PHASES.map((ap, i) => {
                const phaseStep = PHASE_STEP[ap.phase]
                const status = getPhaseStatus(phaseStep)
                return (
                  <div key={ap.phase} className="flex items-center flex-1">
                    <div className="flex flex-col items-center flex-1">
                      {/* Dot */}
                      <div
                        className={`
                          w-3.5 h-3.5 rounded-full transition-all duration-500 relative
                          ${status === 'completed'
                            ? 'bg-[#10B981] shadow-[0_0_8px_rgba(16,185,129,0.5)]'
                            : status === 'active'
                              ? 'bg-[#F59E0B] shadow-[0_0_12px_rgba(245,158,11,0.6)]'
                              : 'bg-[#334155]'
                          }
                        `}
                      >
                        {status === 'active' && (
                          <div className="absolute inset-0 rounded-full bg-[#F59E0B] animate-ping opacity-40" />
                        )}
                        {status === 'completed' && (
                          <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 14 14" fill="none">
                            <path d="M3.5 7L6 9.5L10.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </div>
                      {/* Label */}
                      <span
                        className={`text-[10px] mt-1.5 font-medium tracking-wide transition-colors duration-500 ${
                          status === 'completed'
                            ? 'text-[#10B981]'
                            : status === 'active'
                              ? 'text-[#F59E0B]'
                              : 'text-[#475569]'
                        }`}
                      >
                        {ap.label}
                      </span>
                    </div>
                    {/* Connector line between dots */}
                    {i < AGENT_PHASES.length - 1 && (
                      <div
                        className={`h-[2px] flex-1 mx-1 -mt-4 rounded-full transition-all duration-700 ${
                          step > phaseStep ? 'bg-[#10B981]' : 'bg-[#1E293B]'
                        }`}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Status Header ──────────────────────────────────────────── */}
        <div className="text-center mb-4 min-h-[2.5rem] flex flex-col items-center justify-center gap-1.5">
          {step === 0 ? (
            <div className="flex items-center gap-2 text-[#64748B]">
              <div className="w-4 h-4 border-2 border-[#334155] border-t-[#F59E0B] rounded-full animate-spin" />
              <span className="text-sm">AI analyzing your {sources.length} payment sources...</span>
            </div>
          ) : step < 5 ? (
            <>
              {/* Phase label with fade transition */}
              <span
                className={`text-[#F59E0B] font-semibold text-sm tracking-widest uppercase transition-all duration-200 ${
                  phaseLabelVisible ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-1'
                }`}
              >
                {streamState.phaseLabel}
              </span>
              {/* Tool call badge — prominent with pulsing glow */}
              {streamState.toolCallName && (
                <div className="relative">
                  {/* Glow layer */}
                  <div
                    className="absolute inset-0 rounded-lg blur-md animate-pulse"
                    style={{
                      background: 'linear-gradient(135deg, rgba(139,92,246,0.3), rgba(245,158,11,0.3))',
                    }}
                  />
                  <span
                    className="relative inline-flex items-center gap-1.5 text-xs font-mono px-3 py-1 rounded-lg border animate-pulse"
                    style={{
                      background: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(30,41,59,0.9))',
                      borderColor: 'rgba(139,92,246,0.4)',
                      color: '#C4B5FD',
                      boxShadow: '0 0 20px rgba(139,92,246,0.2), inset 0 0 12px rgba(139,92,246,0.05)',
                    }}
                  >
                    <span style={{ color: '#F59E0B', fontSize: '11px' }}>⚡</span>
                    {streamState.toolCallName}()
                  </span>
                </div>
              )}
            </>
          ) : (
            <span className="text-[#F59E0B] font-semibold text-sm tracking-widest uppercase">
              Payment Optimization
            </span>
          )}
        </div>

        {/* ── Thinking snippet ───────────────────────────────────────── */}
        {streamState.thinkingSnippet && step >= 2 && step < 5 && (
          <div
            className="mb-4 rounded-xl px-4 py-2.5 border border-[rgba(139,92,246,0.2)]"
            style={{
              background: 'linear-gradient(135deg, rgba(30,41,59,0.95), rgba(39,47,66,0.95), rgba(30,41,59,0.95))',
              boxShadow: '0 0 24px rgba(139,92,246,0.06), inset 0 1px 0 rgba(255,255,255,0.03)',
            }}
          >
            <div className="flex items-start gap-2">
              <span className="text-[10px] text-[#8B5CF6] mt-0.5 shrink-0 opacity-60">AI</span>
              <p className="text-xs text-[#94A3B8] italic leading-relaxed line-clamp-2">
                {streamState.thinkingSnippet}
                <span
                  className="inline-block w-[2px] h-3 ml-0.5 align-middle bg-[#8B5CF6] rounded-full"
                  style={{
                    animation: 'cursorBlink 1s step-end infinite',
                  }}
                />
              </p>
            </div>
          </div>
        )}

        {/* Keyframe for blinking cursor */}
        <style>{`
          @keyframes cursorBlink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
          }
        `}</style>

        {/* ── Main Panel ─────────────────────────────────────────────── */}
        <div className="bg-[#272F42] border border-[#334155] rounded-2xl overflow-hidden shadow-2xl">
          {/* Panel Header */}
          <div className="px-6 py-4 border-b border-[#334155] flex items-center justify-between">
            <div>
              <p className="text-xs text-[#64748B]">Paying to</p>
              <p className="font-bold text-[#F8FAFC]">{merchant}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-[#64748B]">Amount</p>
              <p className="text-2xl font-bold text-[#F59E0B]">${fmt(amount)}</p>
            </div>
          </div>

          <div className="px-6 py-5 space-y-5">
            {/* Available Balances */}
            <div
              className={`transition-all duration-500 ${
                step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
              }`}
            >
              <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-3">
                Available Sources
              </p>
              <div className="space-y-3">
                {sources.map((source, i) => {
                  const colors = getSourceColors(source.id)
                  const displayTotal = source.available
                  const displayUsed = step >= 2 ? displayTotal : 0
                  return (
                    <BalanceBar
                      key={source.id}
                      label={source.label}
                      symbol={source.symbol}
                      total={displayTotal}
                      used={displayUsed}
                      color={colors.bar}
                      delay={i * 120}
                    />
                  )
                })}
              </div>
            </div>

            {/* Selected Combination */}
            {result && (
              <div
                className={`transition-all duration-500 ${
                  step >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
                }`}
              >
                <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-3">
                  Selected Combination
                </p>
                <div className="space-y-2">
                  {result.sourceUsages.map(usage => {
                    const colors = getSourceColors(usage.sourceId)
                    return (
                      <div
                        key={usage.sourceId}
                        className={`flex justify-between items-center ${colors.bg} rounded-lg px-3 py-2.5`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-2 h-2 rounded-full ${colors.dot} inline-block`} />
                          <span className={`text-sm font-semibold ${colors.text}`}>
                            {usage.label}
                          </span>
                        </div>
                        <div className="text-right">
                          <p className={`text-sm font-bold ${colors.text}`}>
                            ${fmt(usage.amountUSD)}
                          </p>
                          {usage.currency === 'ARS' && (
                            <p className="text-xs opacity-70" style={{ color: 'inherit' }}>
                              {usage.amountOriginal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ARS
                            </p>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Summary Box */}
            {result && (
              <div
                className={`transition-all duration-500 ${
                  step >= 4 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
                }`}
              >
                <div className="bg-[#1E293B] rounded-xl px-4 py-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-[#94A3B8]">Conversion fees</span>
                    <span className="font-medium text-[#F8FAFC]">
                      ${fmt(result.totalFees)}
                    </span>
                  </div>
                  {(() => {
                    const gross = amount * 0.035 - result.totalFees
                    const comm = parseFloat((gross * COMMISSION_RATE).toFixed(2))
                    return (
                      <>
                        <div className="flex justify-between text-sm">
                          <span className="text-[#94A3B8]">MixPay fee ({(COMMISSION_RATE * 100).toFixed(0)}% of savings)</span>
                          <span className="font-medium text-[#F8FAFC]">${fmt(comm)}</span>
                        </div>
                        <div className="flex justify-between text-sm border-t border-[#334155] pt-2">
                          <span className="font-semibold text-[#F8FAFC]">Total</span>
                          <span className="font-bold text-[#F8FAFC]">${fmt(amount + result.totalFees + comm)}</span>
                        </div>
                      </>
                    )
                  })()}
                </div>
              </div>
            )}
          </div>

          {/* Error state */}
          {streamState.phase === 'error' && (
            <div className="px-6 pb-4">
              <p className="text-sm text-red-400">{streamState.error}</p>
            </div>
          )}

          {/* Insufficient funds warning */}
          {result && !canConfirm && step >= 5 && (
            <div className="px-6 pb-2">
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-3 text-center">
                <p className="text-sm font-medium text-red-400">Insufficient funds</p>
                <p className="text-xs text-[#64748B] mt-1">
                  You need ${fmt(amount - (result?.totalUSD ?? 0))} more to complete this payment.
                </p>
              </div>
            </div>
          )}

          {/* Confirm Button */}
          <div
            className={`px-6 pb-6 transition-all duration-500 ${
              step >= 5
                ? 'opacity-100 translate-y-0'
                : 'opacity-0 translate-y-4 pointer-events-none'
            }`}
          >
            <button
              onClick={handleConfirm}
              disabled={!canConfirm}
              className="w-full bg-[#F59E0B] text-[#0F172A] py-4 rounded-xl font-bold text-base hover:bg-[#FBBF24] active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
            >
              {canConfirm ? 'Confirm Payment →' : 'Insufficient Funds'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
