import { getCycleStatus } from '../lib/billing-cycle'
import type { PaymentSource } from '../types'

const NETWORK_COLORS: Record<string, { text: string; color: string }> = {
  visa:       { text: 'VISA', color: '#60A5FA' },
  mastercard: { text: 'MC',   color: '#F87171' },
  amex:       { text: 'AMEX', color: '#34D399' },
}

const NETWORK_GRADIENTS: Record<string, string> = {
  visa:       'from-[#1E3A5F] to-[#0F172A]',
  mastercard: 'from-[#3B1F1F] to-[#0F172A]',
  amex:       'from-[#1F3B2F] to-[#0F172A]',
}

interface CardDisplayProps {
  source: PaymentSource
  onEdit: (id: string) => void
  onDelete: (id: string) => void
}

export default function CardDisplay({ source, onEdit, onDelete }: CardDisplayProps) {
  const network = source.network ?? 'visa'
  const netInfo = NETWORK_COLORS[network] ?? NETWORK_COLORS.visa
  const gradient = NETWORK_GRADIENTS[network] ?? NETWORK_GRADIENTS.visa

  const today = new Date()
  const cycle = source.closingDay && source.dueDay
    ? getCycleStatus(source.closingDay, source.dueDay, today)
    : null

  const displayValue = source.currency === 'ARS'
    ? `${source.symbol}${source.available.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
    : `${source.symbol}${source.available.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div className={`relative bg-gradient-to-br ${gradient} border border-[#334155] rounded-2xl p-4 min-w-[180px] overflow-visible`}>
      {/* Menu button — positioned clearly in top-right corner */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          const menu = e.currentTarget.nextElementSibling as HTMLElement
          menu.classList.toggle('hidden')
        }}
        className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center text-[#64748B] hover:text-[#94A3B8] rounded-full hover:bg-white/10 z-10 text-lg"
      >
        ⋮
      </button>
      {/* Dropdown menu */}
      <div className="hidden absolute top-10 right-2 bg-[#1E293B] border border-[#334155] rounded-lg shadow-xl z-20 overflow-hidden min-w-[100px]">
        <button
          onClick={() => onEdit(source.id)}
          className="block w-full px-4 py-2 text-left text-sm text-[#F8FAFC] hover:bg-[#272F42]"
        >
          Edit
        </button>
        <button
          onClick={() => onDelete(source.id)}
          className="block w-full px-4 py-2 text-left text-sm text-[#F87171] hover:bg-[#272F42]"
        >
          Delete
        </button>
      </div>

      {/* Header: bank + network */}
      <div className="flex justify-between items-center mb-4 pr-6">
        <span className="text-[#94A3B8] text-[11px] uppercase tracking-wide">{source.bank ?? ''}</span>
        <span style={{ color: netInfo.color }} className="font-bold text-xs">{netInfo.text}</span>
      </div>

      {/* Last 4 */}
      <div className="text-[#F8FAFC] text-sm tracking-[3px] mb-3">
        •••• {source.last4 ?? '0000'}
      </div>

      {/* Available amount */}
      <div className="text-[#F59E0B] font-bold text-lg mb-1">{displayValue}</div>

      {/* Cycle info */}
      {source.closingDay && source.dueDay && (
        <div className="flex gap-2 text-[10px] text-[#64748B]">
          <span>Closes {source.closingDay}</span>
          <span>·</span>
          <span>Due {source.dueDay}</span>
        </div>
      )}

      {/* Cycle indicator */}
      {cycle && cycle.status === 'closing-soon' && (
        <div className="mt-2 text-[10px] text-[#FBBF24]">
          Closes in {cycle.daysToClose} day{cycle.daysToClose !== 1 ? 's' : ''}
        </div>
      )}
      {cycle && cycle.status === 'due-soon' && (
        <div className="mt-2 text-[10px] text-[#F87171]">
          Due in {cycle.daysToDue} day{cycle.daysToDue !== 1 ? 's' : ''}
        </div>
      )}
      {cycle && cycle.status === 'new-period' && (
        <div className="mt-2">
          <span className="text-[10px] bg-[#34D399]/20 text-[#34D399] px-2 py-0.5 rounded-full">
            New period
          </span>
        </div>
      )}
    </div>
  )
}
