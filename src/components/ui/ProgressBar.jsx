import React from 'react';
import { cn } from '@/lib/utils';

export default function ProgressBar({ value, max, className, barClass }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div className={cn("w-full h-2 bg-secondary rounded-full overflow-hidden", className)}>
      <div
        className={cn("h-full rounded-full transition-all duration-500", barClass || "bg-primary")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}