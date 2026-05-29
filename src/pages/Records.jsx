import React, { useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, startOfYear, endOfYear, subMonths, addMonths } from 'date-fns';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ChevronDown } from 'lucide-react';
import { monthStr } from '@/lib/finance';
import { INCOME_FIELDS } from '@/lib/constants';

const TODAY = format(new Date(), 'yyyy-MM-dd');

const PERIOD_TABS = ['day', 'week', 'month', 'year'];
const BREAK_TABS = ['income', 'deductions', 'bills', 'claims', 'seeMay'];

const DEDUCTION_CATS = [
  { key: 'expense_petrol',      label: 'Petrol',       labelZh: '油费',   color: 'bg-red-50 text-red-500' },
  { key: 'expense_shidan',      label: '射单',          labelZh: '射单',   color: 'bg-purple-50 text-purple-600' },
  { key: 'expense_toll',        label: 'Toll',         labelZh: '过路费', color: 'bg-orange-50 text-orange-500' },
  { key: 'expense_parking',     label: 'Parking',      labelZh: '停车费', color: 'bg-indigo-50 text-indigo-500' },
  { key: 'expense_pa_insurance',label: 'PA Insurance', labelZh: 'PA保险', color: 'bg-sky-50 text-sky-600' },
  { key: 'expense_car',         label: 'Car Expenses', labelZh: '车辆费用',color: 'bg-rose-50 text-rose-600' },
];

function getDateRange(period, refDate) {
  const d = refDate || new Date();
  if (period === 'day') return { start: format(d, 'yyyy-MM-dd'), end: format(d, 'yyyy-MM-dd'), label: format(d, 'd MMM yyyy') };
  if (period === 'week') return { start: format(startOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd'), end: format(endOfWeek(d, { weekStartsOn: 1 }), 'yyyy-MM-dd'), label: `${format(startOfWeek(d, { weekStartsOn: 1 }), 'd MMM')} – ${format(endOfWeek(d, { weekStartsOn: 1 }), 'd MMM')}` };
  if (period === 'month') return { start: format(startOfMonth(d), 'yyyy-MM-dd'), end: format(endOfMonth(d), 'yyyy-MM-dd'), label: format(d, 'MMMM yyyy') };
  if (period === 'year') return { start: format(startOfYear(d), 'yyyy-MM-dd'), end: format(endOfYear(d), 'yyyy-MM-dd'), label: String(d.getFullYear()) };
  return { start: TODAY, end: TODAY, label: TODAY };
}

function navigate(period, refDate, dir) {
  const d = new Date(refDate);
  if (period === 'day') d.setDate(d.getDate() + dir);
  else if (period === 'week') d.setDate(d.getDate() + dir * 7);
  else if (period === 'month') d.setMonth(d.getMonth() + dir);
  else if (period === 'year') d.setFullYear(d.getFullYear() + dir);
  return d;
}

export default function Records() {
  const { lang } = useLanguage();
  const [period, setPeriod] = useState('month');
  const [refDate, setRefDate] = useState(new Date());
  const [breakTab, setBreakTab] = useState('income');
  const [expandedCat, setExpandedCat] = useState(null);

  const { data: dailyRecords = [] } = useQuery({
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

  const range = getDateRange(period, refDate);
  const filteredRecords = dailyRecords.filter(r => r.date >= range.start && r.date <= range.end);
  const filteredPayments = billPayments.filter(p => {
    const m = p.month || (p.due_date ? p.due_date.substring(0, 7) : '');
    return m >= range.start.substring(0, 7) && m <= range.end.substring(0, 7);
  });
  const filteredClaims = familyClaims.filter(c => c.date_paid >= range.start && c.date_paid <= range.end);

  const householdPayments = filteredPayments.filter(p => p.section === 'household' || (!p.section && !p.is_shared_family));
  const seeMayPayments = filteredPayments.filter(p => p.section === 'shared_family' || p.is_shared_family);

  const totalIncome = filteredRecords.reduce((s, r) => s + (r.total_income || 0), 0);
  const totalDeductions = filteredRecords.reduce((s, r) => s + (r.total_expense || 0), 0);
  const actualIncome = filteredRecords.reduce((s, r) => s + (r.actual_income || 0), 0);
  const totalBills = householdPayments.reduce((s, p) => s + (p.amount || 0), 0);
  const totalClaims = filteredClaims.reduce((s, c) => s + (c.amount || 0), 0);
  const totalSeeMay = seeMayPayments.reduce((s, p) => s + (p.amount || 0), 0);

  // Income breakdown by source
  const incomeCats = INCOME_FIELDS.map(f => ({
    key: f.key,
    label: f.label,
    color: f.color,
    total: filteredRecords.reduce((s, r) => s + (r[f.key] || 0), 0),
    records: filteredRecords.filter(r => (r[f.key] || 0) > 0),
  })).filter(c => c.total > 0);

  // Deduction breakdown by category
  const deductionCats = DEDUCTION_CATS.map(c => ({
    ...c,
    total: filteredRecords.reduce((s, r) => s + (r[c.key] || 0), 0),
    records: filteredRecords.filter(r => (r[c.key] || 0) > 0),
  })).filter(c => c.total > 0);

  // Bill breakdown by bill_name
  const billGroups = {};
  householdPayments.forEach(p => {
    const name = p.bill_name || 'Other';
    if (!billGroups[name]) billGroups[name] = { total: 0, records: [] };
    billGroups[name].total += p.amount || 0;
    billGroups[name].records.push(p);
  });

  // Claims breakdown by category
  const claimGroups = {};
  filteredClaims.forEach(c => {
    const cat = c.category || 'other';
    if (!claimGroups[cat]) claimGroups[cat] = { total: 0, records: [] };
    claimGroups[cat].total += c.amount || 0;
    claimGroups[cat].records.push(c);
  });

  // See May breakdown by bill_name
  const seeMayGroups = {};
  seeMayPayments.forEach(p => {
    const name = p.bill_name || 'Other';
    if (!seeMayGroups[name]) seeMayGroups[name] = { total: 0, records: [] };
    seeMayGroups[name].total += p.amount || 0;
    seeMayGroups[name].records.push(p);
  });

  const PERIOD_LABELS = { day: lang === 'zh' ? '日' : 'Day', week: lang === 'zh' ? '周' : 'Week', month: lang === 'zh' ? '月' : 'Month', year: lang === 'zh' ? '年' : 'Year' };
  const BREAK_LABELS = {
    income: lang === 'zh' ? '收入' : 'Income',
    deductions: lang === 'zh' ? '扣除' : 'Deductions',
    bills: lang === 'zh' ? '账单' : 'Bills',
    claims: lang === 'zh' ? '报销' : 'Claims',
    seeMay: 'See May',
  };

  return (
    <div className="px-4 pt-14 pb-24 space-y-4 max-w-lg mx-auto">
      <h1 className="text-xl font-extrabold">{lang === 'zh' ? '记录' : 'Records'}</h1>

      {/* Period Tabs */}
      <div className="flex bg-secondary rounded-2xl p-1 gap-1">
        {PERIOD_TABS.map(p => (
          <button key={p} onClick={() => { setPeriod(p); setRefDate(new Date()); setExpandedCat(null); }}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${period === p ? 'bg-card shadow text-foreground' : 'text-muted-foreground'}`}>
            {PERIOD_LABELS[p]}
          </button>
        ))}
      </div>

      {/* Date Navigator */}
      <div className="flex items-center justify-between bg-card rounded-2xl px-4 py-3 border border-border">
        <button onClick={() => setRefDate(d => navigate(period, d, -1))} className="p-1">
          <ChevronLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <p className="font-bold text-sm">{range.label}</p>
        <button onClick={() => setRefDate(d => navigate(period, d, 1))} className="p-1">
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: lang === 'zh' ? '总收入' : 'Gross', val: totalIncome, color: 'text-primary' },
          { label: lang === 'zh' ? '扣除' : 'Deductions', val: totalDeductions, color: 'text-destructive' },
          { label: lang === 'zh' ? '实际' : 'Actual', val: actualIncome, color: 'text-foreground' },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-2xl border border-border p-3 text-center">
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
            <p className={`text-sm font-extrabold ${s.color}`}>RM {s.val.toFixed(0)}</p>
          </div>
        ))}
      </div>

      {/* Breakdown Tabs */}
      <div className="flex bg-secondary rounded-xl p-0.5 gap-0.5 overflow-x-auto">
        {BREAK_TABS.map(t => (
          <button key={t} onClick={() => { setBreakTab(t); setExpandedCat(null); }}
            className={`flex-1 py-1.5 text-[11px] font-semibold rounded-lg transition-all whitespace-nowrap px-1 ${breakTab === t ? 'bg-card shadow text-foreground' : 'text-muted-foreground'}`}>
            {BREAK_LABELS[t]}
          </button>
        ))}
      </div>

      {/* Income Tab */}
      {breakTab === 'income' && (
        <BreakdownList
          items={incomeCats}
          total={totalIncome}
          lang={lang}
          expandedCat={expandedCat}
          setExpandedCat={setExpandedCat}
          renderDetail={(item) => item.records.map(r => (
            <Link key={r.id} to={`/today?date=${r.date}&edit=${r.id}`}>
              <div className="flex justify-between items-center py-2 border-b border-border last:border-0">
                <span className="text-xs text-muted-foreground">{format(new Date(r.date + 'T00:00:00'), 'EEE, d MMM')}</span>
                <span className="text-xs font-bold text-primary">RM {(r[item.key] || 0).toFixed(2)}</span>
              </div>
            </Link>
          ))}
          emptyMsg={lang === 'zh' ? '此期间无收入记录' : 'No income records in this period'}
        />
      )}

      {/* Deductions Tab */}
      {breakTab === 'deductions' && (
        <BreakdownList
          items={deductionCats}
          total={totalDeductions}
          lang={lang}
          expandedCat={expandedCat}
          setExpandedCat={setExpandedCat}
          renderDetail={(item) => item.records.map(r => (
            <Link key={r.id} to={`/today?date=${r.date}&edit=${r.id}`}>
              <div className="flex justify-between items-center py-2 border-b border-border last:border-0">
                <span className="text-xs text-muted-foreground">{format(new Date(r.date + 'T00:00:00'), 'EEE, d MMM')}</span>
                <span className="text-xs font-bold text-destructive">- RM {(r[item.key] || 0).toFixed(2)}</span>
              </div>
            </Link>
          ))}
          emptyMsg={lang === 'zh' ? '此期间无扣除记录' : 'No deduction records in this period'}
        />
      )}

      {/* Bills Tab */}
      {breakTab === 'bills' && (
        <div className="space-y-2">
          <div className="flex justify-between items-center px-1">
            <p className="text-xs text-muted-foreground">{Object.keys(billGroups).length} {lang === 'zh' ? '类' : 'categories'}</p>
            <p className="text-sm font-bold text-primary">RM {totalBills.toFixed(2)}</p>
          </div>
          {Object.keys(billGroups).length === 0 && <EmptyCard msg={lang === 'zh' ? '此期间无账单' : 'No bills in this period'} />}
          {Object.entries(billGroups).map(([name, group]) => (
            <GroupRow key={name} label={name} total={group.total} grandTotal={totalBills}
              expanded={expandedCat === name} onToggle={() => setExpandedCat(expandedCat === name ? null : name)}
              color="bg-blue-50 text-blue-600">
              {group.records.map(p => (
                <div key={p.id} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                  <div>
                    <span className="text-xs text-muted-foreground">{p.month}</span>
                    {p.status && <span className={`ml-2 text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${p.status === 'paid' || p.status === 'settled' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>{p.status}</span>}
                  </div>
                  <span className="text-xs font-bold">RM {(p.amount || 0).toFixed(2)}</span>
                </div>
              ))}
            </GroupRow>
          ))}
        </div>
      )}

      {/* Claims Tab */}
      {breakTab === 'claims' && (
        <div className="space-y-2">
          <div className="flex justify-between items-center px-1">
            <p className="text-xs text-muted-foreground">{filteredClaims.length} {lang === 'zh' ? '笔' : 'records'}</p>
            <p className="text-sm font-bold text-primary">RM {totalClaims.toFixed(2)}</p>
          </div>
          {filteredClaims.length === 0 && <EmptyCard msg={lang === 'zh' ? '此期间无报销记录' : 'No claims in this period'} />}
          {Object.entries(claimGroups).map(([cat, group]) => (
            <GroupRow key={cat} label={cat} total={group.total} grandTotal={totalClaims}
              expanded={expandedCat === cat} onToggle={() => setExpandedCat(expandedCat === cat ? null : cat)}
              color="bg-indigo-50 text-indigo-600">
              {group.records.map(c => (
                <div key={c.id} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                  <div>
                    <p className="text-xs font-semibold">{c.title}</p>
                    <p className="text-[10px] text-muted-foreground">{c.date_paid} · {c.claim_by}</p>
                  </div>
                  <span className="text-xs font-bold">RM {(c.amount || 0).toFixed(2)}</span>
                </div>
              ))}
            </GroupRow>
          ))}
        </div>
      )}

      {/* See May Tab */}
      {breakTab === 'seeMay' && (
        <div className="space-y-2">
          <div className="flex justify-between items-center px-1">
            <p className="text-xs text-muted-foreground">{seeMayPayments.length} {lang === 'zh' ? '笔' : 'records'}</p>
            <p className="text-sm font-bold text-purple-600">RM {totalSeeMay.toFixed(2)}</p>
          </div>
          {Object.keys(seeMayGroups).length === 0 && <EmptyCard msg={lang === 'zh' ? '此期间无 See May 记录' : 'No See May records in this period'} />}
          {Object.entries(seeMayGroups).map(([name, group]) => (
            <GroupRow key={name} label={name} total={group.total} grandTotal={totalSeeMay}
              expanded={expandedCat === name} onToggle={() => setExpandedCat(expandedCat === name ? null : name)}
              color="bg-purple-50 text-purple-600">
              {group.records.map(p => (
                <div key={p.id} className="flex justify-between items-center py-2 border-b border-border last:border-0">
                  <span className="text-xs text-muted-foreground">{p.month}</span>
                  <span className="text-xs font-bold text-purple-600">RM {(p.amount || 0).toFixed(2)}</span>
                </div>
              ))}
            </GroupRow>
          ))}
        </div>
      )}

      {/* Daily Records list (always shown below when on income/deduction tab) */}
      {(breakTab === 'income' || breakTab === 'deductions') && filteredRecords.length > 0 && !expandedCat && (
        <div>
          <p className="text-sm font-bold mb-2">{lang === 'zh' ? '每日记录' : 'Daily Records'}</p>
          <div className="space-y-2">
            {filteredRecords.sort((a,b) => b.date.localeCompare(a.date)).map(r => (
              <Link key={r.id} to={`/today?date=${r.date}&edit=${r.id}`}>
                <div className="flex items-center justify-between bg-card rounded-2xl border border-border px-4 py-3 hover:border-primary/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-primary/10 flex flex-col items-center justify-center shrink-0">
                      <span className="text-sm font-extrabold text-primary">{format(new Date(r.date + 'T00:00:00'), 'd')}</span>
                      <span className="text-[9px] text-primary/70">{format(new Date(r.date + 'T00:00:00'), 'EEE')}</span>
                    </div>
                    <div>
                      <p className="text-xs font-semibold">{format(new Date(r.date + 'T00:00:00'), 'd MMM yyyy')}</p>
                      <p className="text-[10px] text-muted-foreground">+RM{(r.total_income||0).toFixed(0)} − RM{(r.total_expense||0).toFixed(0)}</p>
                    </div>
                  </div>
                  <p className="text-sm font-extrabold text-primary">RM {(r.actual_income||0).toFixed(2)}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function BreakdownList({ items, total, lang, expandedCat, setExpandedCat, renderDetail, emptyMsg }) {
  return (
    <div className="space-y-2">
      <div className="flex justify-between items-center px-1">
        <p className="text-xs text-muted-foreground">{items.length} {lang === 'zh' ? '类' : 'categories'}</p>
        <p className="text-sm font-bold text-primary">RM {total.toFixed(2)}</p>
      </div>
      {items.length === 0 && <EmptyCard msg={emptyMsg} />}
      {items.map(item => (
        <GroupRow key={item.key} label={lang === 'zh' && item.labelZh ? item.labelZh : item.label}
          total={item.total} grandTotal={total} color={item.color}
          expanded={expandedCat === item.key}
          onToggle={() => setExpandedCat(expandedCat === item.key ? null : item.key)}>
          {renderDetail(item)}
        </GroupRow>
      ))}
    </div>
  );
}

function GroupRow({ label, total, grandTotal, color, expanded, onToggle, children }) {
  const pct = grandTotal > 0 ? (total / grandTotal) * 100 : 0;
  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <button className="w-full px-4 py-3 flex items-center gap-3" onClick={onToggle}>
        <span className={`text-xs font-bold px-2 py-1 rounded-lg min-w-[90px] text-left ${color}`}>{label}</span>
        <div className="flex-1">
          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-primary/60 rounded-full" style={{ width: `${pct}%` }} />
          </div>
        </div>
        <span className="text-xs font-bold w-20 text-right">RM {total.toFixed(2)}</span>
        <span className="text-[10px] text-muted-foreground w-8 text-right">{pct.toFixed(0)}%</span>
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
      </button>
      {expanded && (
        <div className="px-4 pb-3 border-t border-border">
          {children}
        </div>
      )}
    </div>
  );
}

function EmptyCard({ msg }) {
  return (
    <div className="text-center py-10">
      <p className="text-sm text-muted-foreground">{msg}</p>
    </div>
  );
}