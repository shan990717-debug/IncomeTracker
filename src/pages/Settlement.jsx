import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/lib/i18n';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Lock, Unlock, AlertTriangle, CheckCircle2, Pencil } from 'lucide-react';
import { calcMonthlyTotals, calcHealthStatus, monthStr } from '@/lib/finance';
import { HEALTH_STATUS, DEFAULT_PERSONAL_SPENDING_PCT, PA_INSURANCE_MONTHLY } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import ProgressBar from '@/components/ui/ProgressBar';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

const ALLOC_FIELDS = [
  { key: 'family_essential', label: 'Family Essential Expenses', labelZh: '家庭必需',   color: 'bg-blue-50 text-blue-600' },
  { key: 'family_claims',    label: 'Family Claims',             labelZh: '家庭报销',   color: 'bg-indigo-50 text-indigo-600' },
  { key: 'tuition_fund',     label: 'Tuition Fund (学费)',       labelZh: '学费',       color: 'bg-yellow-50 text-yellow-700' },
  { key: 'travel_fund',      label: 'Travel Fund (旅游)',         labelZh: '旅游',       color: 'bg-teal-50 text-teal-600' },
  { key: 'emergency_fund',   label: 'Emergency Fund (应急)',      labelZh: '应急',       color: 'bg-red-50 text-red-500' },
  { key: 'car_repair_fund',  label: 'Car Repair Fund',           labelZh: '维修基金',   color: 'bg-amber-50 text-amber-600' },
];

export default function Settlement() {
  const { lang } = useLanguage();
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const mStr = monthStr(currentMonth);
  const [alloc, setAlloc] = useState({});
  const [personalPct, setPersonalPct] = useState(DEFAULT_PERSONAL_SPENDING_PCT);
  const [editingPct, setEditingPct] = useState(false);
  const [pctInput, setPctInput] = useState(String(DEFAULT_PERSONAL_SPENDING_PCT));
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

  useEffect(() => {
    const existing = settlements.find(s => s.month === mStr);
    if (existing) {
      setSettlement(existing);
      const pct = existing.personal_spending_pct ?? DEFAULT_PERSONAL_SPENDING_PCT;
      setPersonalPct(pct);
      setPctInput(String(pct));
      const a = {};
      ALLOC_FIELDS.forEach(f => { a[f.key] = String(existing[f.key] || ''); });
      setAlloc(a);
    } else {
      setSettlement(null);
      setPersonalPct(DEFAULT_PERSONAL_SPENDING_PCT);
      setPctInput(String(DEFAULT_PERSONAL_SPENDING_PCT));
      setAlloc({ family_essential: '', family_claims: '', tuition_fund: '', travel_fund: '', emergency_fund: '', car_repair_fund: '' });
    }
  }, [mStr, settlements.length]);

  const set = (key, val) => setAlloc(p => ({ ...p, [key]: val }));

  const personalSpending = +(totals.actualIncome * personalPct / 100).toFixed(2);
  const totalAllocated = personalSpending + ALLOC_FIELDS.reduce((s, f) => s + (parseFloat(alloc[f.key]) || 0), 0);
  const buffer = +(totals.actualIncome - totalAllocated).toFixed(2);
  const isFinalized = settlement?.status === 'finalized';

  const healthStatus = calcHealthStatus({
    actual_income: totals.actualIncome,
    cashflow_buffer: buffer,
    emergency_savings: parseFloat(alloc.emergency_fund) || 0,
    car_repair_fund: parseFloat(alloc.car_repair_fund) || 0,
    travel_savings: parseFloat(alloc.travel_fund) || 0,
  }, target);
  const hs = HEALTH_STATUS[healthStatus];

  const applyPct = () => {
    const v = parseFloat(pctInput);
    if (!isNaN(v) && v >= 0 && v <= 100) { setPersonalPct(v); }
    setEditingPct(false);
  };

  const handleSave = async (finalize = false) => {
    setSaving(true);
    const record = {
      month: mStr,
      gross_income: totals.grossIncome,
      total_operating_expense: totals.totalExpense,
      pa_insurance: PA_INSURANCE_MONTHLY,
      actual_income: totals.actualIncome,
      bank_total: totals.bankTotal,
      cash_total: totals.cashTotal,
      working_days: monthRecords.length,
      personal_spending_pct: personalPct,
      personal_spending: personalSpending,
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
            { l: lang === 'zh' ? '运营扣除' : 'Deductions', v: totals.totalExpense },
            { l: lang === 'zh' ? '工作天' : 'Days', v: monthRecords.length, isCount: true },
          ].map(s => (
            <div key={s.l} className="bg-white/15 rounded-xl p-2 text-center">
              <p className="text-[10px] opacity-75">{s.l}</p>
              <p className="text-sm font-bold">{s.isCount ? s.v : `RM${s.v.toFixed(0)}`}</p>
            </div>
          ))}
        </div>
        <div className="mt-2 pt-2 border-t border-white/20">
          <p className="text-[10px] opacity-70">PA Insurance: RM{PA_INSURANCE_MONTHLY}/month (fixed)</p>
        </div>
      </div>

      {/* Health Status */}
      <div className={`rounded-2xl border px-4 py-3 flex items-center gap-3 ${hs.bg} ${hs.border}`}>
        <span className="text-2xl">{healthStatus === 'danger' ? '🔴' : healthStatus === 'tight' ? '🟠' : healthStatus === 'stable' ? '🔵' : healthStatus === 'growing' ? '🟢' : '💜'}</span>
        <div>
          <p className={`font-bold text-sm ${hs.color}`}>{lang === 'zh' ? hs.labelZh : hs.label}</p>
          <p className="text-xs text-muted-foreground">{lang === 'zh' ? '本月财务状况' : "This month's financial health"}</p>
        </div>
      </div>

      {/* Allocation */}
      <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
        <h3 className="text-sm font-bold">{lang === 'zh' ? '月度分配' : 'Monthly Allocation'}</h3>

        {/* Personal Spending (auto-calculated from %) */}
        <div className="bg-orange-50 border border-orange-200 rounded-xl p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-orange-600">
              {lang === 'zh' ? '个人消费' : 'Personal Spending'}
            </span>
            <div className="flex items-center gap-2">
              {editingPct ? (
                <div className="flex items-center gap-1">
                  <input
                    type="number" inputMode="decimal" min="0" max="100"
                    value={pctInput}
                    onChange={e => setPctInput(e.target.value)}
                    className="w-16 text-right text-sm font-bold bg-white border border-orange-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-orange-400"
                  />
                  <span className="text-xs text-orange-600 font-bold">%</span>
                  <button onClick={applyPct} className="text-xs font-bold px-2 py-1 bg-orange-500 text-white rounded-lg">✓</button>
                </div>
              ) : (
                <>
                  <span className="text-sm font-extrabold text-orange-700">RM {personalSpending.toFixed(2)}</span>
                  {!isFinalized && (
                    <button onClick={() => setEditingPct(true)} className="flex items-center gap-0.5 text-[10px] text-orange-500 hover:text-orange-700 font-semibold border border-orange-300 px-1.5 py-0.5 rounded-lg">
                      <Pencil className="w-2.5 h-2.5" />{personalPct}%
                    </button>
                  )}
                  {isFinalized && <span className="text-xs text-orange-500">{personalPct}%</span>}
                </>
              )}
            </div>
          </div>
          {!editingPct && (
            <p className="text-[10px] text-orange-500">
              RM{totals.actualIncome.toFixed(2)} × {personalPct}% = RM{personalSpending.toFixed(2)}
            </p>
          )}
          {editingPct && !isFinalized && (
            <div className="flex gap-1.5 mt-1">
              {[30, 35, 40].map(p => (
                <button key={p} onClick={() => { setPctInput(String(p)); setPersonalPct(p); setEditingPct(false); }}
                  className={`flex-1 py-1 rounded-lg text-xs font-semibold border ${personalPct === p ? 'bg-orange-200 border-orange-400 text-orange-800' : 'bg-white border-orange-200 text-orange-600'}`}>
                  {p}%
                </button>
              ))}
            </div>
          )}
          <ProgressBar value={personalSpending} max={totals.actualIncome} barClass="bg-orange-400" />
        </div>

        {/* Other allocation fields */}
        <div className="space-y-2">
          {ALLOC_FIELDS.map(f => (
            <div key={f.key} className="space-y-1">
              <div className="flex items-center justify-between">
                <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg ${f.color}`}>
                  {lang === 'zh' ? f.labelZh : f.label}
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
              <ProgressBar value={parseFloat(alloc[f.key]) || 0} max={totals.actualIncome} barClass="bg-primary" />
            </div>
          ))}
        </div>

        {/* Cash Flow Buffer */}
        <div className={`rounded-xl p-3 mt-2 ${buffer < 0 ? 'bg-destructive/10 border border-destructive/30' : buffer < 300 ? 'bg-amber-50 border border-amber-200' : 'bg-primary/10 border border-primary/30'}`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {buffer < 0 ? <AlertTriangle className="w-4 h-4 text-destructive" /> : <CheckCircle2 className="w-4 h-4 text-primary" />}
              <div>
                <span className="text-sm font-bold">{lang === 'zh' ? '现金流缓冲' : 'Cash Flow Buffer'}</span>
                <p className="text-[10px] text-muted-foreground">{lang === 'zh' ? '留存下月周转' : 'Kept for next month\'s cash flow'}</p>
              </div>
            </div>
            <span className={`text-lg font-extrabold ${buffer < 0 ? 'text-destructive' : 'text-primary'}`}>
              RM {buffer.toFixed(2)}
            </span>
          </div>
          {buffer < 0 && (
            <p className="text-xs text-destructive mt-2">
              {lang === 'zh'
                ? '⚠️ 分配总额超过月度实际收入。请减少支出、降低储蓄比例或提高收入目标。'
                : '⚠️ Your allocation exceeds monthly actual income. Please reduce spending, savings allocation, or increase income.'}
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