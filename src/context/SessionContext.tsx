import { createContext, useContext, useState } from 'react'
import type { OptimizationResult, PaymentSource, Transaction } from '../types'
import { defaultSources, mockTransactions } from '../lib/mock-data'

interface SessionContextValue {
  sources: PaymentSource[]
  transactions: Transaction[]
  applyPayment: (result: OptimizationResult, merchant: string, amount: number) => void
  addFunds: (sourceId: string, amount: number) => void
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [sources, setSources] = useState<PaymentSource[]>(defaultSources)
  const [transactions, setTransactions] = useState<Transaction[]>(mockTransactions)

  function applyPayment(result: OptimizationResult, merchant: string, amount: number) {
    setSources(prev =>
      prev.map(s => {
        const usage = result.sourceUsages.find(u => u.sourceId === s.id)
        if (!usage) return s
        return { ...s, available: parseFloat((s.available - usage.amountOriginal).toFixed(10)) }
      }),
    )

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

  return (
    <SessionContext.Provider value={{ sources, transactions, applyPayment, addFunds }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession() {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used within SessionProvider')
  return ctx
}
