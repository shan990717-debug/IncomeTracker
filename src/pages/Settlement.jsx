import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/lib/i18n';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Save, Lock, Unlock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { calcMonthlyTotals, calcHealthStatus, monthStr } from '@/lib/finance';
import { HEALTH_STATUS } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import ProgressBar from '@/components/ui/ProgressBar';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const ALLOC_FIELDS = [
  { key: 'personal_spending',  label: 'Personal Spending',    labelZh: '个人消费',   color: 'bg-orange-50 text-orange-600', pct: true },
  { key: 'family_essential',   label: 'Family Essential',     labelZh: '家庭必需',   color: 'bg-blue-50 text-blue-600' },
  { key: 'family_claims',      label: 'Family Claims',        labelZh: '家庭报销',   color: 'bg-indigo-50 text-indigo-600' },
  { key: 'emergency_savings',  label: 'Emergency Savings',    labelZh: '应急储蓄',   color: 'bg-red-50 text-red-500' },
  { key: 'travel_savings',     label: 'Travel Savings',       labelZh: '旅行储蓄',   color: 'bg-teal-50 text-teal-600' },
  { key: 'car_repair_fund',    label: 'Car Repair Fund',      labelZh: '维修基金',   color: 'bg-amber-50 text-amber-600' },
];

export default function Settlement() {
  const { lang } = useLanguage();
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const mStr = monthStr(currentMonth);
  const [alloc, setAlloc] = useState({});
  const [settlement, setSettlement] = useState(null);
  const [saving, setSaving] = useState(false);

  const { data: allRecords = [] } = useQuery({
    queryKey: ['dailyRecords'],
    queryFn: () => base44.entities.DailyRecord.list('-date', 400),
  });

  const { data: settlements = [] } = useQuery({
    queryKey: ['settlements'],
    queryFn: () => base44.entities.MonthlySettlement.list('-month', 24),
  });

  const { data: targets = [] } = useQuery({
    queryKey: ['incomeTargets'],
    queryFn: () => base44.entities.IncomeTarget.list(),
  });

  const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
  const monthRecords = allRecords.filter(r => r.date >= monthStart && r.date <= monthEnd);
  const totals = calcMonthlyTotals(monthRecords);
  const target = targets[0];
  const defaultPersonal = totals.actualIncome * 0.35;

  useEffect(() => {
    const existing = settlements.find(s => s.month === mStr);
    if (existing) {
      setSettlement(existing);
      const a = {};
      ALLOC_FIELDS.forEach(f => { a[f.key] = String(existing[f.key] || ''); });
      setAlloc(a);
    } else {
      setSettlement(null);
      setAlloc({ personal_spending: defaultPersonal.toFixed(2), family_essential: '', family_claims: '', emergency_savings: '', travel_savings: '', car_repair_fund: '' });
    }
  }, [mStr, settlements.length, totals.actualIncome]);

  const set = (key, val) => setAlloc(p => ({ ...p, [key]: val }));

  const totalAllocated = ALLOC_FIELDS.reduce((s, f) => s + (parseFloat(alloc[f.key]) || 0), 0);
  const buffer = totals.actualIncome - totalAllocated;
  const isFinalized = settlement?.status === 'finalized';
  const healthStatus = calcHealthStatus({ ...settlement, ...Object.fromEntries(ALLOC_FIELDS.map(f => [f.key, parseFloat(alloc[f.key]) || 0])), actual_income: totals.actualIncome, cashflow_buffer: buffer }, target);
  const hs = HEALTH_STATUS[healthStatus];

  const handleSave = async (finalize = false) => {
    setSaving(true);
    const record = {
      month: mStr,
      gross_income: totals.grossIncome,
      total_operating_expense: totals.totalExpense,
      actual_income: totals.actualIncome,
      bank_total: totals.bankTotal,
      cash_total: totals.cashTotal,
      working_days: monthRecords.length,
      cashflow_buffer: buffer,
      health_status: healthStatus,
      status: finalize ? 'finalized' : 'draft',
    };
    ALLOC_FIELDS.forEach(f => { record[f.key] = parseFloat(alloc[f.key]) || 0; });

    if (settlement?.id) {
      await base44.entities.MonthlySettlement.update(settlement.id, record);
    } else {
      const created = await base44.entities.MonthlySettlement.create(record);
      setSettlement(created);
    }
    queryClient.invalidateQueries({ queryKey: ['settlements'] });
    setSaving(false);
    toast.success(finalize ? (lang === 'zh' ? '已结算' : 'Settlement finalized') : (lang === 'zh' ? '草稿已保存' : 'Draft saved'));
  };

  const handleUnlock = async () => {
    if (!settlement?.id) return;
    await base44.entities.MonthlySettlement.update(settlement.id, { status: 'draft' });
    queryClient.invalidateQueries({ queryKey: ['settlements'] });
    toast.success(lang === 'zh' ? '已解锁' : 'Unlocked');
  };

  return (
    <div className="px-4 pt-14 pb-6 space-y-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">{lang === 'zh' ? '月度结算' : 'Settlement'}</h1>
        {isFinalized && (
          <span className="text-xs bg-primary/10 text-primary font-semibold px-2 py-1 rounded-lg flex items-center gap-1">
            <Lock className="w-3 h-3" />{lang === 'zh' ? '已结算' : 'Finalized'}
          </span>
        )}
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between bg-card rounded-2xl px-4 py-3 border border-border">
        <button onClick={() => setCurrentMonth(m => subMonths(m, 1))} className="p-1"><ChevronLeft className="w-5 h-5 text-muted-foreground" /></button>
        <p className="font-bold">{format(currentMonth, 'MMMM yyyy')}</p>
        <button onClick={() => setCurrentMonth(m => addMonths(m, 1))} className="p-1"><ChevronRight className="w-5 h-5 text-muted-foreground" /></button>
      </div>

      {/* Monthly totals */}
      <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-5 text-primary-foreground">
        <p className="text-xs opacity-75 mb-1">{lang === 'zh' ? '月度实际收入' : 'Monthly Actual Income'}</p>
        <p className="text-4xl font-extrabold mb-3">RM {totals.actualIncome.toFixed(2)}</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { l: lang === 'zh' ? '总收入' : 'Gross', v: totals.grossIncome },
            { l: lang === 'zh' ? '支出' : 'Expense', v: totals.totalExpense },
            { l: lang === 'zh' ? '工作天' : 'Days', v: monthRecords.length, isCount: true },
          ].map(s => (
            <div key={s.l} className="bg-white/15 rounded-xl p-2 text-center">
              <p className="text-[10px] opacity-75">{s.l}</p>
              <p className="text-sm font-bold">{s.isCount ? s.v : `RM${s.v.toFixed(0)}`}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Health Status */}
      <div className={`rounded-2xl border px-4 py-3 flex items-center gap-3 ${hs.bg} ${hs.border}`}>
        <span className="text-2xl">{healthStatus === 'danger' ? '🔴' : healthStatus === 'tight' ? '🟠' : healthStatus === 'stable' ? '🔵' : healthStatus === 'growing' ? '🟢' : '💜'}</span>
        <div>
          <p className={`font-bold text-sm ${hs.color}`}>{lang === 'zh' ? hs.labelZh : hs.label}</p>
          <p className="text-xs text-muted-foreground">{lang === 'zh' ? '本月财务状况' : 'This month\'s financial health'}</p>
        </div>
      </div>

      {/* Allocation */}
      <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
        <h3 className="text-sm font-bold">{lang === 'zh' ? '月度分配' : 'Monthly Allocation'}</h3>
        <div className="space-y-2">
          {ALLOC_FIELDS.map(f => (
            <div key={f.key} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg ${f.color}`}>
                  {lang === 'zh' ? f.labelZh : f.label}
                  {f.pct && <span className="ml-1 opacity-60">(35%)</span>}
                </span>
                <div className="flex items-center gap-1">
                  {isFinalized ? (
                    <span className="text-sm font-bold">RM {parseFloat(alloc[f.key] || 0).toFixed(2)}</span>
                  ) : (
                    <>
                      <input type="number" inputMode="decimal" step="0.01" placeholder="0.00"
                        value={alloc[f.key] || ''}
                        onChange={e => set(f.key, e.target.value)}
                        className="w-24 text-right text-sm font-bold bg-secondary rounded-lg px-2 py-1 border-0 focus:outline-none focus:ring-1 focus:ring-primary" />
                      <span className="text-xs text-muted-foreground">RM</span>
                    </>
                  )}
                </div>
              </div>
              <ProgressBar value={parseFloat(alloc[f.key]) || 0} max={totals.actualIncome} barClass={f.pct ? 'bg-orange-400' : 'bg-primary'} />
            </div>
          ))}
        </div>

        {/* Buffer */}
        <div className={`rounded-xl p-3 mt-2 ${buffer < 0 ? 'bg-destructive/10 border border-destructive/30' : buffer < 300 ? 'bg-amber-50 border border-amber-200' : 'bg-primary/10 border border-primary/30'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {buffer < 0 ? <AlertTriangle className="w-4 h-4 text-destructive" /> : <CheckCircle2 className="w-4 h-4 text-primary" />}
              <span className="text-sm font-bold">{lang === 'zh' ? '现金流缓冲' : 'Cash Flow Buffer'}</span>
            </div>
            <span className={`text-lg font-extrabold ${buffer < 0 ? 'text-destructive' : 'text-primary'}`}>
              RM {buffer.toFixed(2)}
            </span>
          </div>
          {buffer < 0 && (
            <p className="text-xs text-destructive mt-2">
              {lang === 'zh'
                ? '⚠️ 本月收入不足以支撑当前分配。请减少支出、调整储蓄或提高下月收入目标。'
                : '⚠️ Income is not enough to support current allocation. Consider reducing spending or increasing income target.'}
            </p>
          )}
        </div>

        {/* Bank / Cash split */}
        <div className="grid grid-cols-2 gap-2 pt-1">
          <div className="bg-blue-50 rounded-xl p-3 text-center">
            <p className="text-xs text-blue-500 font-medium">{lang === 'zh' ? '银行存入' : 'Bank Total'}</p>
            <p className="text-base font-extrabold text-blue-700">RM {totals.bankTotal.toFixed(2)}</p>
          </div>
          <div className="bg-amber-50 rounded-xl p-3 text-center">
            <p className="text-xs text-amber-600 font-medium">{lang === 'zh' ? '现金' : 'Cash Total'}</p>
            <p className="text-base font-extrabold text-amber-700">RM {totals.cashTotal.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* Actions */}
      {!isFinalized ? (
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => handleSave(false)} disabled={saving} className="flex-1 h-12 rounded-2xl font-semibold">
            {lang === 'zh' ? '保存草稿' : 'Save Draft'}
          </Button>
          <Button onClick={() => handleSave(true)} disabled={saving} className="flex-1 h-12 rounded-2xl font-bold bg-primary hover:bg-primary/90">
            <Lock className="w-4 h-4 mr-1" />
            {lang === 'zh' ? '完成结算' : 'Finalize'}
          </Button>
        </div>
      ) : (
        <Button variant="outline" onClick={handleUnlock} className="w-full h-12 rounded-2xl font-semibold">
          <Unlock className="w-4 h-4 mr-2" />
          {lang === 'zh' ? '解锁编辑' : 'Unlock & Edit'}
        </Button>
      )}
    </div>
  );
}