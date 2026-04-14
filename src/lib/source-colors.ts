interface SourceColors {
  bar: string
  text: string
  bg: string
  dot: string
  icon: string
}

const COLORS: Record<string, SourceColors> = {
  usd:        { bar: 'bg-blue-500',   text: 'text-blue-300',   bg: 'bg-blue-500/10',   dot: 'bg-blue-400',   icon: 'text-blue-400' },
  usdc:       { bar: 'bg-purple-500', text: 'text-purple-300', bg: 'bg-purple-500/10', dot: 'bg-purple-400', icon: 'text-purple-400' },
  ars:        { bar: 'bg-sky-400',    text: 'text-sky-300',    bg: 'bg-sky-500/10',    dot: 'bg-sky-400',    icon: 'text-sky-400' },
  visa:       { bar: 'bg-rose-500',   text: 'text-rose-300',   bg: 'bg-rose-500/10',   dot: 'bg-rose-400',   icon: 'text-rose-400' },
  mastercard: { bar: 'bg-orange-500', text: 'text-orange-300', bg: 'bg-orange-500/10', dot: 'bg-orange-400', icon: 'text-orange-400' },
  amex:       { bar: 'bg-emerald-500', text: 'text-emerald-300', bg: 'bg-emerald-500/10', dot: 'bg-emerald-400', icon: 'text-emerald-400' },
}

const FALLBACK = COLORS.visa

export function getSourceColors(sourceId: string, network?: string): SourceColors {
  if (COLORS[sourceId]) return COLORS[sourceId]
  if (network && COLORS[network]) return COLORS[network]
  return FALLBACK
}
