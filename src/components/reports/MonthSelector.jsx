import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { format, addMonths, subMonths } from 'date-fns';
import { useLanguage } from '@/lib/i18n';

export default function MonthSelector({ currentMonth, onChange }) {
  const { t } = useLanguage();
  const monthKeys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
  const monthIndex = currentMonth.getMonth();
  const year = currentMonth.getFullYear();

  return (
    <div className="flex items-center justify-between bg-card rounded-2xl px-4 py-3 border border-border">
      <button
        onClick={() => onChange(subMonths(currentMonth, 1))}
        className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-secondary transition-colors"
      >
        <ChevronLeft className="w-5 h-5 text-muted-foreground" />
      </button>
      <div className="text-center">
        <p className="text-base font-bold text-foreground">{t(monthKeys[monthIndex])}</p>
        <p className="text-xs text-muted-foreground">{year}</p>
      </div>
      <button
        onClick={() => onChange(addMonths(currentMonth, 1))}
        className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-secondary transition-colors"
      >
        <ChevronRight className="w-5 h-5 text-muted-foreground" />
      </button>
    </div>
  );
}