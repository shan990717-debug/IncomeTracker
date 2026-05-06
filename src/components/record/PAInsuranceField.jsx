import React from 'react';
import { useLanguage } from '@/lib/i18n';
import { PA_INSURANCE_MONTHLY, PA_INSURANCE_DAILY_AVG } from '@/lib/constants';
import { Shield } from 'lucide-react';

export default function PAInsuranceField({ value, onChange }) {
  const { lang } = useLanguage();
  const applied = parseFloat(value) > 0;

  const handleToggle = () => {
    if (applied) {
      onChange('0');
    } else {
      onChange(String(PA_INSURANCE_DAILY_AVG));
    }
  };

  return (
    <div className="bg-card rounded-2xl border border-border p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-sky-50 flex items-center justify-center">
            <Shield className="w-4 h-4 text-sky-500" />
          </div>
          <div>
            <p className="text-xs font-bold">PA Insurance</p>
            <p className="text-[10px] text-muted-foreground">
              RM{PA_INSURANCE_MONTHLY}/{lang === 'zh' ? '月' : 'mth'} · ~RM{PA_INSURANCE_DAILY_AVG.toFixed(2)}/{lang === 'zh' ? '日' : 'day'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-sm font-bold text-destructive">
            {applied ? `- RM ${parseFloat(value).toFixed(2)}` : 'RM 0'}
          </span>
          <button onClick={handleToggle}
            className={`w-11 h-6 rounded-full transition-colors relative ${applied ? 'bg-primary' : 'bg-secondary'}`}>
            <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${applied ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground mt-2">
        {lang === 'zh'
          ? '月固定扣除 RM23.44。开启后按每日均摊记入运营支出。'
          : 'Fixed RM23.44/month. Toggling ON records the daily average share as deduction.'}
      </p>
    </div>
  );
}