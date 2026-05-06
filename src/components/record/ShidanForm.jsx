import React, { useState, useEffect } from 'react';
import AmountInput from '@/components/ui/AmountInput';
import { useLanguage } from '@/lib/i18n';
import { CheckCircle2, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

const RATES = [20, 25, 30];

export default function ShidanForm({ data, set }) {
  const { lang } = useLanguage();
  const [open, setOpen] = useState(false);

  const orderAmt = parseFloat(data.expense_shidan_order_amt) || 0;
  const rate = parseFloat(data.expense_shidan_rate) || 25;
  const incentive = parseFloat(data.expense_shidan_incentive) || 0;
  const shidanCost = +(orderAmt * rate / 100).toFixed(2);
  const netBenefit = incentive - shidanCost;
  const hasShidan = orderAmt > 0;

  // Sync computed cost back to parent
  React.useEffect(() => {
    if (shidanCost !== (parseFloat(data.expense_shidan) || 0)) {
      set('expense_shidan', String(shidanCost));
    }
  }, [shidanCost]);

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <button onClick={() => setOpen(v => !v)} className="w-full flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold px-2 py-1 rounded-lg bg-purple-50 text-purple-600">🎯 {lang === 'zh' ? '射单' : 'Incentive Support'}</span>
        </div>
        <div className="flex items-center gap-2">
          {hasShidan && <span className="text-sm font-bold text-destructive">- RM {shidanCost.toFixed(2)}</span>}
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4 space-y-3">
              <p className="text-xs text-muted-foreground">
                {lang === 'zh'
                  ? '射单：让别人帮忙完成订单数以达到奖励条件。公司会从订单金额扣除佣金（约20%-30%）。'
                  : 'Incentive support: someone completes orders on your behalf. The platform deducts commission (20%-30%).'}
              </p>

              {/* Order amount */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">{lang === 'zh' ? '射单订单金额' : '射单 Order Amount'}</label>
                <div className="flex items-center gap-2 bg-secondary/50 rounded-xl px-3 py-2.5">
                  <AmountInput value={data.expense_shidan_order_amt} onChange={v => set('expense_shidan_order_amt', v)} />
                  <span className="text-xs text-muted-foreground shrink-0">RM</span>
                </div>
              </div>

              {/* Commission rate */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">{lang === 'zh' ? '佣金扣除率' : 'Commission Rate'}</label>
                <div className="flex gap-2">
                  {RATES.map(r => (
                    <button key={r} onClick={() => set('expense_shidan_rate', String(r))}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                        rate === r ? 'bg-purple-100 border-purple-400 text-purple-700' : 'bg-secondary border-transparent text-muted-foreground'
                      }`}>
                      {r}%
                    </button>
                  ))}
                  <div className="flex items-center gap-1 bg-secondary rounded-xl px-2">
                    <input type="number" inputMode="decimal" value={data.expense_shidan_rate || ''} onChange={e => set('expense_shidan_rate', e.target.value)}
                      className="w-12 bg-transparent text-xs font-bold text-center focus:outline-none" placeholder="%" />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                </div>
              </div>

              {/* Computed cost */}
              <div className="bg-purple-50 rounded-xl p-3">
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">{lang === 'zh' ? '射单佣金成本' : '射单 Commission Cost'}</span>
                  <span className="font-bold text-purple-700">RM {shidanCost.toFixed(2)}</span>
                </div>
                <p className="text-[10px] text-purple-500">= RM{orderAmt.toFixed(2)} × {rate}%</p>
              </div>

              {/* Related incentive */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">{lang === 'zh' ? '对应获得的奖励金额' : 'Related Incentive Amount'}</label>
                <div className="flex items-center gap-2 bg-secondary/50 rounded-xl px-3 py-2.5">
                  <AmountInput value={data.expense_shidan_incentive} onChange={v => set('expense_shidan_incentive', v)} />
                  <span className="text-xs text-muted-foreground shrink-0">RM</span>
                </div>
              </div>

              {/* Worth-it verdict */}
              {hasShidan && (
                <div className={`rounded-xl p-3 flex items-start gap-2 ${netBenefit >= 0 ? 'bg-primary/10' : 'bg-destructive/10'}`}>
                  {netBenefit >= 0
                    ? <CheckCircle2 className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    : <AlertTriangle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />}
                  <div>
                    <p className={`text-xs font-bold ${netBenefit >= 0 ? 'text-primary' : 'text-destructive'}`}>
                      {lang === 'zh' ? `净收益: RM${netBenefit.toFixed(2)}` : `Net Benefit: RM${netBenefit.toFixed(2)}`}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {netBenefit >= 0
                        ? (lang === 'zh' ? '✅ 这次射单仍然有利可图。' : '✅ This incentive support cost is still profitable.')
                        : (lang === 'zh' ? '⚠️ 这次射单可能不划算。' : '⚠️ This incentive support cost may not be worth it.')}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}