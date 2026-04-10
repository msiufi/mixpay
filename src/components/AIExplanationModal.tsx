// src/components/AIExplanationModal.tsx
import { useEffect, useState } from 'react';
import type { OptimizationResult } from '../types';
import { getAIExplanation } from '../lib/ai-explanation';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  merchant: string;
  amount: number;
  result: OptimizationResult;
}

export default function AIExplanationModal({
  isOpen,
  onClose,
  merchant,
  amount,
  result,
}: Props) {
  const [explanation, setExplanation] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    setExplanation('');
    getAIExplanation(merchant, amount, result).then(text => {
      setExplanation(text);
      setLoading(false);
    });
  }, [isOpen, merchant, amount, result]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-sm p-6 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-indigo-600 rounded-md flex items-center justify-center">
              <span className="text-white text-xs font-bold">✦</span>
            </div>
            <h3 className="font-semibold text-gray-900">AI Explanation</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 min-h-[80px]">
          {loading ? (
            <div className="flex items-center gap-2 text-gray-400">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-indigo-600 rounded-full animate-spin" />
              <span className="text-sm">Generating explanation...</span>
            </div>
          ) : (
            <p className="text-sm text-gray-700 leading-relaxed">{explanation}</p>
          )}
        </div>
        <p className="text-xs text-gray-400 text-center">
          Powered by MixPay AI · Replace body of{' '}
          <code className="bg-gray-100 px-1 rounded">getAIExplanation()</code> with
          Claude API
        </p>
      </div>
    </div>
  );
}
