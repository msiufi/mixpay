import { useState, useEffect } from 'react'
import { getDefaultFee } from '../lib/card-storage'
import type { PaymentSource } from '../types'

const BANKS = ['Galicia', 'Macro', 'BBVA', 'Santander', 'HSBC', 'Brubank', 'Ualá', 'Mercado Pago', 'Naranja X']
const NETWORKS = ['visa', 'mastercard', 'amex'] as const

interface AddCardModalProps {
  onClose: () => void
  onSave: (card: {
    bank: string
    network: string
    customName?: string
    currency: string
    creditLimit: number
    closingDay: number
    dueDay: number
    feeRate?: number
  }) => void
  editCard?: PaymentSource | null
}

export default function AddCardModal({ onClose, onSave, editCard }: AddCardModalProps) {
  const [bank, setBank] = useState(editCard?.bank ?? '')
  const [customBank, setCustomBank] = useState('')
  const [network, setNetwork] = useState(editCard?.network ?? 'visa')
  const [customName, setCustomName] = useState(editCard?.customName ?? '')
  const [limitStr, setLimitStr] = useState(editCard?.creditLimit?.toString() ?? '')
  const [currency, setCurrency] = useState(editCard?.currency ?? 'ARS')
  const [closingDayStr, setClosingDayStr] = useState(editCard?.closingDay?.toString() ?? '')
  const [dueDayStr, setDueDayStr] = useState(editCard?.dueDay?.toString() ?? '')
  const [feeStr, setFeeStr] = useState(editCard?.feeRate ? (editCard.feeRate * 100).toString() : '')

  const [showCustomBank, setShowCustomBank] = useState(false)

  useEffect(() => {
    if (editCard?.bank && !BANKS.includes(editCard.bank)) {
      setShowCustomBank(true)
      setCustomBank(editCard.bank)
      setBank('__custom__')
    }
  }, [editCard])

  const effectiveBank = bank === '__custom__' ? customBank : bank
  const limit = parseFloat(limitStr) || 0
  const closingDay = parseInt(closingDayStr) || 0
  const dueDay = parseInt(dueDayStr) || 0

  const isValid =
    effectiveBank.length > 0 &&
    network.length > 0 &&
    limit > 0 &&
    closingDay >= 1 && closingDay <= 28 &&
    dueDay >= 1 && dueDay <= 28

  function handleSave() {
    if (!isValid) return
    const fee = feeStr ? parseFloat(feeStr) / 100 : undefined
    onSave({
      bank: effectiveBank,
      network,
      customName: customName || undefined,
      currency,
      creditLimit: limit,
      closingDay,
      dueDay,
      feeRate: fee,
    })
    onClose()
  }

  const networkLabels: Record<string, string> = { visa: 'Visa', mastercard: 'Mastercard', amex: 'Amex' }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={onClose}>
      <div
        className="w-full max-w-lg bg-[#131C2E] border border-[#334155] rounded-t-2xl p-6 space-y-4 max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-[#F8FAFC]">
            {editCard ? 'Edit card' : 'New card'}
          </h2>
          <button onClick={onClose} className="text-[#64748B] hover:text-[#94A3B8] text-xl leading-none">✕</button>
        </div>

        {/* Bank */}
        <div>
          <label className="text-[#94A3B8] text-xs block mb-1">Bank</label>
          {!showCustomBank ? (
            <select
              value={bank}
              onChange={e => {
                if (e.target.value === '__custom__') {
                  setShowCustomBank(true)
                  setBank('__custom__')
                } else {
                  setBank(e.target.value)
                }
              }}
              className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-4 py-3 text-[#F8FAFC] text-sm focus:outline-none focus:border-[#F59E0B] appearance-none"
            >
              <option value="">Select bank...</option>
              {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
              <option value="__custom__">Other...</option>
            </select>
          ) : (
            <input
              value={customBank}
              onChange={e => setCustomBank(e.target.value)}
              placeholder="Bank name"
              className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-4 py-3 text-[#F8FAFC] text-sm placeholder-[#475569] focus:outline-none focus:border-[#F59E0B]"
            />
          )}
        </div>

        {/* Network */}
        <div>
          <label className="text-[#94A3B8] text-xs block mb-1">Network</label>
          <div className="flex gap-2">
            {NETWORKS.map(net => (
              <button
                key={net}
                onClick={() => setNetwork(net)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${
                  network === net
                    ? 'bg-[#F59E0B] text-[#0F172A]'
                    : 'bg-[#1E293B] text-[#94A3B8] hover:bg-[#272F42]'
                }`}
              >
                {networkLabels[net]}
              </button>
            ))}
          </div>
        </div>

        {/* Name */}
        <div>
          <label className="text-[#94A3B8] text-xs block mb-1">Name <span className="text-[#64748B]">(optional)</span></label>
          <input
            value={customName}
            onChange={e => setCustomName(e.target.value)}
            placeholder="Ej: Gold, Black, Platinum..."
            className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-4 py-3 text-[#F8FAFC] text-sm placeholder-[#475569] focus:outline-none focus:border-[#F59E0B]"
          />
        </div>

        {/* Limit + Currency */}
        <div className="flex gap-3">
          <div className="flex-[2]">
            <label className="text-[#94A3B8] text-xs block mb-1">Limit</label>
            <input
              type="number"
              min="0"
              step="any"
              value={limitStr}
              onChange={e => setLimitStr(e.target.value)}
              placeholder="500000"
              className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-4 py-3 text-[#F8FAFC] text-sm placeholder-[#475569] focus:outline-none focus:border-[#F59E0B]"
            />
          </div>
          <div className="flex-1">
            <label className="text-[#94A3B8] text-xs block mb-1">Currency</label>
            <select
              value={currency}
              onChange={e => setCurrency(e.target.value)}
              className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-4 py-3 text-[#F8FAFC] text-sm focus:outline-none focus:border-[#F59E0B] appearance-none"
            >
              <option value="ARS">ARS</option>
              <option value="USD">USD</option>
            </select>
          </div>
        </div>

        {/* Closing + Due */}
        <div className="flex gap-3">
          <div className="flex-1">
            <label className="text-[#94A3B8] text-xs block mb-1">Closing day</label>
            <input
              type="number"
              min="1"
              max="28"
              value={closingDayStr}
              onChange={e => setClosingDayStr(e.target.value)}
              placeholder="15"
              className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-4 py-3 text-[#F8FAFC] text-sm placeholder-[#475569] focus:outline-none focus:border-[#F59E0B] text-center"
            />
          </div>
          <div className="flex-1">
            <label className="text-[#94A3B8] text-xs block mb-1">Due day</label>
            <input
              type="number"
              min="1"
              max="28"
              value={dueDayStr}
              onChange={e => setDueDayStr(e.target.value)}
              placeholder="5"
              className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-4 py-3 text-[#F8FAFC] text-sm placeholder-[#475569] focus:outline-none focus:border-[#F59E0B] text-center"
            />
          </div>
        </div>

        {/* Fee */}
        <div>
          <label className="text-[#94A3B8] text-xs block mb-1">
            Fee % <span className="text-[#64748B]">(opcional, default {(getDefaultFee(network) * 100).toFixed(1)}%)</span>
          </label>
          <input
            type="number"
            min="0"
            max="100"
            step="0.1"
            value={feeStr}
            onChange={e => setFeeStr(e.target.value)}
            placeholder={(getDefaultFee(network) * 100).toFixed(1)}
            className="w-full bg-[#1E293B] border border-[#334155] rounded-xl px-4 py-3 text-[#F8FAFC] text-sm placeholder-[#475569] focus:outline-none focus:border-[#F59E0B]"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={!isValid}
          className="w-full bg-[#F59E0B] text-[#0F172A] py-3 rounded-xl font-semibold disabled:opacity-40 hover:bg-[#FBBF24] active:scale-95 transition-all"
        >
          {editCard ? 'Save changes' : 'Add card'}
        </button>
      </div>
    </div>
  )
}
