import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/lib/i18n';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, TrendingUp, AlertTriangle, CheckCircle2, Settings2 } from 'lucide-react';
import { calcMonthlyTotals, calcHealthStatus, calcHealthReasons, monthStr } from '@/lib/finance';
import { HEALTH_STATUS } from '@/lib/constants';
import ProgressBar from '@/components/ui/ProgressBar';
import SectionCard from '@/components/ui/SectionCard';
import { motion } from 'framer-motion';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

export default function Review() {
  const { lang } = useLanguage();
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [showTargetForm, setShowTargetForm] = useState(false);
  const [targetForm, setTargetForm] = useState({ minimum_survival: '3500', comfortable: '5000', dream: '7000' });
  const mStr = monthStr(currentMonth);

  const { data: allRecords = [] } = useQuery({ queryKey: ['dailyRecords'], queryFn: () => base44.entities.DailyRecord.list('-date', 400) });
  const { data: settlements = [] } = useQuery({ queryKey: ['settlements'], queryFn: () => base44.entities.MonthlySettlement.list('-month', 24) });
  const { data: targets = [] } = useQuery({ queryKey: ['incomeTargets'], queryFn: () => base44.entities.IncomeTarget.list() });
  const { data: claims = [] } = useQuery({ queryKey: ['claims'], queryFn: () => base44.entities.Claim.list('-date_paid', 100) });

  const target = targets[0];

  useEffect(() => {
    if (target) setTargetForm({ minimum_survival: String(target.minimum_survival || 3500), comfortable: String(target.comfortable || 5000), dream: String(target.dream || 7000) });
  }, [target?.id]);

  const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
  const monthRecords = allRecords.filter(r => r.date >= monthStart && r.date <= monthEnd);
  const totals = calcMonthlyTotals(monthRecords);
  const settlement = settlements.find(s => s.month === mStr);

  const pendingClaims = claims.filter(c => c.claim_status === 'to_be_claimed' && c.date_paid >= monthStart && c.date_paid <= monthEnd);
  const pendingTotal = pendingClaims.reduce((s, c) => s + (c.amount || 0), 0);

  const personal = settlement?.personal_spending || 0;
  const familyEssential = settlement?.family_essential || 0;
  const familyClaims = settlement?.family_claims || 0;
  const tuitionFund = settlement?.tuition_fund || 0;
  const travelFund = settlement?.travel_fund || 0;
  const emergencyFund = settlement?.emergency_fund || 0;
  const carFund = settlement?.car_repair_fund || 0;
  const buffer = settlement?.cashflow_buffer ?? (totals.actualIncome - personal - familyEssential - familyClaims - tuitionFund - travelFund - emergencyFund - carFund);

  const healthKey = calcHealthStatus({ actual_income: totals.actualIncome, cashflow_buffer: buffer, emergency_savings: emergencyFund, car_repair_fund: carFund, travel_savings: travelFund }, target);
  const hs = HEALTH_STATUS[healthKey];
  const reasons = calcHealthReasons({ actual_income: totals.actualIncome, cashflow_buffer: buffer, car_repair_fund: carFund, emergency_savings: emergencyFund }, target, lang);

  const minimum = target?.minimum_survival || 3500;
  const comfortable = target?.comfortable || 5000;
  const dream = target?.dream || 7000;

  const handleSaveTarget = async () => {
    const record = { minimum_survival: parseFloat(targetForm.minimum_survival) || 3500, comfortable: parseFloat(targetForm.comfortable) || 5000, dream: parseFloat(targetForm.dream) || 7000 };
    if (target?.id) { await base44.entities.IncomeTarget.update(target.id, record); }
    else { await base44.entities.IncomeTarget.create(record); }
    queryClient.invalidateQueries({ queryKey: ['incomeTargets'] });
    setShowTargetForm(false);
    toast.success(lang === 'zh' ? '目标已保存' : 'Targets saved');
  };

  const expenseRatio = totals.grossIncome > 0 ? (totals.totalExpense / totals.grossIncome) * 100 : 0;
  const incomeVsTarget = comfortable > 0 ? Math.min(100, (totals.actualIncome / comfortable) * 100) : 0;

  return (
    <div className="px-4 pt-14 pb-6 space-y-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">{lang === 'zh' ? '月度回顾' : 'Monthly Review'}</h1>
        <button onClick={() => setShowTargetForm(v => !v)} className="p-2 rounded-xl bg-secondary">
          <Settings2 className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Target Form */}
      {showTargetForm && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <p className="text-sm font-bold">{lang === 'zh' ? '收入目标设置' : 'Income Targets'}</p>
          {[
            { key: 'minimum_survival', label: lang === 'zh' ? '最低生存目标' : 'Minimum Survival', color: 'text-destructive' },
            { key: 'comfortable', label: lang === 'zh' ? '舒适目标' : 'Comfortable Target', color: 'text-primary' },
            { key: 'dream', label: lang === 'zh' ? '梦想目标' : 'Dream Target', color: 'text-purple-600' },
          ].map(f => (
            <div key={f.key} className="flex items-center justify-between gap-3">
              <span className={`text-xs font-semibold ${f.color}`}>{f.label}</span>
              <div className="flex items-center gap-1">
                <span className="text-xs text-muted-foreground">RM</span>
                <input type="number" inputMode="decimal" value={targetForm[f.key]} onChange={e => setTargetForm(p => ({ ...p, [f.key]: e.target.value }))}
                  className="w-24 text-right bg-secondary rounded-lg px-2 py-1.5 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
            </div>
          ))}
          <Button onClick={handleSaveTarget} className="w-full h-10 rounded-xl font-bold bg-primary">{lang === 'zh' ? '保存目标' : 'Save Targets'}</Button>
        </motion.div>
      )}

      {/* Month nav */}
      <div className="flex items-center justify-between bg-card rounded-2xl px-4 py-3 border border-border">
        <button onClick={() => setCurrentMonth(m => subMonths(m, 1))} className="p-1"><ChevronLeft className="w-5 h-5 text-muted-foreground" /></button>
        <p className="font-bold">{format(currentMonth, 'MMMM yyyy')}</p>
        <button onClick={() => setCurrentMonth(m => addMonths(m, 1))} className="p-1"><ChevronRight className="w-5 h-5 text-muted-foreground" /></button>
      </div>

      {/* Health Status Card */}
      <div className={`rounded-2xl border px-5 py-4 ${hs.bg} ${hs.border}`}>
        <div className="flex items-center justify-between mb-2">
          <div>
            <p className="text-xs text-muted-foreground">{lang === 'zh' ? '本月财务状况' : 'Financial Health'}</p>
            <p className={`text-2xl font-extrabold ${hs.color}`}>{lang === 'zh' ? hs.labelZh : hs.label}</p>
          </div>
          <span className="text-4xl">{healthKey === 'danger' ? '🔴' : healthKey === 'tight' ? '🟠' : healthKey === 'stable' ? '🔵' : healthKey === 'growing' ? '🟢' : '💜'}</span>
        </div>
        {reasons.length > 0 && (
          <ul className="space-y-1 mt-2">
            {reasons.map((r, i) => (
              <li key={i} className="text-xs flex items-start gap-1.5">
                <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0 text-orange-400" />{r}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Income summary */}
      <SectionCard title={lang === 'zh' ? '本月收入总览' : 'Income Summary'}>
        <div className="space-y-3 mt-2">
          {[
            { label: lang === 'zh' ? '总收入（毛）' : 'Gross Income', val: totals.grossIncome, color: 'text-primary' },
            { label: lang === 'zh' ? '运营支出' : 'Operating Expenses', val: totals.totalExpense, color: 'text-destructive', prefix: '-' },
            { label: lang === 'zh' ? '实际收入（净）' : 'Actual Net Income', val: totals.actualIncome, color: 'text-foreground font-extrabold', large: true },
          ].map(s => (
            <div key={s.label} className={`flex justify-between items-center ${s.large ? 'border-t border-border pt-2' : ''}`}>
              <span className="text-sm text-muted-foreground">{s.label}</span>
              <span className={`text-sm font-bold ${s.color}`}>{s.prefix || ''}RM {s.val.toFixed(2)}</span>
            </div>
          ))}
          <div className="flex justify-between text-xs text-muted-foreground pt-1">
            <span>{lang === 'zh' ? '支出比率' : 'Expense Ratio'}</span>
            <span className={expenseRatio > 40 ? 'text-destructive font-semibold' : 'text-primary font-semibold'}>{expenseRatio.toFixed(1)}%</span>
          </div>
        </div>
      </SectionCard>

      {/* Target comparison */}
      <SectionCard title={lang === 'zh' ? '收入目标对比' : 'Income vs Targets'}>
        <div className="space-y-3 mt-2">
          {[
            { label: lang === 'zh' ? '最低生存' : 'Minimum Survival', target: minimum, color: 'bg-destructive' },
            { label: lang === 'zh' ? '舒适目标' : 'Comfortable', target: comfortable, color: 'bg-primary' },
            { label: lang === 'zh' ? '梦想目标' : 'Dream', target: dream, color: 'bg-purple-500' },
          ].map(t => {
            const pct = Math.min(100, (totals.actualIncome / t.target) * 100);
            const hit = totals.actualIncome >= t.target;
            return (
              <div key={t.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground font-medium">{t.label}: RM{t.target.toLocaleString()}</span>
                  {hit
                    ? <span className="text-primary font-semibold flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3" />{lang === 'zh' ? '达标' : 'Hit!'}</span>
                    : <span className="text-muted-foreground">{lang === 'zh' ? `差 RM${(t.target - totals.actualIncome).toFixed(0)}` : `-RM${(t.target - totals.actualIncome).toFixed(0)}`}</span>
                  }
                </div>
                <ProgressBar value={totals.actualIncome} max={t.target} barClass={t.color} />
              </div>
            );
          })}
          <div className="bg-secondary rounded-xl p-3 text-xs mt-1 space-y-1">
            <p className="font-semibold">{lang === 'zh' ? '📊 月度点评' : '📊 Monthly Insight'}</p>
            {totals.actualIncome >= dream
              ? <p className="text-primary">{lang === 'zh' ? '🎉 恭喜！你达到了梦想目标！' : '🎉 Congrats! You hit your Dream Target!'}</p>
              : totals.actualIncome >= comfortable
              ? <p className="text-primary">{lang === 'zh' ? `你超过了舒适目标。距梦想目标还差 RM${(dream - totals.actualIncome).toFixed(0)}。` : `You passed Comfortable. RM${(dream - totals.actualIncome).toFixed(0)} from Dream Target.`}</p>
              : totals.actualIncome >= minimum
              ? <p className="text-foreground">{lang === 'zh' ? `你达到了最低生存目标。距舒适目标还差 RM${(comfortable - totals.actualIncome).toFixed(0)}。` : `Above Minimum. RM${(comfortable - totals.actualIncome).toFixed(0)} from Comfortable Target.`}</p>
              : <p className="text-destructive">{lang === 'zh' ? `⚠️ 未达最低生存目标。还差 RM${(minimum - totals.actualIncome).toFixed(0)}。` : `⚠️ Below Minimum Survival. Need RM${(minimum - totals.actualIncome).toFixed(0)} more.`}</p>
            }
            <p className="text-muted-foreground">{lang === 'zh' ? `下月建议目标: RM${comfortable.toLocaleString()}` : `Suggested next month target: RM${comfortable.toLocaleString()}`}</p>
          </div>
        </div>
      </SectionCard>

      {/* Allocation breakdown */}
      {settlement && (
        <SectionCard title={lang === 'zh' ? '月度分配明细' : 'Allocation Breakdown'}>
          <div className="space-y-2.5 mt-2">
            {[
              { label: lang === 'zh' ? `个人消费 (${settlement.personal_spending_pct ?? 35}%)` : `Personal Spending (${settlement.personal_spending_pct ?? 35}%)`, val: personal, color: 'bg-orange-400' },
              { label: lang === 'zh' ? '家庭必需' : 'Family Essential', val: familyEssential, color: 'bg-blue-400' },
              { label: lang === 'zh' ? '家庭报销' : 'Family Claims', val: familyClaims, color: 'bg-indigo-400' },
              { label: lang === 'zh' ? '学费 / Tuition' : 'Tuition Fund', val: tuitionFund, color: 'bg-yellow-400' },
              { label: lang === 'zh' ? '旅游 / Travel' : 'Travel Fund', val: travelFund, color: 'bg-teal-400' },
              { label: lang === 'zh' ? '应急 / Emergency' : 'Emergency Fund', val: emergencyFund, color: 'bg-red-400' },
              { label: lang === 'zh' ? '车辆维修基金' : 'Car Repair Fund', val: carFund, color: 'bg-amber-400' },
              { label: lang === 'zh' ? '现金流缓冲' : 'Cash Flow Buffer', val: buffer, color: buffer >= 0 ? 'bg-primary' : 'bg-destructive' },
            ].map(a => (
              <div key={a.label}>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-muted-foreground">{a.label}</span>
                  <span className={`font-bold ${a.val < 0 ? 'text-destructive' : 'text-foreground'}`}>RM {a.val.toFixed(2)}</span>
                </div>
                <ProgressBar value={Math.max(0, a.val)} max={totals.actualIncome} barClass={a.color} />
              </div>
            ))}
          </div>
        </SectionCard>
      )}

      {/* Bank / Cash */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-blue-50 rounded-2xl border border-blue-100 p-4">
          <p className="text-xs text-blue-500 font-medium">{lang === 'zh' ? '银行存入' : 'Bank Total'}</p>
          <p className="text-xl font-extrabold text-blue-700">RM {totals.bankTotal.toFixed(2)}</p>
        </div>
        <div className="bg-amber-50 rounded-2xl border border-amber-100 p-4">
          <p className="text-xs text-amber-600 font-medium">{lang === 'zh' ? '现金' : 'Cash Total'}</p>
          <p className="text-xl font-extrabold text-amber-700">RM {totals.cashTotal.toFixed(2)}</p>
        </div>
      </div>

      {/* Claims */}
      <SectionCard title={lang === 'zh' ? '本月报销情况' : 'Claims This Month'}>
        <div className="flex justify-between mt-2">
          <div>
            <p className="text-xs text-muted-foreground">{lang === 'zh' ? '待报销金额' : 'Pending Claims'}</p>
            <p className="text-lg font-bold text-amber-600">RM {pendingTotal.toFixed(2)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">{lang === 'zh' ? '待报销笔数' : 'Pending Count'}</p>
            <p className="text-lg font-bold">{pendingClaims.length}</p>
          </div>
        </div>
      </SectionCard>

      {/* Working days */}
      <div className="bg-card rounded-2xl border border-border p-4 flex justify-between items-center">
        <div>
          <p className="text-xs text-muted-foreground">{lang === 'zh' ? '工作天数' : 'Working Days'}</p>
          <p className="text-2xl font-extrabold">{monthRecords.length}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground">{lang === 'zh' ? '日均实际收入' : 'Avg Daily Net'}</p>
          <p className="text-xl font-bold text-primary">RM {monthRecords.length > 0 ? (totals.actualIncome / monthRecords.length).toFixed(2) : '0.00'}</p>
        </div>
      </div>
    </div>
  );
}