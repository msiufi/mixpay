// src/components/BalanceBar.tsx
import { useEffect, useState } from 'react';

interface BalanceBarProps {
  label: string;
  symbol: string;
  total: number;
  used: number;
  color: string;
  delay?: number;
}

export default function BalanceBar({
  label,
  symbol,
  total,
  used,
  color,
  delay = 0,
}: BalanceBarProps) {
  const [width, setWidth] = useState(0);
  const percentage = total > 0 ? Math.min((used / total) * 100, 100) : 0;

  useEffect(() => {
    if (used === 0) {
      setWidth(0);
      return;
    }
    const timer = setTimeout(() => setWidth(percentage), delay);
    return () => clearTimeout(timer);
  }, [used, percentage, delay]);

  return (
    <div className="space-y-1.5">
      <div className="flex justify-between text-sm">
        <span className="text-[#94A3B8] font-medium">{label}</span>
        <span className="text-[#64748B]">
          {symbol}
          {used.toLocaleString('en-US', { maximumFractionDigits: 2 })}{' '}
          <span className="text-[#334155]">
            / {symbol}
            {total.toLocaleString('en-US', { maximumFractionDigits: 2 })}
          </span>
        </span>
      </div>
      <div className="h-1.5 bg-[#1E293B] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${color}`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}
