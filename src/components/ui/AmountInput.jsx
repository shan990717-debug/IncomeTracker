import React from 'react';
import { cn } from '@/lib/utils';

export default function AmountInput({ value, onChange, placeholder = "0.00", className }) {
  return (
    <div className="relative flex-1 min-w-0">
      <input
        type="number"
        inputMode="decimal"
        step="0.01"
        min="0"
        placeholder={placeholder}
        value={value || ''}
        onChange={e => onChange(e.target.value)}
        className={cn(
          "w-full bg-transparent border-0 p-0 h-7 text-base font-semibold text-foreground",
          "placeholder:text-muted-foreground/50 focus:outline-none focus:ring-0",
          className
        )}
      />
    </div>
  );
}