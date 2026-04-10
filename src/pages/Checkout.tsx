// src/pages/Checkout.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router';
import type { PaymentStrategy } from '../types';
import { mockBalances, mockCard } from '../lib/mock-data';

const MERCHANT = 'Nike Store';
const AMOUNT = 20;

export default function Checkout() {
  const navigate = useNavigate();
  const [strategy, setStrategy] = useState<PaymentStrategy>('minimize-fees');

  function handlePay() {
    navigate('/optimizing', {
      state: { merchant: MERCHANT, amount: AMOUNT, strategy, balances: mockBalances },
    });
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
      <div className="w-full max-w-sm space-y-4">
        <button
          onClick={() => navigate('/')}
          className="text-sm text-gray-400 hover:text-gray-600 flex items-center gap-1"
        >
          ← Back
        </button>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm text-center">
          <div className="w-16 h-16 bg-black rounded-2xl mx-auto mb-4 flex items-center justify-center">
            <svg viewBox="0 0 24 14" className="w-10 fill-white">
              <path d="M1 13 C8 13 20 0 23 0 C25 0 24 3 20 5 C14 8 3 13 1 13Z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-gray-900">{MERCHANT}</h2>
          <p className="text-gray-400 text-sm mt-1">nike.com</p>
        </div>

        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <p className="text-sm text-gray-400 mb-1">Amount due</p>
          <p className="text-5xl font-bold text-gray-900 tracking-tight">${AMOUNT}.00</p>
          <p className="text-sm text-gray-400 mt-1">United States Dollar</p>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm flex items-center gap-3">
          <div className="w-12 h-8 bg-gray-900 rounded flex items-center justify-center flex-shrink-0">
            <span className="text-white text-xs font-bold">VISA</span>
          </div>
          <div>
            <p className="font-medium text-gray-900 text-sm">{mockCard.label}</p>
            <p className="text-xs text-gray-400">•••• •••• •••• {mockCard.last4}</p>
          </div>
          <span className="ml-auto text-xs bg-indigo-100 text-indigo-700 px-2 py-1 rounded-full font-medium">
            Smart Pay
          </span>
        </div>

        <div className="bg-white rounded-2xl p-4 border border-gray-100 shadow-sm">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
            Optimization Strategy
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setStrategy('minimize-fees')}
              className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all ${
                strategy === 'minimize-fees'
                  ? 'bg-black text-white shadow-sm'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              Minimize Fees
            </button>
            <button
              onClick={() => setStrategy('preserve-usd')}
              className={`flex-1 py-2.5 px-3 rounded-lg text-sm font-semibold transition-all ${
                strategy === 'preserve-usd'
                  ? 'bg-black text-white shadow-sm'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
              }`}
            >
              Preserve USD
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            {strategy === 'minimize-fees'
              ? 'Uses USD → USDC → ARS. Lowest possible fees.'
              : 'Uses USDC → ARS → USD. Keeps your USD intact.'}
          </p>
        </div>

        <button
          onClick={handlePay}
          className="w-full bg-black text-white py-4 rounded-xl font-bold text-lg hover:bg-gray-800 active:scale-95 transition-all shadow-lg shadow-black/10"
        >
          Pay with MixPay
        </button>

        <p className="text-center text-xs text-gray-400">
          Secured by MixPay · No credit card charged
        </p>
      </div>
    </div>
  );
}
