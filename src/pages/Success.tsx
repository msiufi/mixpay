// src/pages/Success.tsx
import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router';
import type { OptimizationResult, PaymentStrategy } from '../types';

interface LocationState {
  merchant: string;
  amount: number;
  strategy: PaymentStrategy;
  result: OptimizationResult;
}

export default function Success() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = location.state as LocationState | null;

  useEffect(() => {
    if (!state) navigate('/');
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!state) return null;

  const { merchant, amount, result } = state;

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4">
        <div className="text-center py-4">
          <div className="w-20 h-20 bg-green-50 rounded-full mx-auto flex items-center justify-center mb-5">
            <svg className="w-10 h-10" viewBox="0 0 40 40" fill="none">
              <circle cx="20" cy="20" r="18" stroke="#16a34a" strokeWidth="1.5" />
              <path
                d="M12 21 L18 27 L28 15"
                stroke="#16a34a"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="animate-check"
              />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Payment Approved</h1>
          <p className="text-gray-400 mt-1 text-sm">
            {merchant} · ${amount.toFixed(2)} USD
          </p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">
            Payment Breakdown
          </p>
          <div className="space-y-3">
            {result.usdUsed > 0 && (
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-base">🇺🇸</span>
                  <span className="text-sm font-medium text-gray-700">USD</span>
                </div>
                <span className="font-semibold text-gray-900">
                  ${result.usdUsed.toFixed(2)}
                </span>
              </div>
            )}
            {result.usdcUsed > 0 && (
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-base">🔷</span>
                  <span className="text-sm font-medium text-gray-700">USDC</span>
                </div>
                <span className="font-semibold text-gray-900">
                  ${result.usdcUsed.toFixed(2)}
                </span>
              </div>
            )}
            {result.arsUsed > 0 && (
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <span className="text-base">🇦🇷</span>
                  <span className="text-sm font-medium text-gray-700">ARS</span>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-gray-900">
                    ≈${result.arsUsedUSD.toFixed(2)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {result.arsUsed.toLocaleString()} ARS @ {result.arsRate}
                  </p>
                </div>
              </div>
            )}
            <div className="flex justify-between items-center border-t border-gray-100 pt-3">
              <span className="text-sm text-gray-400">Conversion fees</span>
              <span className="text-sm text-gray-600">${result.fees.toFixed(4)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-bold text-gray-900">Total charged</span>
              <span className="font-bold text-gray-900 text-lg">${amount.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-green-50 rounded-xl p-4 border border-green-100">
            <div className="text-xl mb-2">✅</div>
            <p className="text-sm font-semibold text-green-800 leading-snug">
              No credit card used
            </p>
          </div>
          <div className="bg-indigo-50 rounded-xl p-4 border border-indigo-100">
            <div className="text-xl mb-2">⚡</div>
            <p className="text-sm font-semibold text-indigo-800 leading-snug">
              Optimized for low fees
            </p>
          </div>
        </div>

        <button
          onClick={() => navigate('/')}
          className="w-full bg-black text-white py-4 rounded-xl font-semibold hover:bg-gray-800 active:scale-95 transition-all"
        >
          Back to Dashboard
        </button>
      </div>
    </div>
  );
}
