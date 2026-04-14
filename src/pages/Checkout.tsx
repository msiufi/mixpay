// src/pages/Checkout.tsx
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { useSession } from '../context/SessionContext'
import { mockCard } from '../lib/mock-data'
import { getCycleStatus } from '../lib/billing-cycle'

const PRESET_MERCHANTS = [
  { name: 'Nike Store',    icon: '👟' },
  { name: 'Spotify',       icon: '🎵' },
  { name: 'Amazon',        icon: '📦' },
  { name: 'Uber',          icon: '🚗' },
  { name: 'MercadoLibre',  icon: '🛒' },
]

export default function Checkout() {
  const navigate = useNavigate()
  const { sources } = useSession()

  const [merchant, setMerchant] = useState('Nike Store')
  const [rawAmount, setRawAmount] = useState(2000) // cents
  const [inputFocused, setInputFocused] = useState(false)

  const amount = rawAmount / 100
  const isValid = amount >= 1

  const cardSources = sources.filter(s => s.kind === 'credit_card')
  const closingSoonCards = cardSources.filter(s => {
    if (!s.closingDay || !s.dueDay) return false
    const cycle = getCycleStatus(s.closingDay, s.dueDay, new Date())
    return cycle.status === 'closing-soon'
  })

  const displayValue = inputFocused
    ? amount > 0 ? amount.toString() : ''
    : amount.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.replace(/[^0-9.]/g, '')
    const num = parseFloat(val)
    if (val === '' || val === '.') {
      setRawAmount(0)
    } else if (!isNaN(num)) {
      setRawAmount(Math.round(num * 100))
    }
  }

  function handlePay() {
    if (!isValid) return
    navigate('/optimizing', { state: { merchant, amount, sources } })
  }

  return (
    <div className="min-h-screen bg-[#0F172A] flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4">
        <button
          onClick={() => navigate('/')}
          className="text-sm text-[#64748B] hover:text-[#94A3B8] flex items-center gap-1 transition-colors"
        >
          ← Back
        </button>

        {/* Merchant Picker */}
        <div className="bg-[#272F42] rounded-2xl p-5 border border-[#334155]">
          <p className="text-xs font-semibold text-[#64748B] uppercase tracking-wide mb-3">
            Select Merchant
          </p>
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {PRESET_MERCHANTS.map(m => (
              <button
                key={m.name}
                onClick={() => setMerchant(m.name)}
                className={`flex-shrink-0 flex flex-col items-center gap-1.5 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                  merchant === m.name
                    ? 'border-[#F59E0B] bg-[#F59E0B]/10 text-[#F59E0B]'
                    : 'border-[#334155] text-[#64748B] hover:border-[#64748B]'
                }`}
              >
                <span className="text-xl">{m.icon}</span>
                <span className="whitespace-nowrap">{m.name}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Amount Input */}
        <div className="bg-[#272F42] rounded-2xl p-6 border border-[#334155]">
          <p className="text-sm text-[#64748B] mb-3">Amount due</p>
          <div className="flex items-center gap-2">
            <span className="text-4xl font-bold text-[#F59E0B]">$</span>
            <input
              type="text"
              inputMode="decimal"
              value={displayValue}
              onChange={handleAmountChange}
              onFocus={() => setInputFocused(true)}
              onBlur={() => setInputFocused(false)}
              className="text-4xl font-bold text-[#F59E0B] bg-transparent border-none outline-none w-full tracking-tight"
              style={{ fontFamily: 'inherit' }}
            />
          </div>
          <p className="text-sm text-[#64748B] mt-2">United States Dollar</p>
          {!isValid && rawAmount > 0 && (
            <p className="text-xs text-rose-400 mt-1">Enter an amount of at least $1</p>
          )}
        </div>

        {/* Card Info */}
        <div className="bg-[#272F42] rounded-2xl p-4 border border-[#334155] flex items-center gap-3">
          <div className="w-12 h-8 bg-[#0F172A] rounded flex items-center justify-center flex-shrink-0">
            <span className="text-[#F8FAFC] text-xs font-bold">VISA</span>
          </div>
          <div>
            <p className="font-medium text-[#F8FAFC] text-sm">{mockCard.label}</p>
            <p className="text-xs text-[#64748B]">•••• •••• •••• {mockCard.last4}</p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 text-xs bg-[#8B5CF6]/20 text-[#8B5CF6] px-2.5 py-1 rounded-full font-medium">
            <span>✨</span>
            <span>AI Recommended</span>
          </div>
        </div>

        {/* AI Info Banner */}
        <div className="bg-[#1E293B] rounded-xl px-4 py-3 border border-[#334155] flex items-start gap-3">
          <div className="w-5 h-5 bg-[#8B5CF6] rounded-md flex items-center justify-center flex-shrink-0 mt-0.5">
            <svg className="w-3 h-3 text-white" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </div>
          <p className="text-xs text-[#94A3B8] leading-relaxed">
            MixPay AI will analyze your {sources.length} available payment sources and automatically choose the lowest-fee combination.
          </p>
        </div>

        {/* Billing cycle warning */}
        {closingSoonCards.length > 0 && (
          <div className="bg-[#FBBF24]/10 rounded-xl px-4 py-3 border border-[#FBBF24]/20 flex items-start gap-3">
            <span className="text-[#FBBF24] text-sm mt-0.5">⚠</span>
            <p className="text-xs text-[#FBBF24] leading-relaxed">
              {closingSoonCards.map(c => c.label).join(', ')} cierra pronto — el optimizador lo tendrá en cuenta.
            </p>
          </div>
        )}

        {/* Pay Button */}
        <button
          onClick={handlePay}
          disabled={!isValid}
          className="w-full bg-[#F59E0B] text-[#0F172A] py-4 rounded-xl font-bold text-lg hover:bg-[#FBBF24] active:scale-95 transition-all shadow-lg shadow-amber-500/20 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100"
        >
          Pay with MixPay
        </button>

        <p className="text-center text-xs text-[#64748B]">
          Secured by MixPay · AI-optimized routing
        </p>
      </div>
    </div>
  )
}
