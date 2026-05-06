import React, { useState, useEffect } from 'react';
import AmountInput from '@/components/ui/AmountInput';
import { useLanguage } from '@/lib/i18n';
import { ChevronDown, ChevronUp, Calculator } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

const RATES = [20, 25, 30];

export default function ShidanForm({ data, set }) {
  const { lang } = useLanguage();
  const [calcOpen, setCalcOpen] = useState(false);

  const orderAmt = parseFloat(data.expense_shidan_order_amt) || 0;
  const rate = parseFloat(data.expense_shidan_rate) || 25;
  const calcCost = +(orderAmt * rate / 100).toFixed(2);

  // When calculator is open and values change, sync to the main cost field
  useEffect(() => {
    if (calcOpen && orderAmt > 0) {
      set('expense_shidan', String(calcCost));
    }
  }, [calcCost, calcOpen]);

  // When calculator is closed, clear the helper fields
  const handleToggleCalc = () => {
    if (calcOpen) {
      set('expense_shidan_order_amt', '');
      set('expense_shidan_rate', '25');
      setCalcOpen(false);
    } else {
      setCalcOpen(true);
    }
  };

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      {/* Main row: label + direct cost input */}
      <div className="flex items-center gap-3 px-4 py-3">
        <span className="text-xs font-bold px-2 py-1 rounded-lg bg-purple-50 text-purple-600 min-w-[90px] text-center">
          🎯 {lang === 'zh' ? '射单成本' : '射单 Cost'}
        </span>
        <AmountInput
          value={data.expense_shidan}
          onChange={v => set('expense_shidan', v)}
        />
        <span className="text-xs text-muted-foreground font-medium shrink-0">RM</span>
        <button
          onClick={handleToggleCalc}
          className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-1 rounded-lg border transition-colors shrink-0 ${
            calcOpen
              ? 'bg-purple-100 border-purple-300 text-purple-700'
              : 'bg-secondary border-border text-muted-foreground hover:text-foreground'
          }`}
        >
          <Calculator className="w-3 h-3" />
          {calcOpen ? (lang === 'zh' ? '关闭' : 'Close') : (lang === 'zh' ? '计算' : 'Calc')}
        </button>
      </div>

      {/* Optional calculator */}
      <AnimatePresence>
        {calcOpen && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
              <p className="text-xs text-muted-foreground">
                {lang === 'zh'
                  ? '输入订单金额和佣金率，自动计算射单成本。'
                  : 'Enter order amount and commission rate to auto-calculate 射单 cost.'}
              </p>

              {/* Order amount */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  {lang === 'zh' ? '射单订单金额' : '射单 Order Amount'}
                </label>
                <div className="flex items-center gap-2 bg-secondary/50 rounded-xl px-3 py-2.5">
                  <AmountInput value={data.expense_shidan_order_amt} onChange={v => set('expense_shidan_order_amt', v)} />
                  <span className="text-xs text-muted-foreground shrink-0">RM</span>
                </div>
              </div>

              {/* Commission rate */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">
                  {lang === 'zh' ? '佣金扣除率' : 'Commission Rate'}
                </label>
                <div className="flex gap-2">
                  {RATES.map(r => (
                    <button key={r} onClick={() => set('expense_shidan_rate', String(r))}
                      className={`flex-1 py-2 rounded-xl text-xs font-bold border transition-all ${
                        rate === r
                          ? 'bg-purple-100 border-purple-400 text-purple-700'
                          : 'bg-secondary border-transparent text-muted-foreground'
                      }`}>
                      {r}%
                    </button>
                  ))}
                  <div className="flex items-center gap-1 bg-secondary rounded-xl px-2 flex-1">
                    <input
                      type="number" inputMode="decimal"
                      value={!RATES.includes(rate) ? data.expense_shidan_rate : ''}
                      onChange={e => set('expense_shidan_rate', e.target.value)}
                      className="w-full bg-transparent text-xs font-bold text-center focus:outline-none"
                      placeholder={lang === 'zh' ? '自定' : 'Custom'}
                    />
                    <span className="text-xs text-muted-foreground">%</span>
                  </div>
                </div>
              </div>

              {/* Result */}
              {orderAmt > 0 && (
                <div className="bg-purple-50 rounded-xl p-3 flex justify-between items-center">
                  <div>
                    <p className="text-xs text-purple-600 font-semibold">
                      {lang === 'zh' ? '计算结果' : 'Calculated Cost'}
                    </p>
                    <p className="text-[10px] text-purple-400 mt-0.5">
                      RM{orderAmt.toFixed(2)} × {rate}%
                    </p>
                  </div>
                  <p className="text-lg font-extrabold text-purple-700">RM {calcCost.toFixed(2)}</p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}