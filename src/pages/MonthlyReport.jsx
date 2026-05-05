import React, { useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import MonthSelector from '@/components/reports/MonthSelector';
import { TrendingUp, TrendingDown, Wallet, CalendarDays, Landmark, Banknote } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export default function MonthlyReport() {
  const { t } = useLanguage();
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const { data: allRecords = [] } = useQuery({
    queryKey: ['dailyRecords'],
    queryFn: () => base44.entities.DailyRecord.list('-date', 365),
  });

  const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
  const records = allRecords.filter(r => r.date >= monthStart && r.date <= monthEnd);

  const totalIncome = records.reduce((s, r) => s + (r.total_income || 0), 0);
  const totalExpense = records.reduce((s, r) => s + (r.total_expense || 0), 0);
  const netIncome = records.reduce((s, r) => s + (r.actual_income || 0), 0);
  const totalBank = records.reduce((s, r) => s + (r.stored_bank || 0), 0);
  const totalCash = records.reduce((s, r) => s + (r.stored_cash || 0), 0);
  const avgDaily = records.length > 0 ? netIncome / records.length : 0;

  const chartData = records
    .sort((a, b) => a.date.localeCompare(b.date))
    .map(r => ({
      day: format(new Date(r.date), 'd'),
      income: r.total_income || 0,
      expense: r.total_expense || 0,
      net: r.actual_income || 0,
    }));

  return (
    <div className="px-5 pt-14 pb-4 space-y-5">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
        <h1 className="text-xl font-bold text-foreground mb-4">{t('monthlyReport')}</h1>

        <MonthSelector currentMonth={currentMonth} onChange={setCurrentMonth} />

        {/* Stats Grid */}
        <div className="grid grid-cols-2 gap-3 mt-4">
          <StatCard icon={TrendingUp} color="text-primary bg-primary/10" label={t('totalEarnings')} value={totalIncome} />
          <StatCard icon={TrendingDown} color="text-destructive bg-destructive/10" label={t('totalExpenses')} value={totalExpense} />
          <StatCard icon={Wallet} color="text-primary bg-primary/10" label={t('netIncome')} value={netIncome} large />
          <StatCard icon={CalendarDays} color="text-accent bg-accent/10" label={t('totalDays')} value={records.length} isCount />
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

        {/* Avg Daily */}
        <div className="bg-card rounded-2xl p-4 border border-border mt-3">
          <p className="text-xs text-muted-foreground">{t('avgDaily')}</p>
          <p className="text-2xl font-extrabold text-primary">RM {avgDaily.toFixed(2)}</p>
        </div>

        {/* Chart */}
        {chartData.length > 0 && (
          <div className="bg-card rounded-2xl p-4 border border-border mt-4">
            <p className="text-sm font-semibold mb-3">{t('dailyBreakdown')}</p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} barGap={2}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="day" tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} />
                  <YAxis tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} width={40} />
                  <Tooltip
                    contentStyle={{
                      background: 'hsl(var(--card))',
                      border: '1px solid hsl(var(--border))',
                      borderRadius: '12px',
                      fontSize: '12px',
                    }}
                  />
                  <Bar dataKey="income" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name={t('income')} />
                  <Bar dataKey="expense" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} name={t('expense')} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Daily list */}
        <div className="mt-4 space-y-2">
          <p className="text-sm font-semibold">{t('dailyBreakdown')}</p>
          {records.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">{t('noRecords')}</p>
          ) : (
            records.sort((a, b) => b.date.localeCompare(a.date)).map(r => (
              <Link
                key={r.id}
                to={`/add?date=${r.date}&edit=${r.id}`}
                className="flex items-center justify-between bg-card rounded-2xl p-3 border border-border"
              >
                <div>
                  <p className="text-sm font-semibold">{format(new Date(r.date), 'EEE, MMM d')}</p>
                  <p className="text-xs text-muted-foreground">
                    +RM {(r.total_income || 0).toFixed(0)} / -RM {(r.total_expense || 0).toFixed(0)}
                  </p>
                </div>
                <span className={`text-sm font-bold ${(r.actual_income || 0) >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  RM {(r.actual_income || 0).toFixed(2)}
                </span>
              </Link>
            ))
          )}
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