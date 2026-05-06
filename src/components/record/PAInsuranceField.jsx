import React from 'react';
import { useLanguage } from '@/lib/i18n';
import { PA_INSURANCE_MONTHLY } from '@/lib/constants';
import AmountInput from '@/components/ui/AmountInput';

export default function PAInsuranceField({ value, onChange, fixedAmount }) {
  const { lang } = useLanguage();
  const monthly = fixedAmount || PA_INSURANCE_MONTHLY;
  const dailyShare = +(monthly / 26).toFixed(2);
  const isOn = (parseFloat(value) || 0) > 0;

  return (
    <div className="flex items-center gap-3 rounded-xl bg-secondary/50 px-3 py-2.5">
      <span className="text-xs font-bold px-2 py-1 rounded-lg bg-sky-50 text-sky-600 min-w-[90px] text-center">
        🛡️ PA
      </span>
      <AmountInput value={value} onChange={onChange} />
      <span className="text-xs text-muted-foreground font-medium shrink-0">RM</span>
      <button
        onClick={() => onChange(isOn ? '0' : String(dailyShare))}
        className={`shrink-0 text-[10px] font-semibold px-2 py-1 rounded-lg border transition-colors ${
          isOn
            ? 'bg-sky-100 border-sky-300 text-sky-700'
            : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
        }`}
      >
        {isOn ? (lang === 'zh' ? '已计入' : 'On') : (lang === 'zh' ? '点击计入' : 'Add')}
      </button>
    </div>
  );
}