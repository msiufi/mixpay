// src/pages/Optimizing.tsx
import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router'
import type { OptimizationResult, PaymentSource } from '../types'
import { optimizePayment } from '../lib/optimizer'
import { getSourceColors } from '../lib/source-colors'
import { useSession } from '../context/SessionContext'
import BalanceBar from '../components/BalanceBar'

interface LocationState {
  merchant: string
  amount: number
  sources: PaymentSource[]
}

export default function Optimizing() {
  const location = useLocation()
  const navigate = useNavigate()
  const { applyPayment } = useSession()
  const state = location.state as LocationState | null

  const [step, setStep] = useState(0)
  const [result, setResult] = useState<OptimizationResult | null>(null)

  useEffect(() => {
    if (!state) {
      navigate('/')
      return
    }

    const timers = [
      setTimeout(() => setStep(1), 700),
      setTimeout(() => setStep(2), 1400),
      setTimeout(() => {
        const r = optimizePayment(state.amount, state.sources)
        setResult(r)
        setStep(3)
      }, 2400),
      setTimeout(() => setStep(4), 3100),
      setTimeout(() => setStep(5), 3700),
    ]

    return () => timers.forEach(clearTimeout)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!state) return null

  const { merchant, amount, sources } = state

  function handleConfirm() {
    if (!result) return
    applyPayment(result, merchant, amount)
    navigate('/success', { state: { merchant, amount, result } })
  }

  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Status Header */}
        <div className="text-center mb-6 h-8 flex items-center justify-center">
          {step === 0 ? (
            <div className="flex items-center gap-2 text-[#64748B]">
              <div className="w-4 h-4 border-2 border-[#334155] border-t-[#F59E0B] rounded-full animate-spin" />
              <span className="text-sm">AI analyzing your {sources.length} payment sources...</span>
            </div>
          ) : (
            <span className="text-[#F59E0B] font-semibold text-sm tracking-widest uppercase">
              Payment Optimization
            </span>
          )}
        </div>

        {/* Main Panel */}
        <div className="bg-[#272F42] border border-[#334155] rounded-2xl overflow-hidden shadow-2xl">
          {/* Panel Header */}
          <div className="px-6 py-4 border-b border-[#334155] flex items-center justify-between">
            <div>
              <p className="text-xs text-[#64748B]">Paying to</p>
              <p className="font-bold text-[#F8FAFC]">{merchant}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-[#64748B]">Amount</p>
              <p className="text-2xl font-bold text-[#F59E0B]">${amount.toFixed(2)}</p>
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
                  const displayTotal = source.currency === 'ARS'
                    ? source.available
                    : source.available
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
                            ${usage.amountUSD.toFixed(2)}
                          </p>
                          {usage.currency === 'ARS' && (
                            <p className="text-xs opacity-70" style={{ color: 'inherit' }}>
                              {usage.amountOriginal.toLocaleString()} ARS
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
                    <span className="text-[#94A3B8]">Estimated fees</span>
                    <span className="font-medium text-[#F8FAFC]">
                      ${result.totalFees.toFixed(4)} USD
                    </span>
                  </div>
                  <div className="flex justify-between text-sm border-t border-[#334155] pt-2">
                    <span className="font-semibold text-[#F8FAFC]">Total</span>
                    <span className="font-bold text-[#F8FAFC]">${(amount + result.totalFees).toFixed(4)} USD</span>
                  </div>
                </div>
              </div>
            )}
          </div>

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
              className="w-full bg-[#F59E0B] text-[#0F172A] py-4 rounded-xl font-bold text-base hover:bg-[#FBBF24] active:scale-95 transition-all"
            >
              Confirm Payment →
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
