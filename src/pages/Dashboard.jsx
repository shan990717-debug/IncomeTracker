import React, { useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Link } from 'react-router-dom';
import { Plus, ChevronLeft, ChevronRight, Settings, TrendingUp } from 'lucide-react';
import { calcMonthlyTotals, calcHealthStatus, monthStr } from '@/lib/finance';
import { INCOME_THRESHOLDS, HEALTH_STATUS } from '@/lib/constants';

const TODAY = format(new Date(), 'yyyy-MM-dd');
const CURRENT_MONTH = format(new Date(), 'MMMM yyyy');

const TARGET_OPTIONS = [
  { key: 'normal_breakeven', label: 'Break-even',  labelZh: '收支平衡' },
  { key: 'minimum_safe',     label: 'Min Safe',    labelZh: '最低安全' },
  { key: 'comfortable',      label: 'Comfortable', labelZh: '舒适目标' },
  { key: 'growth',           label: 'Growth',      labelZh: '成长目标' },
];

export default function Dashboard() {
  const { lang } = useLanguage();
  const [selectedTarget, setSelectedTarget] = useState('minimum_safe');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const mStr = monthStr(currentMonth);

  const { data: records = [] } = useQuery({
    queryKey: ['dailyRecords'],
    queryFn: () => base44.entities.DailyRecord.list('-date', 400),
  });

  const { data: settlement } = useQuery({
    queryKey: ['monthlySettlement', mStr],
    queryFn: () => base44.entities.MonthlySettlement.filter({ month: mStr }),
    select: d => d[0] || null,
  });

  const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
  const isCurrentMonth = mStr === monthStr(new Date());

  const monthRecords = records.filter(r => r.date >= monthStart && r.date <= monthEnd);
  const totals = calcMonthlyTotals(monthRecords);

  const todayRecords = records.filter(r => r.date === TODAY);
  const todayActual = todayRecords.reduce((s, r) => s + (r.actual_income || 0), 0);

  const targetAmt = INCOME_THRESHOLDS[selectedTarget] || INCOME_THRESHOLDS.minimum_safe;
  const progress = Math.min((totals.actualIncome / targetAmt) * 100, 100);
  const gap = targetAmt - totals.actualIncome;
  const healthKey = calcHealthStatus(totals.actualIncome);
  const health = HEALTH_STATUS[healthKey] || HEALTH_STATUS.danger;

  // Cash flow
  const carryForward = settlement?.carry_forward_in || 0;
  const cashflowBalance = settlement?.cashflow_balance || 0;

  return (
    <div className="px-4 pt-12 pb-28 space-y-4 max-w-lg mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-foreground">
            {lang === 'zh' ? '本月概览' : 'Overview'}
          </h1>
          <p className="text-xs text-muted-foreground">{format(currentMonth, 'MMMM yyyy')}</p>
        </div>
        <Link to="/settings" className="p-2 rounded-xl hover:bg-secondary transition-colors">
          <Settings className="w-4 h-4 text-muted-foreground" />
        </Link>
      </div>

      {/* Month Selector */}
      <div className="flex items-center justify-between bg-card rounded-2xl px-4 py-2.5 border border-border">
        <button onClick={() => setCurrentMonth(m => { const d = new Date(m); d.setMonth(d.getMonth() - 1); return d; })} className="p-1">
          <ChevronLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <p className="font-bold text-sm">{format(currentMonth, 'MMMM yyyy')}</p>
        <button onClick={() => setCurrentMonth(m => { const d = new Date(m); d.setMonth(d.getMonth() + 1); return d; })} className="p-1">
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {/* Main Income Card */}
      <div className="bg-gradient-to-br from-primary to-primary/75 rounded-3xl p-5 text-primary-foreground shadow-lg">
        <p className="text-xs opacity-75 font-medium mb-1">
          {lang === 'zh' ? '本月实际收入' : 'This Month Actual Income'}
        </p>
        <p className="text-4xl font-extrabold tracking-tight">
          RM {totals.actualIncome.toFixed(2)}
        </p>
        <p className="text-xs opacity-60 mt-1">
          {lang === 'zh' ? '总收入' : 'Gross'}: RM {totals.grossIncome.toFixed(2)}
          {' · '}
          {lang === 'zh' ? '扣除' : 'Deductions'}: RM {totals.totalExpense.toFixed(2)}
        </p>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-[11px] font-semibold opacity-80">
              {lang === 'zh' ? '目标进度' : 'Target Progress'}
            </span>
            <span className="text-[11px] font-extrabold">{progress.toFixed(0)}%</span>
          </div>
          <div className="h-2.5 bg-white/20 rounded-full overflow-hidden">
            <div
              className="h-full bg-white rounded-full transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between items-center mt-1.5">
            <span className="text-[10px] opacity-60">RM 0</span>
            <span className="text-[10px] opacity-60">RM {targetAmt.toLocaleString()}</span>
          </div>
        </div>
      </div>

      {/* Status + Gap Row */}
      <div className="grid grid-cols-2 gap-3">
        {/* Status */}
        <div className={`rounded-2xl border p-4 ${health.bg} ${health.border}`}>
          <p className="text-[10px] font-semibold text-muted-foreground mb-1">
            {lang === 'zh' ? '状态' : 'Status'}
          </p>
          <p className={`text-sm font-extrabold ${health.color}`}>
            {lang === 'zh' ? health.labelZh : health.label}
          </p>
          <div className="flex items-center gap-1 mt-1">
            <TrendingUp className={`w-3 h-3 ${health.color}`} />
            <p className={`text-[10px] font-medium ${health.color}`}>
              {monthRecords.length} {lang === 'zh' ? '天记录' : 'days recorded'}
            </p>
          </div>
        </div>

        {/* Gap to Target */}
        <div className="rounded-2xl border border-border bg-card p-4">
          <p className="text-[10px] font-semibold text-muted-foreground mb-1">
            {lang === 'zh' ? '距目标差距' : 'Gap to Target'}
          </p>
          {gap > 0 ? (
            <>
              <p className="text-sm font-extrabold text-amber-600">- RM {gap.toFixed(2)}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {lang === 'zh' ? '目标: ' : 'Target: '}
                {TARGET_OPTIONS.find(t => t.key === selectedTarget)?.[lang === 'zh' ? 'labelZh' : 'label']}
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-extrabold text-primary">✓ {lang === 'zh' ? '已达成' : 'Achieved'}</p>
              <p className="text-[10px] text-muted-foreground mt-1">
                {lang === 'zh' ? '超出' : 'Exceeded by'} RM {Math.abs(gap).toFixed(0)}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Target Selector */}
      <div className="bg-card rounded-2xl border border-border p-3">
        <p className="text-[10px] font-semibold text-muted-foreground mb-2">
          {lang === 'zh' ? '选择目标' : 'Select Target'}
        </p>
        <div className="flex gap-1.5 flex-wrap">
          {TARGET_OPTIONS.map(t => (
            <button
              key={t.key}
              onClick={() => setSelectedTarget(t.key)}
              className={`text-[11px] font-semibold px-3 py-1.5 rounded-xl border transition-all ${
                selectedTarget === t.key
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-secondary text-muted-foreground border-transparent hover:border-border'
              }`}
            >
              {lang === 'zh' ? t.labelZh : t.label}
              <span className="ml-1 opacity-60 text-[10px]">RM {(INCOME_THRESHOLDS[t.key] / 1000).toFixed(1)}k</span>
            </button>
          ))}
        </div>
      </div>

      {/* Today + Cash Flow */}
      <div className="grid grid-cols-2 gap-3">
        {/* Today */}
        {isCurrentMonth && (
          <div className="rounded-2xl border border-border bg-card p-4">
            <p className="text-[10px] font-semibold text-muted-foreground mb-1">
              {lang === 'zh' ? '今日实际收入' : 'Today\'s Income'}
            </p>
            {todayActual > 0 ? (
              <>
                <p className="text-lg font-extrabold text-primary">RM {todayActual.toFixed(2)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{format(new Date(), 'd MMM')}</p>
              </>
            ) : (
              <>
                <p className="text-sm font-bold text-muted-foreground">—</p>
                <Link to="/today" className="text-[10px] text-primary underline">
                  {lang === 'zh' ? '添加记录' : 'Add record'}
                </Link>
              </>
            )}
          </div>
        )}

        {/* Cash Flow Balance */}
        <div className={`rounded-2xl border bg-card p-4 ${isCurrentMonth ? '' : 'col-span-2'}`}>
          <p className="text-[10px] font-semibold text-muted-foreground mb-1">
            {lang === 'zh' ? '现金流余额' : 'Cash Flow'}
          </p>
          {settlement ? (
            <>
              <p className={`text-lg font-extrabold ${cashflowBalance >= 0 ? 'text-primary' : 'text-destructive'}`}>
                RM {cashflowBalance.toFixed(2)}
              </p>
              {carryForward > 0 && (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {lang === 'zh' ? '含上月结转' : 'Incl. carry-fwd'} RM {carryForward.toFixed(0)}
                </p>
              )}
            </>
          ) : (
            <p className="text-sm text-muted-foreground font-medium">—</p>
          )}
        </div>
      </div>

      {/* Small Balance Cards */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: lang === 'zh' ? '存入银行' : 'Stored Bank', val: totals.bankTotal, color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: lang === 'zh' ? '存入现金' : 'Stored Cash', val: totals.cashTotal, color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: lang === 'zh' ? '记录天数' : 'Days Logged', val: monthRecords.length, color: 'text-primary', bg: 'bg-primary/10', isCount: true },
        ].map(card => (
          <div key={card.label} className={`rounded-2xl p-3 ${card.bg}`}>
            <p className="text-[10px] text-muted-foreground font-medium mb-1 leading-tight">{card.label}</p>
            <p className={`text-sm font-extrabold ${card.color}`}>
              {card.isCount ? card.val : `RM ${card.val.toFixed(0)}`}
            </p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="flex gap-3">
        <Link to="/today"
          className="flex-1 flex items-center justify-center gap-2 h-12 bg-primary text-primary-foreground rounded-2xl font-bold text-sm shadow hover:bg-primary/90 transition-colors">
          <Plus className="w-5 h-5" />
          {lang === 'zh' ? '记录今日收入' : 'Add Today\'s Record'}
        </Link>
        <Link to="/records"
          className="flex items-center justify-center px-4 h-12 bg-secondary text-foreground rounded-2xl font-semibold text-sm border border-border hover:bg-border transition-colors">
          {lang === 'zh' ? '记录' : 'Records'}
        </Link>
      </div>
    </div>
  );
}