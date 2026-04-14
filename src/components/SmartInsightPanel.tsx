import type { SmartInsight } from '../lib/agents/types'

interface Props {
  insights: SmartInsight[]
}

const ICONS: Record<SmartInsight['kind'], { svg: string; color: string }> = {
  savings: {
    color: 'text-emerald-400',
    svg: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z',
  },
  opportunity_cost: {
    color: 'text-amber-400',
    svg: 'M13 10V3L4 14h7v7l9-11h-7z',
  },
  idle_balance: {
    color: 'text-blue-400',
    svg: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6',
  },
  invest_suggestion: {
    color: 'text-purple-400',
    svg: 'M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
  },
}

export default function SmartInsightPanel({ insights }: Props) {
  if (insights.length === 0) return null

  return (
    <div className="bg-[#1E293B] rounded-2xl p-5 border border-[#334155]">
      {/* Header */}
      <div className="mb-4">
        <p className="text-xs font-semibold text-[#F59E0B] uppercase tracking-wide">
          Smart Insights
        </p>
      </div>

      {/* Insight rows */}
      <div className="space-y-3">
        {insights.map((insight, i) => {
          const icon = ICONS[insight.kind] ?? ICONS.savings
          const deltaPositive = insight.deltaUSD >= 0
          return (
            <div key={i} className="flex gap-3">
              {/* Icon */}
              <div className="flex-shrink-0 mt-0.5">
                <svg
                  className={`w-5 h-5 ${icon.color}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d={icon.svg} />
                </svg>
              </div>

              {/* Text */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-[#F8FAFC]">{insight.headline}</p>
                  <span
                    className={`text-xs font-semibold flex-shrink-0 ${
                      deltaPositive ? 'text-emerald-400' : 'text-amber-400'
                    }`}
                  >
                    {deltaPositive ? '+' : ''}${Math.abs(insight.deltaUSD).toFixed(2)}
                  </span>
                </div>
                <p className="text-xs text-[#94A3B8] mt-0.5 leading-relaxed">
                  {insight.detail}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Risk recommendation — only show user-friendly text, not internal agent notes */}
    </div>
  )
}
