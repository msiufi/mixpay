import { createContext, useContext, useEffect, useState } from 'react'
import type { OptimizationResult, PaymentSource, Transaction } from '../types'
import { defaultBalances, defaultCards, mockTransactions } from '../lib/mock-data'
import { loadCards, saveCards, clearCards, generateCardId, generateLast4, buildCardLabel, getDefaultFee } from '../lib/card-storage'

interface SessionContextValue {
  sources: PaymentSource[]
  transactions: Transaction[]
  applyPayment: (result: OptimizationResult, merchant: string, amount: number) => void
  addFunds: (sourceId: string, amount: number) => void
  addCard: (card: {
    bank: string
    network: string
    customName?: string
    currency: string
    creditLimit: number
    closingDay: number
    dueDay: number
    feeRate?: number
  }) => void
  updateCard: (id: string, updates: Partial<PaymentSource>) => void
  removeCard: (id: string) => void
  resetAll: () => void
}

const SessionContext = createContext<SessionContextValue | null>(null)

function getInitialSources(): PaymentSource[] {
  const storedCards = loadCards()
  const cards = storedCards ?? defaultCards
  return [...defaultBalances, ...cards]
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [sources, setSources] = useState<PaymentSource[]>(getInitialSources)
  const [transactions, setTransactions] = useState<Transaction[]>(mockTransactions)

  function persistCards(nextSources: PaymentSource[]) {
    const cards = nextSources.filter(s => s.kind === 'credit_card')
    saveCards(cards)
  }

  function applyPayment(result: OptimizationResult, merchant: string, amount: number) {
    setSources(prev => {
      const next = prev.map(s => {
        const usage = result.sourceUsages.find(u => u.sourceId === s.id)
        if (!usage) return s
        return { ...s, available: parseFloat((s.available - usage.amountOriginal).toFixed(10)) }
      })
      persistCards(next)
      return next
    })

    const tx: Transaction = {
      id: `tx-${Date.now()}`,
      merchant,
      amount,
      date: new Date().toISOString().slice(0, 10),
      result,
    }
    setTransactions(prev => [tx, ...prev])
  }

  function addFunds(sourceId: string, amount: number) {
    setSources(prev =>
      prev.map(s =>
        s.id === sourceId ? { ...s, available: parseFloat((s.available + amount).toFixed(10)) } : s
      )
    )
  }

  function addCard(card: {
    bank: string
    network: string
    customName?: string
    currency: string
    creditLimit: number
    closingDay: number
    dueDay: number
    feeRate?: number
  }) {
    setSources(prev => {
      const id = generateCardId()
      const last4 = generateLast4()
      const label = buildCardLabel(card.network, card.bank, card.customName)
      const symbol = card.currency === 'ARS' ? '₱' : '$'
      const feeRate = card.feeRate ?? getDefaultFee(card.network)
      const maxPriority = prev.reduce((max, s) => Math.max(max, s.priority), 0)
      const newCard: PaymentSource = {
        id,
        label,
        symbol,
        kind: 'credit_card',
        currency: card.currency,
        available: card.creditLimit,
        feeRate,
        priority: maxPriority + 1,
        bank: card.bank,
        network: card.network,
        customName: card.customName,
        creditLimit: card.creditLimit,
        closingDay: card.closingDay,
        dueDay: card.dueDay,
        last4,
      }
      const next = [...prev, newCard]
      persistCards(next)
      return next
    })
  }

  function updateCard(id: string, updates: Partial<PaymentSource>) {
    setSources(prev => {
      const next = prev.map(s => {
        if (s.id !== id) return s
        const updated = { ...s, ...updates }
        const labelChanged = updates.network !== undefined || updates.bank !== undefined || updates.customName !== undefined
        if (labelChanged) {
          updated.label = buildCardLabel(
            updated.network ?? s.network ?? '',
            updated.bank ?? s.bank ?? '',
            updated.customName
          )
        }
        return updated
      })
      persistCards(next)
      return next
    })
  }

  function removeCard(id: string) {
    setSources(prev => {
      const next = prev.filter(s => s.id !== id)
      persistCards(next)
      return next
    })
  }

  function resetAll() {
    clearCards()
    setSources([...defaultBalances, ...defaultCards])
    setTransactions(mockTransactions)
  }

  return (
    <SessionContext.Provider value={{
      sources, transactions, applyPayment, addFunds,
      addCard, updateCard, removeCard, resetAll,
    }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used within SessionProvider')
  return ctx
}
