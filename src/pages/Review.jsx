import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/lib/i18n';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, CheckCircle2, AlertTriangle, Settings2, ChevronDown, ChevronUp } from 'lucide-react';
import { calcMonthlyTotals, calcHealthStatus, calcHealthReasons, monthStr } from '@/lib/finance';
import { HEALTH_STATUS } from '@/lib/constants';
import ProgressBar from '@/components/ui/ProgressBar';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function Review() {
  const { lang } = useLanguage();
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showTargetForm, setShowTargetForm] = useState(false);
  const [showAllocation, setShowAllocation] = useState(false);
  const [showChart, setShowChart] = useState(false);
  const [targetForm, setTargetForm] = useState({ minimum_survival: '3500', comfortable: '5000', dream: '7000' });
  const mStr = monthStr(currentMonth);

  const { data: allRecords = [] } = useQuery({ queryKey: ['dailyRecords'], queryFn: () => base44.entities.DailyRecord.list('-date', 400) });
  const { data: settlements = [] } = useQuery({ queryKey: ['settlements'], queryFn: () => base44.entities.MonthlySettlement.list('-month', 24) });
  const { data: targets = [] } = useQuery({ queryKey: ['incomeTargets'], queryFn: () => base44.entities.IncomeTarget.list() });

  const target = targets[0];

  useEffect(() => {
    if (target) setTargetForm({ minimum_survival: String(target.minimum_survival || 3500), comfortable: String(target.comfortable || 5000), dream: String(target.dream || 7000) });
  }, [target?.id]);

  const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
  const monthRecords = allRecords.filter(r => r.date >= monthStart && r.date <= monthEnd);
  const totals = calcMonthlyTotals(monthRecords);
  const settlement = settlements.find(s => s.month === mStr);

  const personal = settlement?.personal_spending || 0;
  const familyEssential = settlement?.family_essential || 0;
  const familyClaims = settlement?.family_claims || 0;
  const emergencySavings = settlement?.emergency_savings || 0;
  const travelSavings = settlement?.travel_savings || 0;
  const carFund = settlement?.car_repair_fund || 0;
  const buffer = settlement?.cashflow_buffer ?? (totals.actualIncome - personal - familyEssential - familyClaims - emergencySavings - travelSavings - carFund);

  const healthKey = calcHealthStatus({ actual_income: totals.actualIncome, cashflow_buffer: buffer, emergency_savings: emergencySavings, car_repair_fund: carFund, travel_savings: travelSavings }, target);
  const hs = HEALTH_STATUS[healthKey];
  const reasons = calcHealthReasons({ actual_income: totals.actualIncome, cashflow_buffer: buffer, car_repair_fund: carFund, emergency_savings: emergencySavings }, target, lang);
  const healthEmoji = { danger: '🔴', tight: '🟠', stable: '🔵', growing: '🟢', flexible: '💜' }[healthKey];

  const minimum = target?.minimum_survival || 3500;
  const comfortable = target?.comfortable || 5000;
  const dream = target?.dream || 7000;
  const expenseRatio = totals.grossIncome > 0 ? (totals.totalExpense / totals.grossIncome) * 100 : 0;
  const avgDaily = monthRecords.length > 0 ? totals.actualIncome / monthRecords.length : 0;

  // Insight message
  const insightMsg = totals.actualIncome >= dream
    ? (lang === 'zh' ? '🎉 恭喜！你达到了梦想目标！' : '🎉 Congrats! You hit your Dream Target!')
    : totals.actualIncome >= comfortable
    ? (lang === 'zh' ? `超过舒适目标，距梦想差 RM${(dream - totals.actualIncome).toFixed(0)}` : `Past Comfortable. RM${(dream - totals.actualIncome).toFixed(0)} from Dream.`)
    : totals.actualIncome >= minimum
    ? (lang === 'zh' ? `已达最低目标，距舒适差 RM${(comfortable - totals.actualIncome).toFixed(0)}` : `Above Minimum. RM${(comfortable - totals.actualIncome).toFixed(0)} from Comfortable.`)
    : (lang === 'zh' ? `⚠️ 低于最低目标，还差 RM${(minimum - totals.actualIncome).toFixed(0)}` : `⚠️ Below Minimum. Need RM${(minimum - totals.actualIncome).toFixed(0)} more.`);

  const handleSaveTarget = async () => {
    const record = { minimum_survival: parseFloat(targetForm.minimum_survival) || 3500, comfortable: parseFloat(targetForm.comfortable) || 5000, dream: parseFloat(targetForm.dream) || 7000 };
    if (target?.id) { await base44.entities.IncomeTarget.update(target.id, record); }
    else { await base44.entities.IncomeTarget.create(record); }
    queryClient.invalidateQueries({ queryKey: ['incomeTargets'] });
    setShowTargetForm(false);
    toast.success(lang === 'zh' ? '目标已保存' : 'Targets saved');
  };

  // Chart data (last 6 months)
  const chartData = Array.from({ length: 6 }, (_, i) => {
    const d = subMonths(currentMonth, 5 - i);
    const mS = format(startOfMonth(d), 'yyyy-MM-dd');
    const mE = format(endOfMonth(d), 'yyyy-MM-dd');
    const recs = allRecords.filter(r => r.date >= mS && r.date <= mE);
    return {
      month: format(d, 'MMM'),
      net: recs.reduce((s, r) => s + (r.actual_income || 0), 0),
    };
  });

  return (
    <div className="px-4 pt-12 pb-8 space-y-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">{lang === 'zh' ? '月度回顾' : 'Review'}</h1>
        <button onClick={() => setShowTargetForm(v => !v)} className="p-2 rounded-xl bg-secondary">
          <Settings2 className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Target Form */}
      <AnimatePresence>
        {showTargetForm && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="bg-card rounded-2xl border border-border p-4 space-y-3">
            <p className="text-sm font-bold">{lang === 'zh' ? '收入目标' : 'Income Targets'}</p>
            {[
              { key: 'minimum_survival', label: lang === 'zh' ? '最低生存' : 'Minimum', color: 'text-destructive' },
              { key: 'comfortable',      label: lang === 'zh' ? '舒适目标' : 'Comfortable', color: 'text-primary' },
              { key: 'dream',            label: lang === 'zh' ? '梦想目标' : 'Dream', color: 'text-purple-600' },
            ].map(f => (
              <div key={f.key} className="flex items-center justify-between">
                <span className={`text-sm font-semibold ${f.color}`}>{f.label}</span>
                <div className="flex items-center gap-1">
                  <span className="text-xs text-muted-foreground">RM</span>
                  <input type="number" inputMode="decimal" value={targetForm[f.key]} onChange={e => setTargetForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className="w-24 text-right bg-secondary rounded-lg px-2 py-1.5 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
              </div>
            ))}
            <Button onClick={handleSaveTarget} className="w-full h-10 rounded-xl font-bold bg-primary">{lang === 'zh' ? '保存' : 'Save'}</Button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Month nav */}
      <div className="flex items-center justify-between bg-card rounded-2xl px-4 py-3 border border-border">
        <button onClick={() => setCurrentMonth(m => subMonths(m, 1))} className="p-1 rounded-lg hover:bg-secondary"><ChevronLeft className="w-5 h-5 text-muted-foreground" /></button>
        <p className="font-bold">{format(currentMonth, 'MMMM yyyy')}</p>
        <button onClick={() => setCurrentMonth(m => addMonths(m, 1))} className="p-1 rounded-lg hover:bg-secondary"><ChevronRight className="w-5 h-5 text-muted-foreground" /></button>
      </div>

      {/* Financial Health — the main card */}
      <div className={`rounded-3xl border-2 p-5 ${hs.bg} ${hs.border}`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-xs text-muted-foreground font-medium">{lang === 'zh' ? '本月财务状况' : 'Financial Health'}</p>
            <p className={`text-3xl font-black ${hs.color}`}>{healthEmoji} {lang === 'zh' ? hs.labelZh : hs.label}</p>
          </div>
        </div>

        {/* Main reason */}
        {reasons.length > 0 ? (
          <div className="bg-white/60 rounded-xl p-3 space-y-1">
            {reasons.slice(0, 2).map((r, i) => (
              <p key={i} className="text-xs flex items-start gap-1.5">
                <AlertTriangle className="w-3 h-3 text-orange-400 shrink-0 mt-0.5" />{r}
              </p>
            ))}
          </div>
        ) : (
          <div className="bg-white/60 rounded-xl p-3">
            <p className="text-xs text-primary flex items-center gap-1.5">
              <CheckCircle2 className="w-3 h-3" />{lang === 'zh' ? '本月财务状况良好！' : 'Finances are looking good this month!'}
            </p>
          </div>
        )}
      </div>

      {/* Quick insight */}
      <div className="bg-card rounded-2xl border border-border px-4 py-3">
        <p className="text-xs font-bold text-muted-foreground mb-1">{lang === 'zh' ? '月度小结' : 'Monthly Insight'}</p>
        <p className="text-sm font-semibold">{insightMsg}</p>
      </div>

      {/* Income summary — 3 big numbers */}
      <div className="bg-card rounded-2xl border border-border p-4">
        <p className="text-xs font-bold text-muted-foreground mb-3">{lang === 'zh' ? '本月收入' : 'Monthly Income'}</p>
        <div className="flex justify-between items-end">
          <div>
            <p className="text-xs text-muted-foreground">{lang === 'zh' ? '总收入' : 'Gross'}</p>
            <p className="text-xl font-bold">RM {totals.grossIncome.toFixed(0)}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-muted-foreground">{lang === 'zh' ? '支出' : 'Expense'}</p>
            <p className="text-xl font-bold text-orange-600">- RM {totals.totalExpense.toFixed(0)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{lang === 'zh' ? '实际' : 'Net'}</p>
            <p className="text-2xl font-extrabold text-primary">RM {totals.actualIncome.toFixed(0)}</p>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-border flex justify-between text-xs text-muted-foreground">
          <span>{monthRecords.length} {lang === 'zh' ? '个工作日' : 'working days'}</span>
          <span>{lang === 'zh' ? `日均 RM${avgDaily.toFixed(0)}` : `Avg RM${avgDaily.toFixed(0)}/day`}</span>
          <span className={expenseRatio > 40 ? 'text-destructive font-semibold' : ''}>{lang === 'zh' ? `支出率 ${expenseRatio.toFixed(0)}%` : `Expense ratio ${expenseRatio.toFixed(0)}%`}</span>
        </div>
      </div>

      {/* Target bars */}
      <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
        <p className="text-xs font-bold text-muted-foreground">{lang === 'zh' ? '收入目标进度' : 'Income Targets'}</p>
        {[
          { label: lang === 'zh' ? '最低生存' : 'Minimum', target: minimum, color: 'bg-destructive' },
          { label: lang === 'zh' ? '舒适目标' : 'Comfortable', target: comfortable, color: 'bg-primary' },
          { label: lang === 'zh' ? '梦想目标' : 'Dream', target: dream, color: 'bg-purple-500' },
        ].map(t => {
          const hit = totals.actualIncome >= t.target;
          return (
            <div key={t.label}>
              <div className="flex justify-between text-xs mb-1">
                <span className="text-muted-foreground">{t.label} · RM{t.target.toLocaleString()}</span>
                {hit
                  ? <span className="text-primary font-semibold flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3" />{lang === 'zh' ? '达标' : 'Hit!'}</span>
                  : <span className="text-muted-foreground">{lang === 'zh' ? `差` : `-`} RM{(t.target - totals.actualIncome).toFixed(0)}</span>}
              </div>
              <ProgressBar value={totals.actualIncome} max={t.target} barClass={t.color} />
            </div>
          );
        })}
      </div>

      {/* Cash flow buffer highlight */}
      <div className={`rounded-2xl border px-4 py-4 ${buffer < 0 ? 'bg-destructive/5 border-destructive/30' : buffer < 300 ? 'bg-amber-50 border-amber-200' : 'bg-primary/5 border-primary/20'}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{lang === 'zh' ? '现金流缓冲' : 'Cash Flow Buffer'}</p>
            <p className="text-xs text-muted-foreground">{lang === 'zh' ? '（留给下月使用）' : '(kept for next month)'}</p>
          </div>
          <p className={`text-2xl font-extrabold ${buffer < 0 ? 'text-destructive' : buffer < 300 ? 'text-amber-600' : 'text-primary'}`}>
            RM {buffer.toFixed(2)}
          </p>
        </div>
        {buffer < 300 && (
          <p className="text-xs mt-2 font-medium text-amber-700">
            {buffer < 0
              ? (lang === 'zh' ? '⚠️ 分配超出收入！' : '⚠️ Over-allocated!')
              : (lang === 'zh' ? '⚠️ 缓冲偏低，注意下月现金流' : '⚠️ Buffer is low. Watch cash flow next month.')}
          </p>
        )}
      </div>

      {/* Allocation detail — collapsible */}
      {settlement && (
        <div className="bg-card rounded-2xl border border-border overflow-hidden">
          <button onClick={() => setShowAllocation(v => !v)} className="w-full flex items-center justify-between px-4 py-3.5">
            <p className="text-sm font-bold">{lang === 'zh' ? '分配明细' : 'Allocation Details'}</p>
            {showAllocation ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
          </button>
          <AnimatePresence>
            {showAllocation && (
              <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                <div className="px-4 pb-4 border-t border-border pt-3 space-y-2.5">
                  {[
                    { label: lang === 'zh' ? '个人消费' : 'Personal', val: personal, color: 'bg-orange-400' },
                    { label: lang === 'zh' ? '家庭必需' : 'Family Essential', val: familyEssential, color: 'bg-blue-400' },
                    { label: lang === 'zh' ? '家庭报销' : 'Family Claims', val: familyClaims, color: 'bg-indigo-400' },
                    { label: lang === 'zh' ? '应急储蓄' : 'Emergency', val: emergencySavings, color: 'bg-red-400' },
                    { label: lang === 'zh' ? '旅行储蓄' : 'Travel', val: travelSavings, color: 'bg-teal-400' },
                    { label: lang === 'zh' ? '维修基金' : 'Car Fund', val: carFund, color: 'bg-amber-400' },
                    { label: lang === 'zh' ? '现金流缓冲' : 'Buffer', val: buffer, color: buffer >= 0 ? 'bg-primary' : 'bg-destructive' },
                  ].map(a => (
                    <div key={a.label}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-muted-foreground">{a.label}</span>
                        <span className={`font-bold ${a.val < 0 ? 'text-destructive' : ''}`}>RM {a.val.toFixed(2)}</span>
                      </div>
                      <ProgressBar value={Math.max(0, a.val)} max={totals.actualIncome} barClass={a.color} />
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* 6-month trend chart — collapsible */}
      <div className="bg-card rounded-2xl border border-border overflow-hidden">
        <button onClick={() => setShowChart(v => !v)} className="w-full flex items-center justify-between px-4 py-3.5">
          <p className="text-sm font-bold">{lang === 'zh' ? '6 个月趋势' : '6-Month Trend'}</p>
          {showChart ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </button>
        <AnimatePresence>
          {showChart && (
            <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
              <div className="px-4 pb-4 border-t border-border pt-3 h-44">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barGap={2}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                    <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} width={40} />
                    <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 11 }} />
                    <Bar dataKey="net" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Net Income" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}