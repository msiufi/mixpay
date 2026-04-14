import type { PaymentSource } from '../types'

const STORAGE_KEY = 'mixpay_cards'

export function loadCards(): PaymentSource[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as PaymentSource[]
  } catch {
    return null
  }
}

export function saveCards(cards: PaymentSource[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cards))
}

export function clearCards(): void {
  localStorage.removeItem(STORAGE_KEY)
}

const DEFAULT_FEES: Record<string, number> = {
  visa: 0.035,
  mastercard: 0.025,
  amex: 0.03,
}

export function getDefaultFee(network: string): number {
  return DEFAULT_FEES[network] ?? 0.03
}

export function generateCardId(): string {
  return `card-${Date.now()}`
}

export function generateLast4(): string {
  return String(Math.floor(1000 + Math.random() * 9000))
}

export function buildCardLabel(network: string, bank: string, customName?: string): string {
  const net = network.charAt(0).toUpperCase() + network.slice(1)
  const parts = [net, bank]
  if (customName) parts.push(customName)
  return parts.join(' ')
}
