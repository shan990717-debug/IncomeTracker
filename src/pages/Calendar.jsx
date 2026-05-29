import React, { useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, subMonths, addMonths, getDaysInMonth, startOfYear, endOfYear } from 'date-fns';
import { fmtDate } from '@/lib/finance';
import { ChevronLeft, ChevronRight, Landmark, Banknote } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import SectionCard from '@/components/ui/SectionCard';

const TABS = ['daily', 'monthly', 'yearly'];

export default function Calendar() {
  const { lang } = useLanguage();
  const [tab, setTab] = useState('daily');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [currentYear, setCurrentYear] = useState(new Date().getFullYear());
  const tabLabels = { daily: lang === 'zh' ? '每日' : 'Daily', monthly: lang === 'zh' ? '月度' : 'Monthly', yearly: lang === 'zh' ? '年度' : 'Yearly' };

  const { data: allRecords = [] } = useQuery({
    queryKey: ['dailyRecords'],
    queryFn: () => base44.entities.DailyRecord.list('-date', 400),
  });

  return (
    <div className="px-4 pt-14 pb-6 max-w-lg mx-auto space-y-4">
      <h1 className="text-xl font-extrabold">{lang === 'zh' ? '收入日历' : 'Calendar'}</h1>

      {/* Tabs */}
      <div className="flex bg-secondary rounded-2xl p-1">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-all ${tab === t ? 'bg-card shadow text-foreground' : 'text-muted-foreground'}`}>
            {tabLabels[t]}
          </button>
        ))}
      </div>

      {tab === 'daily' && <DailyView records={allRecords} currentMonth={currentMonth} setCurrentMonth={setCurrentMonth} lang={lang} />}
      {tab === 'monthly' && <MonthlyView records={allRecords} currentMonth={currentMonth} setCurrentMonth={setCurrentMonth} lang={lang} />}
      {tab === 'yearly' && <YearlyView records={allRecords} year={currentYear} setYear={setCurrentYear} lang={lang} />}
    </div>
  );
}

function DailyView({ records, currentMonth, setCurrentMonth, lang }) {
  const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
  const monthRecords = records.filter(r => r.date >= monthStart && r.date <= monthEnd)
    .sort((a, b) => b.date.localeCompare(a.date));

  const monthKeys = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
  const zhMonths = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
  const monthLabel = lang === 'zh' ? zhMonths[currentMonth.getMonth()] : format(currentMonth, 'MMMM yyyy');

  return (
    <div className="space-y-3">
      <MonthNav label={monthLabel} onPrev={() => setCurrentMonth(m => subMonths(m, 1))} onNext={() => setCurrentMonth(m => addMonths(m, 1))} />
      {monthRecords.length === 0
        ? <EmptyState lang={lang} />
        : monthRecords.map(r => <DayCard key={r.id} record={r} lang={lang} />)}
    </div>
  );
}

function DayCard({ record, lang }) {
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-2xl border border-border p-4 flex items-center justify-between">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-11 h-11 rounded-xl bg-primary/10 flex flex-col items-center justify-center shrink-0">
          <span className="text-base font-extrabold text-primary leading-none">{format(new Date(record.date + 'T00:00:00'), 'd')}</span>
          <span className="text-[9px] text-primary/70 font-medium">{format(new Date(record.date + 'T00:00:00'), 'EEE')}</span>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{fmtDate(record.date)}</p>
          <div className="flex gap-2 mt-0.5">
            <span className="text-xs text-primary font-medium">+RM{(record.total_income||0).toFixed(0)}</span>
            <span className="text-xs text-destructive">-RM{(record.total_expense||0).toFixed(0)}</span>
            <span className="text-[10px] text-blue-500 flex items-center gap-0.5"><Landmark className="w-2.5 h-2.5" />{(record.stored_bank||0).toFixed(0)}</span>
            <span className="text-[10px] text-amber-500 flex items-center gap-0.5"><Banknote className="w-2.5 h-2.5" />{(record.stored_cash||0).toFixed(0)}</span>
          </div>
        </div>
      </div>
      <div className="flex items-center gap-3 ml-2 shrink-0">
        <p className="text-base font-extrabold text-primary">RM {(record.actual_income||0).toFixed(2)}</p>
        <Link to={`/today?date=${record.date}&edit=${record.id}`}
          className="text-xs font-semibold px-2.5 py-1.5 bg-secondary rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/10 border border-border transition-colors">
          {lang === 'zh' ? '编辑' : 'Edit'}
        </Link>
      </div>
    </motion.div>
  );
}

function MonthlyView({ records, currentMonth, setCurrentMonth, lang }) {
  const year = currentMonth.getFullYear();
  const zhMonths = ['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];
  const months = Array.from({ length: 12 }, (_, i) => {
    const mStr = `${year}-${String(i + 1).padStart(2, '0')}`;
    const recs = records.filter(r => r.date.startsWith(mStr));
    return {
      month: lang === 'zh' ? zhMonths[i] : format(new Date(year, i, 1), 'MMM'),
      income: recs.reduce((s, r) => s + (r.total_income || 0), 0),
      expense: recs.reduce((s, r) => s + (r.total_expense || 0), 0),
      net: recs.reduce((s, r) => s + (r.actual_income || 0), 0),
      days: recs.length,
    };
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between bg-card rounded-2xl px-4 py-3 border border-border">
        <button onClick={() => setCurrentMonth(m => new Date(m.getFullYear() - 1, m.getMonth()))} className="p-1"><ChevronLeft className="w-5 h-5 text-muted-foreground" /></button>
        <p className="font-bold">{year}</p>
        <button onClick={() => setCurrentMonth(m => new Date(m.getFullYear() + 1, m.getMonth()))} className="p-1"><ChevronRight className="w-5 h-5 text-muted-foreground" /></button>
      </div>
      <SectionCard title={lang === 'zh' ? '月度趋势' : 'Monthly Trend'}>
        <div className="h-44 mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={months} barGap={1}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="month" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
              <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} width={38} />
              <Tooltip contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 12, fontSize: 11 }} />
              <Bar dataKey="net" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} name="Net" />
              <Bar dataKey="expense" fill="hsl(var(--destructive))" radius={[3, 3, 0, 0]} name="Exp" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>
      <div className="space-y-2">
        {months.filter(m => m.days > 0).reverse().map((m, i) => (
          <div key={i} className="bg-card rounded-2xl border border-border px-4 py-3 flex justify-between items-center">
            <div>
              <p className="text-sm font-semibold">{m.month} {year}</p>
              <p className="text-xs text-muted-foreground">{m.days} {lang === 'zh' ? '天' : 'days'}</p>
            </div>
            <div className="text-right">
              <p className="text-sm font-bold text-primary">RM {m.net.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground">+{m.income.toFixed(0)} / -{m.expense.toFixed(0)}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function YearlyView({ records, year, setYear, lang }) {
  const yearRecords = records.filter(r => r.date?.startsWith(year.toString()));
  const totalIncome = yearRecords.reduce((s, r) => s + (r.total_income || 0), 0);
  const totalExpense = yearRecords.reduce((s, r) => s + (r.total_expense || 0), 0);
  const netIncome = yearRecords.reduce((s, r) => s + (r.actual_income || 0), 0);
  const totalBank = yearRecords.reduce((s, r) => s + (r.stored_bank || 0), 0);
  const totalCash = yearRecords.reduce((s, r) => s + (r.stored_cash || 0), 0);
  const avgMonthly = netIncome / 12;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between bg-card rounded-2xl px-4 py-3 border border-border">
        <button onClick={() => setYear(y => y - 1)} className="p-1"><ChevronLeft className="w-5 h-5 text-muted-foreground" /></button>
        <p className="font-bold text-lg">{year}</p>
        <button onClick={() => setYear(y => y + 1)} className="p-1"><ChevronRight className="w-5 h-5 text-muted-foreground" /></button>
      </div>
      <div className="bg-gradient-to-br from-primary to-primary/70 rounded-2xl p-5 text-primary-foreground">
        <p className="text-xs opacity-75 mb-1">{lang === 'zh' ? '年度净收入' : 'Annual Net Income'}</p>
        <p className="text-4xl font-extrabold">RM {netIncome.toFixed(2)}</p>
        <p className="text-xs opacity-75 mt-1">{lang === 'zh' ? `月均 RM${avgMonthly.toFixed(0)}` : `Avg RM${avgMonthly.toFixed(0)}/month`}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: lang === 'zh' ? '总收入' : 'Gross Income', val: totalIncome, color: 'text-primary' },
          { label: lang === 'zh' ? '总支出' : 'Total Expense', val: totalExpense, color: 'text-destructive' },
          { label: lang === 'zh' ? '银行存入' : 'Bank Total', val: totalBank, color: 'text-blue-600' },
          { label: lang === 'zh' ? '现金' : 'Cash Total', val: totalCash, color: 'text-amber-600' },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-2xl border border-border p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className={`text-lg font-bold ${s.color}`}>RM {s.val.toFixed(2)}</p>
          </div>
        ))}
      </div>
      <div className="bg-card rounded-2xl border border-border p-4">
        <p className="text-xs text-muted-foreground mb-1">{lang === 'zh' ? '工作天数' : 'Working Days'}</p>
        <p className="text-2xl font-extrabold">{yearRecords.length}</p>
      </div>
    </div>
  );
}

function MonthNav({ label, onPrev, onNext }) {
  return (
    <div className="flex items-center justify-between bg-card rounded-2xl px-4 py-3 border border-border">
      <button onClick={onPrev} className="p-1"><ChevronLeft className="w-5 h-5 text-muted-foreground" /></button>
      <p className="font-bold">{label}</p>
      <button onClick={onNext} className="p-1"><ChevronRight className="w-5 h-5 text-muted-foreground" /></button>
    </div>
  );
}

function EmptyState({ lang }) {
  return <p className="text-center text-muted-foreground text-sm py-10">{lang === 'zh' ? '本月暂无记录' : 'No records this month'}</p>;
}