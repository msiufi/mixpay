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
      className="fixed inset-0 bg-black/70 flex items-end sm:items-center justify-center p-4 z-50"
      onClick={onClose}
    >
      <div
        className="bg-[#1E293B] border border-[#334155] rounded-2xl w-full max-w-sm p-6 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 bg-[#8B5CF6] rounded-md flex items-center justify-center">
              <svg className="w-3.5 h-3.5 text-white" viewBox="0 0 20 20" fill="currentColor">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </div>
            <h3 className="font-semibold text-[#F8FAFC]">AI Explanation</h3>
          </div>
          <button
            onClick={onClose}
            className="text-[#64748B] hover:text-[#94A3B8] text-xl leading-none transition-colors cursor-pointer"
          >
            ×
          </button>
        </div>

        {/* Content Area */}
        <div className="bg-[#272F42] rounded-xl p-4 min-h-[80px]">
          {loading ? (
            <div className="flex items-center gap-2 text-[#64748B]">
              <div className="w-4 h-4 border-2 border-[#334155] border-t-[#8B5CF6] rounded-full animate-spin" />
              <span className="text-sm">Generating explanation...</span>
            </div>
          ) : (
            <p className="text-sm text-[#94A3B8] leading-relaxed">{explanation}</p>
          )}
        </div>

        {/* Footer */}
        <p className="text-xs text-[#64748B] text-center">
          Powered by MixPay AI ✦ Claude
        </p>
      </div>
    </div>
  );
}
