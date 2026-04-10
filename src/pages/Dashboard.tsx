// src/pages/Dashboard.tsx
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { mockBalances, mockCard, mockTransactions } from '../lib/mock-data';
import { ARS_RATE } from '../lib/optimizer';
import AIExplanationModal from '../components/AIExplanationModal';
import type { Transaction } from '../types';

export default function Dashboard() {
  const navigate = useNavigate();
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);

  const totalUSD =
    mockBalances.usd + mockBalances.usdc + mockBalances.ars / ARS_RATE;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-100 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-lg mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-black rounded-lg flex items-center justify-center">
              <span className="text-white text-xs font-bold">M</span>
            </div>
            <span className="text-lg font-semibold text-gray-900">MixPay</span>
          </div>
          <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center text-sm font-medium text-gray-600">
            JD
          </div>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-6 py-8 space-y-6">
        <div className="bg-black rounded-2xl p-6 text-white">
          <p className="text-gray-400 text-sm mb-1">Total Balance</p>
          <p className="text-4xl font-bold">${totalUSD.toFixed(2)}</p>
          <p className="text-gray-500 text-sm mt-1">USD equivalent</p>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Balances
          </p>
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <div className="text-2xl mb-2">🇺🇸</div>
              <p className="text-xs text-gray-500 mb-0.5">USD</p>
              <p className="text-lg font-bold text-gray-900">${mockBalances.usd}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <div className="text-2xl mb-2">🔷</div>
              <p className="text-xs text-gray-500 mb-0.5">USDC</p>
              <p className="text-lg font-bold text-gray-900">${mockBalances.usdc}</p>
            </div>
            <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <div className="text-2xl mb-2">🇦🇷</div>
              <p className="text-xs text-gray-500 mb-0.5">ARS</p>
              <p className="text-lg font-bold text-gray-900">
                {mockBalances.ars.toLocaleString()}
              </p>
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Linked Card
          </p>
          <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-8 bg-gray-900 rounded flex items-center justify-center flex-shrink-0">
              <span className="text-white text-xs font-bold">VISA</span>
            </div>
            <div>
              <p className="font-medium text-gray-900 text-sm">{mockCard.label}</p>
              <p className="text-xs text-gray-500">•••• •••• •••• {mockCard.last4}</p>
            </div>
            <div className="ml-auto">
              <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium">
                Active
              </span>
            </div>
          </div>
        </div>

        <button
          onClick={() => navigate('/checkout')}
          className="w-full bg-black text-white py-4 rounded-xl font-semibold text-base hover:bg-gray-800 active:scale-95 transition-all"
        >
          Simulate Purchase →
        </button>

        <div>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
            Recent Transactions
          </p>
          <div className="space-y-3">
            {mockTransactions.map(tx => (
              <div
                key={tx.id}
                className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900">{tx.merchant}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{tx.date}</p>
                    <div className="flex gap-1 mt-2 flex-wrap">
                      {tx.result.usdUsed > 0 && (
                        <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                          USD ${tx.result.usdUsed}
                        </span>
                      )}
                      {tx.result.usdcUsed > 0 && (
                        <span className="text-xs bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-medium">
                          USDC ${tx.result.usdcUsed}
                        </span>
                      )}
                      {tx.result.arsUsed > 0 && (
                        <span className="text-xs bg-sky-50 text-sky-700 px-2 py-0.5 rounded-full font-medium">
                          ARS {tx.result.arsUsed.toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-semibold text-gray-900">-${tx.amount}</p>
                    <button
                      onClick={() => setSelectedTx(tx)}
                      className="text-xs text-indigo-600 font-medium mt-2 hover:underline"
                    >
                      AI explanation ✦
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {selectedTx && (
        <AIExplanationModal
          isOpen={true}
          onClose={() => setSelectedTx(null)}
          merchant={selectedTx.merchant}
          amount={selectedTx.amount}
          result={selectedTx.result}
        />
      )}
    </div>
  );
}
