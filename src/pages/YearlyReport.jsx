import React, { useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, TrendingUp, TrendingDown, Wallet, CalendarDays, Landmark, Banknote } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';

export default function YearlyReport() {
  const { t } = useLanguage();
  const [year, setYear] = useState(new Date().getFullYear());

  const { data: allRecords = [] } = useQuery({
    queryKey: ['dailyRecords'],
    queryFn: () => base44.entities.DailyRecord.list('-date', 365),
  });

  const yearRecords = allRecords.filter(r => r.date && r.date.startsWith(year.toString()));

  const totalIncome = yearRecords.reduce((s, r) => s + (r.total_income || 0), 0);
  const totalExpense = yearRecords.reduce((s, r) => s + (r.total_expense || 0), 0);
  const netIncome = yearRecords.reduce((s, r) => s + (r.actual_income || 0), 0);
  const totalBank = yearRecords.reduce((s, r) => s + (r.stored_bank || 0), 0);
  const totalCash = yearRecords.reduce((s, r) => s + (r.stored_cash || 0), 0);
  const avgDaily = yearRecords.length > 0 ? netIncome / yearRecords.length : 0;

  const monthKeys = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

  const monthlyData = monthKeys.map((key, i) => {
    const monthStr = `${year}-${String(i + 1).padStart(2, '0')}`;
    const monthRecords = yearRecords.filter(r => r.date.startsWith(monthStr));
    return {
      month: t(key),
      income: monthRecords.reduce((s, r) => s + (r.total_income || 0), 0),
      expense: monthRecords.reduce((s, r) => s + (r.total_expense || 0), 0),
      net: monthRecords.reduce((s, r) => s + (r.actual_income || 0), 0),
      days: monthRecords.length,
    };
  });

  return (
    <div className="px-5 pt-14 pb-4 space-y-5">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-xl font-bold text-foreground mb-4">{t('yearlyReport')}</h1>

        {/* Year Selector */}
        <div className="flex items-center justify-between bg-card rounded-2xl px-4 py-3 border border-border">
          <button
            onClick={() => setYear(y => y - 1)}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-secondary transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-muted-foreground" />
          </button>
          <p className="text-lg font-bold text-foreground">{year}</p>
          <button
            onClick={() => setYear(y => y + 1)}
            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-secondary transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <StatCard icon={TrendingUp} color="text-primary bg-primary/10" label={t('totalEarnings')} value={totalIncome} />
          <StatCard icon={TrendingDown} color="text-destructive bg-destructive/10" label={t('totalExpenses')} value={totalExpense} />
          <StatCard icon={Wallet} color="text-primary bg-primary/10" label={t('netIncome')} value={netIncome} large />
          <StatCard icon={CalendarDays} color="text-accent bg-accent/10" label={t('totalDays')} value={yearRecords.length} isCount />
        </div>

        <div className="grid grid-cols-2 gap-3 mt-3">
          <div className="bg-card rounded-2xl p-4 border border-border">
            <div className="flex items-center gap-2 mb-1">
              <Landmark className="w-4 h-4 text-blue-500" />
              <span className="text-xs text-muted-foreground">{t('inBank')}</span>
            </div>
            <p className="text-lg font-bold">RM {totalBank.toFixed(2)}</p>
          </div>
          <div className="bg-card rounded-2xl p-4 border border-border">
            <div className="flex items-center gap-2 mb-1">
              <Banknote className="w-4 h-4 text-amber-500" />
              <span className="text-xs text-muted-foreground">{t('inCash')}</span>
            </div>
            <p className="text-lg font-bold">RM {totalCash.toFixed(2)}</p>
          </div>
        </div>

        <div className="bg-card rounded-2xl p-4 border border-border mt-3">
          <p className="text-xs text-muted-foreground">{t('avgDaily')}</p>
          <p className="text-2xl font-extrabold text-primary">RM {avgDaily.toFixed(2)}</p>
        </div>

        {/* Monthly Chart */}
        <div className="bg-card rounded-2xl p-4 border border-border mt-4">
          <p className="text-sm font-semibold mb-3">{t('monthlyReport')}</p>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={monthlyData} barGap={1}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 9, fill: 'hsl(var(--muted-foreground))' }} width={45} />
                <Tooltip
                  contentStyle={{
                    background: 'hsl(var(--card))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '12px',
                    fontSize: '11px',
                  }}
                />
                <Bar dataKey="income" fill="hsl(var(--primary))" radius={[3, 3, 0, 0]} name={t('income')} />
                <Bar dataKey="expense" fill="hsl(var(--destructive))" radius={[3, 3, 0, 0]} name={t('expense')} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Monthly breakdown list */}
        <div className="mt-4 space-y-2">
          <p className="text-sm font-semibold">{t('monthlyReport')}</p>
          {monthlyData.filter(m => m.days > 0).reverse().map((m, i) => (
            <div key={i} className="flex items-center justify-between bg-card rounded-2xl p-3 border border-border">
              <div>
                <p className="text-sm font-semibold">{m.month}</p>
                <p className="text-xs text-muted-foreground">{m.days} {t('totalDays').toLowerCase()}</p>
              </div>
              <div className="text-right">
                <p className={`text-sm font-bold ${m.net >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  RM {m.net.toFixed(2)}
                </p>
                <p className="text-xs text-muted-foreground">
                  +{m.income.toFixed(0)} / -{m.expense.toFixed(0)}
                </p>
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}

function StatCard({ icon: Icon, color, label, value, large, isCount }) {
  return (
    <div className="bg-card rounded-2xl p-4 border border-border">
      <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center mb-2`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-bold ${large ? 'text-xl text-primary' : 'text-lg'}`}>
        {isCount ? value : `RM ${value.toFixed(2)}`}
      </p>
    </div>
  );
}