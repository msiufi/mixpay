// src/pages/Success.tsx
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router'
import type { OptimizationResult } from '../types'
import type { AgentPipelineResult } from '../lib/agents/types'
import { getWorstCaseFee } from '../lib/optimizer'
import { getSourceColors } from '../lib/source-colors'
import InfletaInsightPanel from '../components/InfletaInsightPanel'

interface LocationState {
  merchant: string
  amount: number
  result: OptimizationResult
  pipelineResult?: AgentPipelineResult
}

export default function Success() {
  const location = useLocation()
  const navigate = useNavigate()
  const state = location.state as LocationState | null

  useEffect(() => {
    if (!state) navigate('/')
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (!state) return null

  const { merchant, amount, result, pipelineResult } = state
  const worstCaseFee = getWorstCaseFee(amount)
  const savings = parseFloat((worstCaseFee - result.totalFees).toFixed(4))
  const hasCreditCard = result.sourceUsages.some(u => u.feeRate > 0.01)

  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4">
        {/* Success Header */}
        <div className="text-center py-4">
          <div className="w-20 h-20 bg-emerald-500/10 rounded-full mx-auto flex items-center justify-center mb-5">
            <svg className="w-10 h-10 text-emerald-400" viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="20" r="18" stroke="currentColor" strokeWidth="1.5" />
              <path
                d="M12 21 L18 27 L28 15"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <h1
            className="text-2xl font-bold text-[#F8FAFC]"
            style={{ fontFamily: "'Orbitron', sans-serif" }}
          >
            Payment Approved
          </h1>
          <p className="text-[#64748B] mt-1 text-sm">
            {merchant} · ${amount.toFixed(2)} USD
          </p>
        </div>

        {/* Payment Breakdown */}
        <div className="bg-[#272F42] rounded-2xl p-6 border border-[#334155]">
          <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-4">
            Payment Breakdown
          </p>
          <div className="space-y-3">
            {result.sourceUsages.map(usage => {
              const colors = getSourceColors(usage.sourceId)
              return (
                <div key={usage.sourceId} className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full ${colors.dot} inline-block`} />
                    <span className="text-sm font-medium text-[#94A3B8]">{usage.label}</span>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-[#F8FAFC]">${usage.amountUSD.toFixed(2)}</p>
                    {usage.currency === 'ARS' && (
                      <p className="text-xs text-[#64748B]">
                        {usage.amountOriginal.toLocaleString()} ARS
                      </p>
                    )}
                  </div>
                </div>
              )
            })}
            <div className="flex justify-between items-center border-t border-[#334155] pt-3">
              <span className="text-sm text-[#64748B]">Conversion fees</span>
              <span className="text-sm text-[#64748B]">${result.totalFees.toFixed(4)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-bold text-[#F8FAFC]">Total charged</span>
              <span className="font-bold text-[#F59E0B] text-lg">${amount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* Savings Comparison */}
        {savings > 0.001 && (
          <div className="bg-emerald-500/5 rounded-2xl p-5 border border-emerald-500/20">
            <p className="text-xs font-semibold text-emerald-400 uppercase tracking-wide mb-3">
              MixPay Savings
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-[#94A3B8]">
                <span>Traditional Visa (3.5% fee)</span>
                <span>${(amount + worstCaseFee).toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-[#94A3B8]">
                <span>With MixPay</span>
                <span>${(amount + result.totalFees).toFixed(2)}</span>
              </div>
              <div className="flex justify-between font-bold text-emerald-400 border-t border-emerald-500/20 pt-2">
                <span>You saved</span>
                <span>${savings.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}

        {/* Infleta-Style Insight Panel */}
        {pipelineResult && (
          <InfletaInsightPanel
            insights={pipelineResult.explanation.insightLines}
            riskAssessment={pipelineResult.riskAssessment}
          />
        )}

        {/* Info Cards */}
        <div className="grid grid-cols-2 gap-3">
          {!hasCreditCard && (
            <div className="bg-emerald-500/10 rounded-xl p-4 border border-emerald-500/20">
              <div className="mb-2">
                <svg className="w-5 h-5 text-emerald-400" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
                  <path
                    d="M6 10.5 L9 13.5 L14 7.5"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <p className="text-sm font-semibold text-emerald-400 leading-snug">
                No credit card used
              </p>
            </div>
          )}
          <div
            className={`bg-[#8B5CF6]/10 rounded-xl p-4 border border-[#8B5CF6]/20 ${
              hasCreditCard ? 'col-span-2' : ''
            }`}
          >
            <div className="mb-2">
              <svg className="w-5 h-5 text-[#8B5CF6]" viewBox="0 0 20 20" fill="currentColor">
                <path
                  fillRule="evenodd"
                  d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z"
                  clipRule="evenodd"
                />
              </svg>
            </div>
            <p className="text-sm font-semibold text-[#8B5CF6] leading-snug">
              AI-optimized routing
            </p>
          </div>
        </div>

        {/* Back Button */}
        <button
          onClick={() => navigate('/')}
          className="w-full bg-[#F59E0B] text-[#0F172A] py-4 rounded-xl font-semibold hover:bg-[#FBBF24] active:scale-95 transition-all"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  )
}
