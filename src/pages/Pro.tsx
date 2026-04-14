import { useNavigate } from 'react-router'
import { COMMISSION_RATE } from '../lib/config'

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    period: '/mo',
    commission: `${(COMMISSION_RATE * 100).toFixed(0)}%`,
    features: ['AI-optimized payments', 'Up to 5 sources', 'Basic insights'],
    current: true,
  },
  {
    name: 'Pro',
    price: '$4.99',
    period: '/mo',
    commission: '0%',
    features: [
      '0% MixPay commission',
      'Unlimited sources',
      'Advanced smart insights',
      'Priority AI optimization',
      'Export transaction history',
    ],
    current: false,
    highlight: true,
  },
  {
    name: 'Business',
    price: '$19.99',
    period: '/mo',
    commission: '0%',
    features: [
      'Everything in Pro',
      'Team accounts',
      'API access',
      'Custom yield strategies',
      'Dedicated support',
    ],
    current: false,
  },
]

export default function Pro() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-[#0F172A] p-6">
      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="text-center pt-4">
          <button
            onClick={() => navigate(-1)}
            className="text-[#64748B] text-sm hover:text-[#94A3B8] mb-4 inline-block"
          >
            ← Back
          </button>
          <h1
            className="text-2xl font-bold text-[#F8FAFC]"
            style={{ fontFamily: "'Orbitron', sans-serif" }}
          >
            MixPay Pro
          </h1>
          <p className="text-[#64748B] mt-2 text-sm">
            {`Remove the ${(COMMISSION_RATE * 100).toFixed(0)}% commission and unlock advanced features`}
          </p>
        </div>

        {/* Savings callout */}
        <div className="bg-[#F59E0B]/10 border border-[#F59E0B]/20 rounded-xl p-4 text-center">
          <p className="text-sm text-[#F59E0B] font-medium">
            Pro users save an average of <span className="font-bold">$12.40/mo</span> in commissions
          </p>
        </div>

        {/* Plans */}
        <div className="space-y-3">
          {PLANS.map(plan => (
            <div
              key={plan.name}
              className={`rounded-2xl p-5 border ${
                plan.highlight
                  ? 'bg-[#F59E0B]/5 border-[#F59E0B]/30'
                  : 'bg-[#272F42] border-[#334155]'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-lg font-bold text-[#F8FAFC]">{plan.name}</h2>
                    {plan.highlight && (
                      <span className="text-xs bg-[#F59E0B] text-[#0F172A] px-2 py-0.5 rounded-full font-bold">
                        POPULAR
                      </span>
                    )}
                    {plan.current && (
                      <span className="text-xs bg-[#334155] text-[#94A3B8] px-2 py-0.5 rounded-full font-medium">
                        Current
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#64748B] mt-0.5">
                    Commission: <span className={plan.commission === '0%' ? 'text-emerald-400 font-semibold' : 'text-[#94A3B8]'}>{plan.commission}</span>
                  </p>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-bold text-[#F8FAFC]">{plan.price}</span>
                  <span className="text-sm text-[#64748B]">{plan.period}</span>
                </div>
              </div>

              <ul className="space-y-1.5 mb-4">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-center gap-2 text-sm text-[#94A3B8]">
                    <svg className={`w-4 h-4 flex-shrink-0 ${plan.highlight ? 'text-[#F59E0B]' : 'text-emerald-400'}`} viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l3 3 7-7" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>

              {!plan.current && (
                <button
                  className={`w-full py-3 rounded-xl font-semibold text-sm transition-all active:scale-95 ${
                    plan.highlight
                      ? 'bg-[#F59E0B] text-[#0F172A] hover:bg-[#FBBF24]'
                      : 'bg-[#1E293B] text-[#F8FAFC] hover:bg-[#334155]'
                  }`}
                >
                  Upgrade to {plan.name}
                </button>
              )}
            </div>
          ))}
        </div>

        <p className="text-xs text-[#64748B] text-center">
          Plans are billed monthly. Cancel anytime.
        </p>
      </div>
    </div>
  )
}
