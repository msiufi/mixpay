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
    ? `${source.symbol}${source.available.toLocaleString()}`
    : `${source.symbol}${source.available.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div className={`relative bg-gradient-to-br ${gradient} border border-[#334155] rounded-2xl p-4 min-w-[180px]`}>
      {/* Menu button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          const menu = e.currentTarget.nextElementSibling as HTMLElement
          menu.classList.toggle('hidden')
        }}
        className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center text-[#64748B] hover:text-[#94A3B8] rounded-full hover:bg-white/5"
      >
        ···
      </button>
      {/* Dropdown menu */}
      <div className="hidden absolute top-8 right-2 bg-[#1E293B] border border-[#334155] rounded-lg shadow-lg z-10 overflow-hidden">
        <button
          onClick={() => onEdit(source.id)}
          className="block w-full px-4 py-2 text-left text-sm text-[#F8FAFC] hover:bg-[#272F42]"
        >
          Editar
        </button>
        <button
          onClick={() => onDelete(source.id)}
          className="block w-full px-4 py-2 text-left text-sm text-[#F87171] hover:bg-[#272F42]"
        >
          Eliminar
        </button>
      </div>

      {/* Header: bank + network */}
      <div className="flex justify-between items-center mb-4">
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
          <span>Cierra {source.closingDay}</span>
          <span>·</span>
          <span>Vence {source.dueDay}</span>
        </div>
      )}

      {/* Cycle indicator */}
      {cycle && cycle.status === 'closing-soon' && (
        <div className="mt-2 text-[10px] text-[#FBBF24]">
          ⚠ Cierra en {cycle.daysToClose} día{cycle.daysToClose !== 1 ? 's' : ''}
        </div>
      )}
      {cycle && cycle.status === 'due-soon' && (
        <div className="mt-2 text-[10px] text-[#F87171]">
          ⚠ Vence en {cycle.daysToDue} día{cycle.daysToDue !== 1 ? 's' : ''}
        </div>
      )}
      {cycle && cycle.status === 'new-period' && (
        <div className="mt-2">
          <span className="text-[10px] bg-[#34D399]/20 text-[#34D399] px-2 py-0.5 rounded-full">
            Período nuevo
          </span>
        </div>
      )}
    </div>
  )
}
