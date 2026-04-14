// src/pages/Dashboard.tsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router'
import { useSession } from '../context/SessionContext'
import { ARS_RATE } from '../lib/optimizer'
import { getSourceColors } from '../lib/source-colors'
import { mockCard } from '../lib/mock-data'
import { getCachedRates } from '../lib/rates-cache'
import AIExplanationModal from '../components/AIExplanationModal'
import CardDisplay from '../components/CardDisplay'
import AddCardModal from '../components/AddCardModal'
import type { PaymentSource, Transaction } from '../types'
import type { LiveRates } from '../lib/agents/types'

type FundCurrency = 'usd' | 'usdc' | 'ars'

const FUND_OPTIONS: { id: FundCurrency; label: string; symbol: string; placeholder: string }[] = [
  { id: 'usd',  label: 'USD',  symbol: '$', placeholder: 'Ej: 50' },
  { id: 'usdc', label: 'USDC', symbol: '$', placeholder: 'Ej: 50' },
  { id: 'ars',  label: 'ARS',  symbol: '$', placeholder: 'Ej: 10000' },
]

function AddFundsModal({ onClose }: { onClose: () => void }) {
  const { addFunds } = useSession()
  const [selected, setSelected] = useState<FundCurrency>('usd')
  const [rawAmount, setRawAmount] = useState('')
  const [focused, setFocused] = useState(false)

  const numericValue = parseFloat(rawAmount) || 0
  const displayValue = focused
    ? rawAmount
    : numericValue > 0
      ? numericValue.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : ''

  function handleConfirm() {
    if (!numericValue || numericValue <= 0) return
    addFunds(selected, numericValue)
    onClose()
  }

  const option = FUND_OPTIONS.find(o => o.id === selected)!

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#131C2E] border border-[#334155] rounded-t-2xl p-6 space-y-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#F8FAFC]">Add funds</h2>
          <button onClick={onClose} className="text-[#64748B] hover:text-[#94A3B8] text-xl leading-none">✕</button>
        </div>

        {/* Currency selector */}
        <div className="flex gap-2">
          {FUND_OPTIONS.map(opt => (
            <button
              key={opt.id}
              onClick={() => { setSelected(opt.id); setRawAmount('') }}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                selected === opt.id
                  ? 'bg-[#F59E0B] text-[#0F172A]'
                  : 'bg-[#1E293B] text-[#94A3B8] hover:bg-[#272F42]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* Amount input */}
        <div className="relative">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-[#64748B] text-lg font-semibold">
            {option.symbol}
          </span>
          <input
            type="text"
            inputMode="decimal"
            value={displayValue}
            onChange={e => setRawAmount(e.target.value.replace(/[^0-9.]/g, ''))}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={option.placeholder}
            className="w-full bg-[#1E293B] border border-[#334155] rounded-xl pl-9 pr-4 py-3 text-[#F8FAFC] text-base placeholder-[#475569] focus:outline-none focus:border-[#F59E0B]"
          />
        </div>

        <button
          onClick={handleConfirm}
          disabled={numericValue <= 0}
          className="w-full bg-[#F59E0B] text-[#0F172A] py-3 rounded-xl font-semibold disabled:opacity-40 hover:bg-[#FBBF24] active:scale-95 transition-all"
        >
          Confirm
        </button>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { sources, transactions, addCard, updateCard, removeCard, resetAll } = useSession()
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)
  const [showAddFunds, setShowAddFunds] = useState(false)
  const [showAddCard, setShowAddCard] = useState(false)
  const [editingCard, setEditingCard] = useState<PaymentSource | null>(null)
  const [liveRates, setLiveRates] = useState<LiveRates | null>(getCachedRates)

  useEffect(() => {
    if (liveRates) return
    const id = setInterval(() => {
      const rates = getCachedRates()
      if (rates) {
        setLiveRates(rates)
        clearInterval(id)
      }
    }, 2000)
    return () => clearInterval(id)
  }, [liveRates])

  const ownSources = sources.filter(s => s.kind === 'balance')
  const cardSources = sources.filter(s => s.kind === 'credit_card')

  const totalUSD = ownSources.reduce((sum, s) => {
    if (s.currency === 'ARS') return sum + s.available / ARS_RATE
    return sum + s.available
  }, 0)

  return (
    <div className="min-h-screen bg-[#0F172A]">
      {/* Header */}
      <div className="bg-[#0F172A] border-b border-[#334155] px-6 py-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center gap-2 cursor-pointer"
          >
            <div className="w-8 h-8 bg-[#F59E0B] rounded-lg flex items-center justify-center">
              <span className="text-[#0F172A] text-xs font-bold">M</span>
            </div>
            <span
              className="text-lg font-semibold text-[#F8FAFC]"
              style={{ fontFamily: "'Orbitron', sans-serif" }}
            >
              MixPay
            </span>
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (window.confirm('Reset all data? Cards and transactions will be deleted.')) {
                  resetAll()
                }
              }}
              className="w-8 h-8 bg-[#272F42] rounded-full flex items-center justify-center text-[#64748B] hover:text-[#F87171] hover:bg-[#F87171]/10 transition-all"
              title="Reset data"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </button>
            <div className="w-8 h-8 bg-[#272F42] rounded-full flex items-center justify-center text-sm font-medium text-[#F8FAFC]">
              JD
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-6 py-8 space-y-6">
        {/* Total Balance Card */}
        <div className="bg-gradient-to-br from-[#1E2A4A] to-[#0F172A] border border-[#334155] rounded-2xl p-6 text-white">
          <div className="flex items-center justify-between mb-1">
            <p className="text-[#94A3B8] text-sm">Total Balance</p>
            <button
              onClick={() => setShowAddFunds(true)}
              className="w-7 h-7 bg-[#F59E0B] rounded-full flex items-center justify-center text-[#0F172A] font-bold text-lg leading-none hover:bg-[#FBBF24] active:scale-95 transition-all"
              title="Add funds"
            >
              +
            </button>
          </div>
          <p className="text-4xl font-bold text-[#F59E0B]">${totalUSD.toFixed(2)}</p>
          <p className="text-[#64748B] text-sm mt-1">USD equivalent · own funds</p>
        </div>

        {/* Live Rates Strip */}
        <div className="bg-[#1E293B] rounded-xl px-4 py-2.5 flex items-center justify-center gap-3 text-xs text-[#94A3B8]">
          {liveRates ? (
            <>
              <span>
                USD/ARS:{' '}
                <span className="text-[#F59E0B] font-semibold">
                  ${liveRates.arsExchangeRate.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </span>
              <span className="text-[#334155]">|</span>
              <span>
                Best FCI:{' '}
                <span className="text-emerald-400 font-semibold">
                  {Math.max(...liveRates.fciTopFunds.map(f => f.tna)).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% TNA
                </span>
              </span>
              <span className="text-[#334155]">|</span>
              <span>
                Inflation:{' '}
                <span className="text-[#F59E0B] font-semibold">
                  {(liveRates.monthlyInflation * 100).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%/mo
                </span>
              </span>
            </>
          ) : (
            <span className="text-[#64748B] animate-pulse">Loading rates...</span>
          )}
        </div>

        {/* Own Balances */}
        <div>
          <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide mb-3">
            Balances
          </p>
          <div className="grid grid-cols-3 gap-3">
            {ownSources.map(source => {
              const colors = getSourceColors(source.id)
              const displayValue = source.currency === 'ARS'
                ? `$${source.available.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                : `$${source.available.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              return (
                <div
                  key={source.id}
                  className="bg-[#272F42] rounded-xl p-4 border border-[#334155]"
                >
                  <div className="mb-2">
                    <div className={`w-8 h-8 rounded-full ${colors.bg} flex items-center justify-center`}>
                      <span className={`${colors.icon} text-sm font-bold`}>{source.symbol || '$'}</span>
                    </div>
                  </div>
                  <p className="text-xs text-[#94A3B8] mb-0.5">{source.currency}</p>
                  <p className="text-base font-bold text-[#F8FAFC] leading-tight">{displayValue}</p>
                </div>
              )
            })}
          </div>
        </div>

        {/* Credit Cards */}
        <div>
          <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide mb-3">
            Credit Cards
          </p>
          <div className={cardSources.length >= 4
            ? 'flex gap-3 overflow-x-auto pb-2 scrollbar-none'
            : 'grid grid-cols-2 gap-3'
          }>
            {cardSources.map(source => (
              <CardDisplay
                key={source.id}
                source={source}
                onEdit={(id) => {
                  const card = cardSources.find(c => c.id === id)
                  if (card) {
                    setEditingCard(card)
                    setShowAddCard(true)
                  }
                }}
                onDelete={(id) => {
                  if (window.confirm('Delete this card?')) {
                    removeCard(id)
                  }
                }}
              />
            ))}
          </div>
          <button
            onClick={() => { setEditingCard(null); setShowAddCard(true) }}
            className="w-full mt-3 border-2 border-dashed border-[#334155] rounded-2xl py-4 text-[#64748B] text-sm font-medium hover:border-[#F59E0B] hover:text-[#F59E0B] transition-all"
          >
            + Add card
          </button>
        </div>

        {/* Linked Card */}
        <div>
          <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide mb-3">
            MixPay Card
          </p>
          <div className="bg-[#272F42] rounded-xl p-4 border border-[#334155] flex items-center gap-4">
            <div className="w-12 h-8 bg-[#0F172A] rounded flex items-center justify-center flex-shrink-0">
              <span className="text-[#F8FAFC] text-xs font-bold">VISA</span>
            </div>
            <div>
              <p className="font-medium text-[#F8FAFC] text-sm">{mockCard.label}</p>
              <p className="text-xs text-[#64748B]">•••• •••• •••• {mockCard.last4}</p>
            </div>
            <div className="ml-auto">
              <span className="text-xs bg-emerald-500/20 text-emerald-400 px-2 py-1 rounded-full font-medium">
                Active
              </span>
            </div>
          </div>
        </div>

        {/* CTA Button */}
        <button
          onClick={() => navigate('/checkout')}
          className="w-full bg-[#F59E0B] text-[#0F172A] py-4 rounded-xl font-semibold text-base hover:bg-[#FBBF24] active:scale-95 transition-all"
        >
          Simulate Purchase →
        </button>

        {/* Recent Transactions */}
        <div>
          <p className="text-xs font-semibold text-[#94A3B8] uppercase tracking-wide mb-3">
            Recent Transactions
          </p>
          <div className="space-y-3">
            {transactions.map(tx => (
              <div
                key={tx.id}
                className="bg-[#272F42] rounded-xl p-4 border border-[#334155]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#F8FAFC]">{tx.merchant}</p>
                    <p className="text-xs text-[#64748B] mt-0.5">{tx.date}</p>
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {tx.result.sourceUsages.map(usage => {
                        const colors = getSourceColors(usage.sourceId)
                        return (
                          <span
                            key={usage.sourceId}
                            className={`text-xs ${colors.bg} ${colors.text} px-2 py-0.5 rounded-full font-medium`}
                          >
                            {usage.currency === 'ARS'
                              ? `ARS ${usage.amountOriginal.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
                              : `${usage.label} $${usage.amountUSD.toFixed(2)}`}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-[#F8FAFC]">-${tx.amount}</p>
                    <button
                      onClick={() => setSelectedTx(tx)}
                      className="text-xs text-[#8B5CF6] font-medium mt-2 hover:underline"
                    >
                      AI explanation ✦
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {showAddFunds && <AddFundsModal onClose={() => setShowAddFunds(false)} />}

      {selectedTx && (
        <AIExplanationModal
          isOpen={true}
          onClose={() => setSelectedTx(null)}
          merchant={selectedTx.merchant}
          amount={selectedTx.amount}
          result={selectedTx.result}
        />
      )}

      {showAddCard && (
        <AddCardModal
          onClose={() => { setShowAddCard(false); setEditingCard(null) }}
          onSave={(card) => {
            if (editingCard) {
              updateCard(editingCard.id, {
                bank: card.bank,
                network: card.network,
                customName: card.customName,
                currency: card.currency,
                creditLimit: card.creditLimit,
                available: card.creditLimit,
                closingDay: card.closingDay,
                dueDay: card.dueDay,
                feeRate: card.feeRate,
                symbol: card.currency === 'ARS' ? '₱' : '$',
              })
            } else {
              addCard(card)
            }
          }}
          editCard={editingCard}
        />
      )}
    </div>
  )
}
