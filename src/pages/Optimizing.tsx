// src/pages/Optimizing.tsx
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { Balances, OptimizationResult, PaymentStrategy } from '../types';
import { optimizePayment } from '../lib/optimizer';
import BalanceBar from '../components/BalanceBar';

interface LocationState {
  merchant: string;
  amount: number;
  strategy: PaymentStrategy;
  balances: Balances;
}

export default function Optimizing() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState | null;

  const [step, setStep] = useState(0);
  const [result, setResult] = useState<OptimizationResult | null>(null);

  useEffect(() => {
    if (!state) {
      navigate('/');
      return;
    }

    const timers = [
      setTimeout(() => setStep(1), 700),
      setTimeout(() => setStep(2), 1400),
      setTimeout(() => {
        const r = optimizePayment(state.amount, state.balances, state.strategy);
        setResult(r);
        setStep(3);
      }, 2400),
      setTimeout(() => setStep(4), 3100),
      setTimeout(() => setStep(5), 3700),
    ];

    return () => timers.forEach(clearTimeout);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!state) return null;

  const { merchant, amount, balances } = state;

  function handleConfirm() {
    if (!result) return;
    navigate('/success', { state: { merchant, amount, strategy: state!.strategy, result } });
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="text-center mb-6 h-8 flex items-center justify-center">
          {step === 0 ? (
            <div className="flex items-center gap-2 text-gray-400">
              <div className="w-4 h-4 border-2 border-gray-700 border-t-gray-400 rounded-full animate-spin" />
              <span className="text-sm">Analyzing your balances...</span>
            </div>
          ) : (
            <span className="text-white font-semibold text-sm tracking-wide uppercase">
              Payment Optimization
            </span>
          )}
        </div>

        <div className="bg-white rounded-2xl overflow-hidden shadow-2xl">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <p className="text-xs text-gray-400">Paying to</p>
              <p className="font-bold text-gray-900">{merchant}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">Amount</p>
              <p className="text-2xl font-bold text-gray-900">${amount.toFixed(2)}</p>
            </div>
          </div>

          <div className="px-6 py-5 space-y-5">
            <div
              className={`transition-all duration-500 ${
                step >= 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
              }`}
            >
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                Available Balances
              </p>
              <div className="space-y-3">
                <BalanceBar
                  label="USD"
                  symbol="$"
                  total={balances.usd}
                  used={step >= 2 ? balances.usd : 0}
                  color="bg-blue-500"
                  delay={0}
                />
                <BalanceBar
                  label="USDC"
                  symbol="$"
                  total={balances.usdc}
                  used={step >= 2 ? balances.usdc : 0}
                  color="bg-purple-500"
                  delay={150}
                />
                <BalanceBar
                  label="ARS"
                  symbol=""
                  total={balances.ars}
                  used={step >= 2 ? balances.ars : 0}
                  color="bg-sky-400"
                  delay={300}
                />
              </div>
            </div>

            {result ? (
              <div
                className={`transition-all duration-500 ${
                  step >= 3 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
                }`}
              >
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  Selected Combination
                </p>
                <div className="space-y-2">
                  {result.usdUsed > 0 && (
                    <div className="flex justify-between items-center bg-blue-50 rounded-lg px-3 py-2.5">
                      <span className="text-sm font-semibold text-blue-800">🇺🇸 USD</span>
                      <span className="text-sm font-bold text-blue-900">
                        ${result.usdUsed.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {result.usdcUsed > 0 && (
                    <div className="flex justify-between items-center bg-purple-50 rounded-lg px-3 py-2.5">
                      <span className="text-sm font-semibold text-purple-800">🔷 USDC</span>
                      <span className="text-sm font-bold text-purple-900">
                        ${result.usdcUsed.toFixed(2)}
                      </span>
                    </div>
                  )}
                  {result.arsUsed > 0 && (
                    <div className="flex justify-between items-center bg-sky-50 rounded-lg px-3 py-2.5">
                      <span className="text-sm font-semibold text-sky-800">🇦🇷 ARS</span>
                      <div className="text-right">
                        <p className="text-sm font-bold text-sky-900">
                          ≈${result.arsUsedUSD.toFixed(2)}
                        </p>
                        <p className="text-xs text-sky-600">
                          {result.arsUsed.toLocaleString()} ARS
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : null}

            {result ? (
              <div
                className={`transition-all duration-500 ${
                  step >= 4 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'
                }`}
              >
                <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Estimated fees</span>
                    <span className="font-medium text-gray-900">
                      ${result.fees.toFixed(4)} USD
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">ARS exchange rate</span>
                    <span className="font-medium text-gray-900">
                      1 USD = {result.arsRate} ARS
                    </span>
                  </div>
                  <div className="flex justify-between text-sm border-t border-gray-200 pt-2">
                    <span className="font-semibold text-gray-900">Total</span>
                    <span className="font-bold text-gray-900">${amount.toFixed(2)} USD</span>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div
            className={`px-6 pb-6 transition-all duration-500 ${
              step >= 5 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none'
            }`}
          >
            <button
              onClick={handleConfirm}
              className="w-full bg-black text-white py-4 rounded-xl font-bold text-base hover:bg-gray-800 active:scale-95 transition-all"
            >
              Confirm Payment →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
