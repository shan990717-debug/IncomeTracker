import React from 'react';
import { useLanguage } from '@/lib/i18n';
import { Input } from '@/components/ui/input';
import { Landmark, Banknote, CheckCircle2, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

export default function StorageStep({ data, onChange, actualIncome }) {
  const { t } = useLanguage();
  const bankAmt = parseFloat(data.stored_bank) || 0;
  const cashAmt = parseFloat(data.stored_cash) || 0;
  const remaining = actualIncome - bankAmt - cashAmt;

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-5">
      <div>
        <h2 className="text-lg font-bold text-foreground">{t('storage')}</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t('actualIncome')}: <span className="font-bold text-primary">RM {actualIncome.toFixed(2)}</span>
        </p>
      </div>

      {/* Status indicator */}
      <div className={`flex items-center gap-2 rounded-2xl p-3 ${
        Math.abs(remaining) < 0.01 
          ? 'bg-primary/10 text-primary' 
          : remaining < 0 
            ? 'bg-destructive/10 text-destructive'
            : 'bg-accent/10 text-accent-foreground'
      }`}>
        {Math.abs(remaining) < 0.01 ? (
          <CheckCircle2 className="w-5 h-5" />
        ) : (
          <AlertCircle className="w-5 h-5" />
        )}
        <span className="text-sm font-medium">
          {Math.abs(remaining) < 0.01
            ? t('allAllocated')
            : remaining > 0
              ? `${t('remainingToAllocate')}: RM ${remaining.toFixed(2)}`
              : `${t('overAllocated')} RM ${Math.abs(remaining).toFixed(2)}`
          }
        </span>
      </div>

      <div className="space-y-3">
        <div className="bg-card rounded-2xl p-4 border border-border space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <Landmark className="w-5 h-5 text-blue-500" />
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground">{t('bankAmount')}</label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                placeholder="0.00"
                value={data.stored_bank || ''}
                onChange={(e) => onChange('stored_bank', e.target.value)}
                className="border-0 p-0 h-7 text-base font-semibold bg-transparent shadow-none focus-visible:ring-0"
              />
            </div>
            <span className="text-xs text-muted-foreground font-medium">RM</span>
          </div>
        </div>

        <div className="bg-card rounded-2xl p-4 border border-border space-y-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center">
              <Banknote className="w-5 h-5 text-amber-500" />
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-muted-foreground">{t('cashAmount')}</label>
              <Input
                type="number"
                inputMode="decimal"
                step="0.01"
                placeholder="0.00"
                value={data.stored_cash || ''}
                onChange={(e) => onChange('stored_cash', e.target.value)}
                className="border-0 p-0 h-7 text-base font-semibold bg-transparent shadow-none focus-visible:ring-0"
              />
            </div>
            <span className="text-xs text-muted-foreground font-medium">RM</span>
          </div>
        </div>

        {/* Quick fill buttons */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              onChange('stored_bank', actualIncome.toString());
              onChange('stored_cash', '0');
            }}
            className="flex-1 py-2.5 text-xs font-semibold rounded-xl border border-border bg-card hover:bg-secondary transition-colors"
          >
            100% {t('bank')}
          </button>
          <button
            type="button"
            onClick={() => {
              onChange('stored_bank', '0');
              onChange('stored_cash', actualIncome.toString());
            }}
            className="flex-1 py-2.5 text-xs font-semibold rounded-xl border border-border bg-card hover:bg-secondary transition-colors"
          >
            100% {t('cash')}
          </button>
          <button
            type="button"
            onClick={() => {
              const half = (actualIncome / 2).toFixed(2);
              onChange('stored_bank', half);
              onChange('stored_cash', half);
            }}
            className="flex-1 py-2.5 text-xs font-semibold rounded-xl border border-border bg-card hover:bg-secondary transition-colors"
          >
            50/50
          </button>
        </div>
      </div>
    </motion.div>
  );
}