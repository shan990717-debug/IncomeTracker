import React, { useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Settings, Pencil } from 'lucide-react';
import { calcMonthlyTotals, monthStr, formatDate } from '@/lib/finance';
import { INCOME_FIELDS } from '@/lib/constants';

const EXPENSE_KEYS = [
  { key: 'expense_petrol',       label: 'Petrol',       labelZh: '油费' },
  { key: 'expense_shidan',       label: '射单',          labelZh: '射单' },
  { key: 'expense_toll',         label: 'Toll',         labelZh: '过路费' },
  { key: 'expense_parking',      label: 'Parking',      labelZh: '停车费' },
  { key: 'expense_pa_insurance', label: 'PA Insurance', labelZh: 'PA保险' },
  { key: 'expense_car',          label: 'Car Expenses', labelZh: '车辆费用' },
];

function buildLedgerEntries(records, billPayments, familyClaims) {
  const entries = [];

  // Daily records — income lines
  records.forEach(r => {
    INCOME_FIELDS.forEach(f => {
      const amt = r[f.key] || 0;
      if (amt > 0) {
        entries.push({
          id: `${r.id}-${f.key}`,
          date: r.date,
          label: f.label,
          amount: amt,
          type: 'income',
          recordId: r.id,
          color: f.color,
        });
      }
    });
    // Expense lines
    EXPENSE_KEYS.forEach(e => {
      const amt = r[e.key] || 0;
      if (amt > 0) {
        entries.push({
          id: `${r.id}-${e.key}`,
          date: r.date,
          label: e.label,
          labelZh: e.labelZh,
          amount: -amt,
          type: 'expense',
          recordId: r.id,
        });
      }
    });
  });

  // Bill payments
  billPayments.forEach(p => {
    const dateStr = p.payment_date || (p.month ? p.month + '-01' : null);
    if (!dateStr) return;
    entries.push({
      id: `bill-${p.id}`,
      date: dateStr.substring(0, 10),
      label: p.bill_name || 'Bill',
      amount: -(p.amount || 0),
      type: 'bill',
      note: p.remark || '',
    });
  });

  // Family claims
  familyClaims.forEach(c => {
    if (!c.date_paid) return;
    entries.push({
      id: `claim-${c.id}`,
      date: c.date_paid,
      label: c.title || 'Claim',
      amount: -(c.amount || 0),
      type: 'claim',
      note: c.notes || '',
    });
  });

  return entries.sort((a, b) => b.date.localeCompare(a.date));
}

export default function Dashboard() {
  const { lang } = useLanguage();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const mStr = monthStr(currentMonth);

  const { data: records = [] } = useQuery({
    queryKey: ['dailyRecords'],
    queryFn: () => base44.entities.DailyRecord.list('-date', 400),
  });
  const { data: billPayments = [] } = useQuery({
    queryKey: ['billPayments', 'all'],
    queryFn: () => base44.entities.BillPayment.list('-created_date', 400),
  });
  const { data: familyClaims = [] } = useQuery({
    queryKey: ['familyClaims'],
    queryFn: () => base44.entities.FamilyClaim.list('-date_paid', 200),
  });

  const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');

  const monthRecords = records.filter(r => r.date >= monthStart && r.date <= monthEnd);
  const monthBills = billPayments.filter(p => (p.month || '').startsWith(mStr));
  const monthClaims = familyClaims.filter(c => c.date_paid >= monthStart && c.date_paid <= monthEnd);

  const totals = calcMonthlyTotals(monthRecords);
  const totalBills = monthBills.reduce((s, p) => s + (p.amount || 0), 0);
  const totalClaims = monthClaims.reduce((s, c) => s + (c.amount || 0), 0);

  const ledger = buildLedgerEntries(monthRecords, monthBills, monthClaims);

  // Group by date
  const grouped = {};
  ledger.forEach(e => {
    if (!grouped[e.date]) grouped[e.date] = [];
    grouped[e.date].push(e);
  });
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const TYPE_CONFIG = {
    income:  { label: 'Income',  labelZh: '收入', badge: 'bg-primary/10 text-primary',    sign: '+' },
    expense: { label: 'Expense', labelZh: '扣除', badge: 'bg-red-50 text-red-500',        sign: '-' },
    bill:    { label: 'Bill',    labelZh: '账单', badge: 'bg-blue-50 text-blue-600',      sign: '-' },
    claim:   { label: 'Claim',   labelZh: '报销', badge: 'bg-indigo-50 text-indigo-600',  sign: '-' },
  };

  return (
    <div className="px-4 pt-12 pb-28 space-y-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-extrabold">{lang === 'zh' ? '记账本' : 'Ledger'}</h1>
        <Link to="/settings" className="p-2 rounded-xl hover:bg-secondary transition-colors">
          <Settings className="w-4 h-4 text-muted-foreground" />
        </Link>
      </div>

      {/* Month Selector */}
      <div className="flex items-center justify-between bg-card rounded-2xl px-4 py-3 border border-border">
        <button onClick={() => setCurrentMonth(m => subMonths(m, 1))} className="p-1">
          <ChevronLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <p className="font-bold">{format(currentMonth, 'MMMM yyyy')}</p>
        <button onClick={() => setCurrentMonth(m => addMonths(m, 1))} className="p-1">
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-primary/10 border border-primary/20 rounded-2xl p-4">
          <p className="text-xs text-primary/70 font-medium">{lang === 'zh' ? '本月总收入' : 'Total Income'}</p>
          <p className="text-xl font-extrabold text-primary">RM {totals.grossIncome.toFixed(2)}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{lang === 'zh' ? '实际净收入' : 'Net actual'}: RM {totals.actualIncome.toFixed(2)}</p>
        </div>
        <div className="bg-red-50 border border-red-100 rounded-2xl p-4">
          <p className="text-xs text-red-400 font-medium">{lang === 'zh' ? '本月总支出' : 'Total Expenses'}</p>
          <p className="text-xl font-extrabold text-red-500">RM {(totals.totalExpense + totalBills + totalClaims).toFixed(2)}</p>
          <div className="text-[10px] text-muted-foreground mt-0.5 space-y-0.5">
            <p>{lang === 'zh' ? '运营扣除' : 'Ops'}: RM {totals.totalExpense.toFixed(0)}
              {' · '}{lang === 'zh' ? '账单' : 'Bills'}: RM {totalBills.toFixed(0)}</p>
          </div>
        </div>
      </div>

      {/* Ledger List */}
      <div className="space-y-4">
        {sortedDates.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-sm">{lang === 'zh' ? '本月暂无记录' : 'No records this month'}</p>
            <Link to="/today" className="mt-3 inline-block text-xs font-semibold text-primary underline">
              {lang === 'zh' ? '添加今日记录' : 'Add today\'s record'}
            </Link>
          </div>
        )}

        {sortedDates.map(date => {
          const dayEntries = grouped[date];
          const dayIncome = dayEntries.filter(e => e.amount > 0).reduce((s, e) => s + e.amount, 0);
          const dayOut = dayEntries.filter(e => e.amount < 0).reduce((s, e) => s + Math.abs(e.amount), 0);

          return (
            <div key={date}>
              {/* Date Header */}
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-extrabold">{formatDate(date)}</span>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(date + 'T00:00:00'), 'EEE')}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs font-semibold">
                  {dayIncome > 0 && <span className="text-primary">+RM {dayIncome.toFixed(2)}</span>}
                  {dayOut > 0 && <span className="text-red-500">−RM {dayOut.toFixed(2)}</span>}
                  {/* Edit link for daily records */}
                  {dayEntries.find(e => e.recordId) && (
                    <Link to={`/today?date=${date}&edit=${dayEntries.find(e => e.recordId)?.recordId}`}
                      className="p-1 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors">
                      <Pencil className="w-3.5 h-3.5" />
                    </Link>
                  )}
                </div>
              </div>

              {/* Entries */}
              <div className="bg-card rounded-2xl border border-border overflow-hidden divide-y divide-border">
                {dayEntries.map(entry => {
                  const tc = TYPE_CONFIG[entry.type];
                  const isPositive = entry.amount > 0;
                  return (
                    <div key={entry.id} className="flex items-center gap-3 px-4 py-3">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-lg min-w-[52px] text-center ${entry.color || tc.badge}`}>
                        {lang === 'zh' ? tc.labelZh : tc.label}
                      </span>
                      <span className="flex-1 text-sm font-medium truncate">
                        {lang === 'zh' && entry.labelZh ? entry.labelZh : entry.label}
                      </span>
                      {entry.note && (
                        <span className="text-[10px] text-muted-foreground italic max-w-[60px] truncate">{entry.note}</span>
                      )}
                      <span className={`text-sm font-extrabold tabular-nums ${isPositive ? 'text-primary' : 'text-red-500'}`}>
                        {isPositive ? '+' : '−'}RM {Math.abs(entry.amount).toFixed(2)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}