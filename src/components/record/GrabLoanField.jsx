import React, { useState } from 'react';
import AmountInput from '@/components/ui/AmountInput';
import { useLanguage } from '@/lib/i18n';

const MODES = ['daily', 'monthly', 'custom'];

export default function GrabLoanField({ value, onChange }) {
  const { lang } = useLanguage();
  const [mode, setMode] = useState('daily');
  const [monthlyAmt, setMonthlyAmt] = useState('');

  const handleModeChange = (m) => {
    setMode(m);
    if (m === 'monthly' && monthlyAmt) {
      const daily = (parseFloat(monthlyAmt) / 26).toFixed(2);
      onChange(daily);
    } else if (m === 'daily') {
      // keep current value
    }
  };

  const handleMonthlyChange = (v) => {
    setMonthlyAmt(v);
    const daily = v ? ((parseFloat(v) || 0) / 26).toFixed(2) : '';
    onChange(daily);
  };

  const modeLabels = {
    daily: lang === 'zh' ? '每日' : 'Daily',
    monthly: lang === 'zh' ? '月固定' : 'Monthly Fixed',
    custom: lang === 'zh' ? '自定义' : 'Custom',
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold px-2 py-1 rounded-lg bg-rose-50 text-rose-600">💳 Grab Loan</span>
        <span className="text-sm font-bold text-destructive">- RM {(parseFloat(value) || 0).toFixed(2)}</span>
      </div>

      {/* Mode selector */}
      <div className="flex gap-1.5 bg-secondary rounded-xl p-1">
        {MODES.map(m => (
          <button key={m} onClick={() => handleModeChange(m)}
            className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-all ${mode === m ? 'bg-card shadow text-foreground' : 'text-muted-foreground'}`}>
            {modeLabels[m]}
          </button>
        ))}
      </div>

      {mode === 'daily' && (
        <div className="flex items-center gap-2 bg-secondary/50 rounded-xl px-3 py-2.5">
          <span className="text-xs text-muted-foreground">{lang === 'zh' ? '今日扣除' : 'Today\'s deduction'}</span>
          <AmountInput value={value} onChange={onChange} />
          <span className="text-xs text-muted-foreground shrink-0">RM</span>
        </div>
      )}

      {mode === 'monthly' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 bg-secondary/50 rounded-xl px-3 py-2.5">
            <span className="text-xs text-muted-foreground">{lang === 'zh' ? '月总额' : 'Monthly total'}</span>
            <AmountInput value={monthlyAmt} onChange={handleMonthlyChange} />
            <span className="text-xs text-muted-foreground shrink-0">RM/mth</span>
          </div>
          <p className="text-[10px] text-muted-foreground px-1">
            {lang === 'zh' ? `日均 ≈ RM${(parseFloat(value) || 0).toFixed(2)} (÷ 26天)` : `Daily avg ≈ RM${(parseFloat(value) || 0).toFixed(2)} (÷ 26 days)`}
          </p>
        </div>
      )}

      {mode === 'custom' && (
        <div className="flex items-center gap-2 bg-secondary/50 rounded-xl px-3 py-2.5">
          <span className="text-xs text-muted-foreground">{lang === 'zh' ? '自定义金额' : 'Custom amount'}</span>
          <AmountInput value={value} onChange={onChange} />
          <span className="text-xs text-muted-foreground shrink-0">RM</span>
        </div>
      )}
    </div>
  );
}