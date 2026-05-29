import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/lib/i18n';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Lock, Unlock, Pencil, Plus, Target, TrendingDown } from 'lucide-react';
import { calcMonthlyTotals, calcHealthStatus, monthStr } from '@/lib/finance';
import { HEALTH_STATUS, DEFAULT_PERSONAL_SPENDING_PCT, PA_INSURANCE_MONTHLY, GOAL_CATEGORIES } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import ProgressBar from '@/components/ui/ProgressBar';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

function AmtInput({ value, onChange, disabled }) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="number" inputMode="decimal" step="0.01" placeholder="0.00"
        value={value || ''} onChange={e => onChange(e.target.value)}
        disabled={disabled}
        className="w-24 text-right text-sm font-bold bg-secondary rounded-lg px-2 py-1.5 border-0 focus:outline-none focus:ring-1 focus:ring-primary disabled:opacity-60"
      />
      <span className="text-xs text-muted-foreground">RM</span>
    </div>
  );
}

function FlowRow({ label, sublabel, value, color = 'text-foreground', bg, minus, plus, children }) {
  return (
    <div className={`flex items-center justify-between px-4 py-3 rounded-xl ${bg || ''}`}>
      <div>
        <p className={`text-sm font-semibold ${color}`}>{label}</p>
        {sublabel && <p className="text-[10px] text-muted-foreground mt-0.5">{sublabel}</p>}
        {children}
      </div>
      <span className={`text-base font-extrabold ${color}`}>
        {minus ? '− ' : plus ? '+ ' : ''}{typeof value === 'number' ? `RM ${value.toFixed(2)}` : value}
      </span>
    </div>
  );
}

function Divider() {
  return <div className="border-t border-border mx-2" />;
}

export default function Planning() {
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('flow');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const mStr = monthStr(currentMonth);
  const prevMStr = monthStr(subMonths(currentMonth, 1));

  // Editable fields
  const [personalPct, setPersonalPct] = useState(DEFAULT_PERSONAL_SPENDING_PCT);
  const [editingPct, setEditingPct] = useState(false);
  const [pctInput, setPctInput] = useState(String(DEFAULT_PERSONAL_SPENDING_PCT));
  const [familyEssential, setFamilyEssential] = useState('');
  const [familyClaims, setFamilyClaims] = useState('');
  const [goalSavings, setGoalSavings] = useState('');
  const [otherSpending, setOtherSpending] = useState('');
  const [bankOut, setBankOut] = useState('');
  const [cashOut, setCashOut] = useState('');
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
  const { data: goals = [] } = useQuery({
    queryKey: ['goals'],
    queryFn: () => base44.entities.Goal.list('sort_order', 50),
  });

  const monthStart = format(startOfMonth(currentMonth), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(currentMonth), 'yyyy-MM-dd');
  const monthRecords = allRecords.filter(r => r.date >= monthStart && r.date <= monthEnd);
  const totals = calcMonthlyTotals(monthRecords);

  // Get previous month carry-forward
  const prevSettlement = settlements.find(s => s.month === prevMStr);
  const carryForwardIn = prevSettlement?.carry_forward_out ?? 0;

  useEffect(() => {
    const existing = settlements.find(s => s.month === mStr);
    if (existing) {
      setSettlement(existing);
      const pct = existing.personal_spending_pct ?? DEFAULT_PERSONAL_SPENDING_PCT;
      setPersonalPct(pct);
      setPctInput(String(pct));
      setFamilyEssential(String(existing.family_essential || ''));
      setFamilyClaims(String(existing.family_claims || ''));
      setGoalSavings(String(existing.goal_savings || ''));
      setOtherSpending(String(existing.other_spending || ''));
      setBankOut(String(existing.bank_out || ''));
      setCashOut(String(existing.cash_out || ''));
    } else {
      setSettlement(null);
      setPersonalPct(DEFAULT_PERSONAL_SPENDING_PCT);
      setPctInput(String(DEFAULT_PERSONAL_SPENDING_PCT));
      setFamilyEssential('');
      setFamilyClaims('');
      setGoalSavings('');
      setOtherSpending('');
      setBankOut('');
      setCashOut('');
    }
  }, [mStr, settlements.length]);

  const personalSpending = +(totals.actualIncome * personalPct / 100).toFixed(2);
  const fe = parseFloat(familyEssential) || 0;
  const fc = parseFloat(familyClaims) || 0;
  const gs = parseFloat(goalSavings) || 0;
  const os = parseFloat(otherSpending) || 0;
  const bo = parseFloat(bankOut) || 0;
  const co = parseFloat(cashOut) || 0;

  // Remaining cash flow = carry-forward + income - all outflows
  const totalOutflows = personalSpending + fe + fc + gs + os;
  const remainingCashFlow = +(carryForwardIn + totals.actualIncome - totalOutflows).toFixed(2);

  // Bank/Cash balance
  const bankBalance = +(totals.bankTotal - bo).toFixed(2);
  const cashBalance = +(totals.cashTotal - co).toFixed(2);

  // Available extra = remaining cash flow (this IS the carry-forward to next month)
  const carryForwardOut = remainingCashFlow;

  const isFinalized = settlement?.status === 'finalized';
  const healthKey = calcHealthStatus(totals.actualIncome);
  const hs = HEALTH_STATUS[healthKey] || HEALTH_STATUS.danger;

  const applyPct = () => {
    const v = parseFloat(pctInput);
    if (!isNaN(v) && v >= 0 && v <= 100) setPersonalPct(v);
    setEditingPct(false);
  };

  const handleSave = async (finalize = false) => {
    setSaving(true);
    const record = {
      month: mStr,
      gross_income: totals.grossIncome,
      total_operating_expense: totals.totalExpense,
      actual_income: totals.actualIncome,
      bank_total: totals.bankTotal,
      cash_total: totals.cashTotal,
      bank_out: bo,
      cash_out: co,
      carry_forward_in: carryForwardIn,
      carry_forward_out: carryForwardOut,
      working_days: monthRecords.length,
      personal_spending_pct: personalPct,
      personal_spending: personalSpending,
      family_essential: fe,
      family_claims: fc,
      goal_savings: gs,
      other_spending: os,
      cashflow_buffer: remainingCashFlow,
      health_status: healthKey,
      status: finalize ? 'finalized' : 'draft',
    };
    if (settlement?.id) {
      await base44.entities.MonthlySettlement.update(settlement.id, record);
    } else {
      const created = await base44.entities.MonthlySettlement.create(record);
      setSettlement(created);
    }
    queryClient.invalidateQueries({ queryKey: ['settlements'] });
    setSaving(false);
    toast.success(finalize ? (lang === 'zh' ? '已结算' : 'Finalized') : (lang === 'zh' ? '已保存' : 'Saved'));
  };

  const handleUnlock = async () => {
    if (!settlement?.id) return;
    await base44.entities.MonthlySettlement.update(settlement.id, { status: 'draft' });
    queryClient.invalidateQueries({ queryKey: ['settlements'] });
    toast.success(lang === 'zh' ? '已解锁' : 'Unlocked');
  };

  const activeGoals = goals.filter(g => g.is_active !== false);
  const L = (en, zh) => lang === 'zh' ? zh : en;

  return (
    <div className="px-4 pt-14 pb-28 space-y-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">{L('Planning', '规划')}</h1>
        {isFinalized && (
          <span className="text-xs bg-primary/10 text-primary font-semibold px-2 py-1 rounded-lg flex items-center gap-1">
            <Lock className="w-3 h-3" />{L('Finalized', '已结算')}
          </span>
        )}
      </div>

      {/* Tabs */}
      <div className="flex bg-secondary rounded-2xl p-1 gap-1">
        {[
          { key: 'flow',  label: L('Money Flow', '资金流向') },
          { key: 'bank',  label: L('Bank / Cash', '银行/现金') },
          { key: 'goals', label: L('Goals', '目标') },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${tab === t.key ? 'bg-card shadow text-foreground' : 'text-muted-foreground'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Month Nav */}
      <div className="flex items-center justify-between bg-card rounded-2xl px-4 py-3 border border-border">
        <button onClick={() => setCurrentMonth(m => subMonths(m, 1))} className="p-1"><ChevronLeft className="w-5 h-5 text-muted-foreground" /></button>
        <p className="font-bold">{format(currentMonth, 'MMMM yyyy')}</p>
        <button onClick={() => setCurrentMonth(m => addMonths(m, 1))} className="p-1"><ChevronRight className="w-5 h-5 text-muted-foreground" /></button>
      </div>

      {/* ── MONEY FLOW TAB ── */}
      {tab === 'flow' && (
        <div className="space-y-4">

          {/* Step 1: Income */}
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="bg-primary px-4 py-2.5">
              <p className="text-xs font-bold text-primary-foreground opacity-90">{L('Step 1 — Monthly Income', '第一步 — 月度收入')}</p>
            </div>
            <div className="space-y-0">
              <FlowRow
                label={L('Monthly Actual Income', '月度实际收入')}
                sublabel={`${monthRecords.length} ${L('working days', '个工作天')} · ${L('Gross', '总收入')} RM${totals.grossIncome.toFixed(0)} − ${L('Ops', '运营')} RM${totals.totalExpense.toFixed(0)}`}
                value={totals.actualIncome}
                color="text-primary"
              />
              {carryForwardIn > 0 && (
                <>
                  <Divider />
                  <FlowRow
                    label={L('Carry Forward (prev month)', '上月结余')}
                    sublabel={prevMStr}
                    value={carryForwardIn}
                    plus
                    color="text-teal-600"
                  />
                </>
              )}
              <Divider />
              <div className="flex items-center justify-between px-4 py-3 bg-primary/5">
                <p className="text-sm font-bold">{L('Total Available', '可用合计')}</p>
                <p className="text-lg font-extrabold text-primary">RM {(totals.actualIncome + carryForwardIn).toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Step 2: Deductions */}
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="bg-orange-500 px-4 py-2.5">
              <p className="text-xs font-bold text-white opacity-90">{L('Step 2 — Monthly Outflows', '第二步 — 月度支出')}</p>
            </div>
            <div className="space-y-0 divide-y divide-border">

              {/* Personal Spending */}
              <div className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-orange-600">
                    {L('Personal Spending', '个人消费')}
                    <span className="ml-1 text-xs text-orange-400">({personalPct}%)</span>
                  </p>
                  {!isFinalized && (
                    <div className="flex items-center gap-1 mt-1">
                      {editingPct ? (
                        <>
                          <input type="number" inputMode="decimal" min="0" max="100" value={pctInput}
                            onChange={e => setPctInput(e.target.value)}
                            className="w-14 text-sm font-bold bg-secondary border border-orange-300 rounded-lg px-2 py-1 focus:outline-none" />
                          <span className="text-xs">%</span>
                          <button onClick={applyPct} className="text-xs font-bold px-2 py-0.5 bg-orange-500 text-white rounded-lg">✓</button>
                          {[30, 35, 40].map(p => (
                            <button key={p} onClick={() => { setPctInput(String(p)); setPersonalPct(p); setEditingPct(false); }}
                              className={`text-xs px-1.5 py-0.5 rounded-lg border font-semibold ${personalPct === p ? 'bg-orange-100 border-orange-400 text-orange-800' : 'border-border text-muted-foreground'}`}>{p}%</button>
                          ))}
                        </>
                      ) : (
                        <button onClick={() => setEditingPct(true)} className="flex items-center gap-0.5 text-[10px] text-orange-500 font-semibold border border-orange-300 px-1.5 py-0.5 rounded-lg hover:bg-orange-50">
                          <Pencil className="w-2.5 h-2.5" />{L('Edit %', '修改%')}
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <span className="text-base font-extrabold text-orange-600">− RM {personalSpending.toFixed(2)}</span>
              </div>

              {/* Family Essential */}
              <div className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-blue-600">{L('Family Essential', '家庭必需')}</p>
                  <p className="text-[10px] text-muted-foreground">{L('Bills + household', '账单+家庭开销')}</p>
                </div>
                {isFinalized ? <span className="text-sm font-bold">− RM {fe.toFixed(2)}</span>
                  : <AmtInput value={familyEssential} onChange={setFamilyEssential} />}
              </div>

              {/* Family Claims */}
              <div className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-indigo-600">{L('Family Claims', '家庭报销')}</p>
                  <p className="text-[10px] text-muted-foreground">{L('Reimbursements paid out', '已支付报销')}</p>
                </div>
                {isFinalized ? <span className="text-sm font-bold">− RM {fc.toFixed(2)}</span>
                  : <AmtInput value={familyClaims} onChange={setFamilyClaims} />}
              </div>

              {/* Goal Savings */}
              <div className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-teal-600">{L('Goal Savings', '目标储蓄')}</p>
                  <p className="text-[10px] text-muted-foreground">{L('Transferred to savings', '已转入储蓄')}</p>
                </div>
                {isFinalized ? <span className="text-sm font-bold">− RM {gs.toFixed(2)}</span>
                  : <AmtInput value={goalSavings} onChange={setGoalSavings} />}
              </div>

              {/* Other Spending */}
              <div className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-600">{L('Other Spending', '其他消费')}</p>
                  <p className="text-[10px] text-muted-foreground">{L('Miscellaneous outflows', '杂项支出')}</p>
                </div>
                {isFinalized ? <span className="text-sm font-bold">− RM {os.toFixed(2)}</span>
                  : <AmtInput value={otherSpending} onChange={setOtherSpending} />}
              </div>

              {/* Total outflows */}
              <div className="px-4 py-3 flex items-center justify-between bg-orange-50">
                <p className="text-sm font-bold text-orange-700">{L('Total Outflows', '总支出')}</p>
                <p className="text-base font-extrabold text-orange-700">RM {totalOutflows.toFixed(2)}</p>
              </div>
            </div>
          </div>

          {/* Step 3: Remaining Cash Flow */}
          <div className={`rounded-2xl border-2 overflow-hidden ${remainingCashFlow >= 0 ? 'border-primary bg-primary/5' : 'border-destructive bg-destructive/5'}`}>
            <div className={`px-4 py-2.5 ${remainingCashFlow >= 0 ? 'bg-primary' : 'bg-destructive'}`}>
              <p className="text-xs font-bold text-white opacity-90">{L('Step 3 — Remaining Cash Flow', '第三步 — 剩余现金流')}</p>
            </div>
            <div className="px-4 py-4 space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{L('Carry Forward In', '上月结余')}</span>
                <span>+ RM {carryForwardIn.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{L('Actual Income', '实际收入')}</span>
                <span>+ RM {totals.actualIncome.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{L('Total Outflows', '总支出')}</span>
                <span>− RM {totalOutflows.toFixed(2)}</span>
              </div>
              <div className="border-t border-border pt-2 flex items-center justify-between">
                <div>
                  <p className={`text-base font-extrabold ${remainingCashFlow >= 0 ? 'text-primary' : 'text-destructive'}`}>
                    {L('= Available / Carry Forward', '= 可用 / 结转下月')}
                  </p>
                  <p className="text-[10px] text-muted-foreground">{L('Carries to next month automatically', '自动结转到下月')}</p>
                </div>
                <p className={`text-2xl font-black ${remainingCashFlow >= 0 ? 'text-primary' : 'text-destructive'}`}>
                  RM {Math.abs(remainingCashFlow).toFixed(2)}
                  {remainingCashFlow < 0 && <span className="text-sm ml-1">{L('deficit', '赤字')}</span>}
                </p>
              </div>
            </div>
          </div>

          {/* Actions */}
          {!isFinalized ? (
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => handleSave(false)} disabled={saving} className="flex-1 h-12 rounded-2xl font-semibold">
                {L('Save Draft', '保存草稿')}
              </Button>
              <Button onClick={() => handleSave(true)} disabled={saving} className="flex-1 h-12 rounded-2xl font-bold">
                <Lock className="w-4 h-4 mr-1" />{L('Finalize', '完成结算')}
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={handleUnlock} className="w-full h-12 rounded-2xl font-semibold">
              <Unlock className="w-4 h-4 mr-2" />{L('Unlock & Edit', '解锁编辑')}
            </Button>
          )}
        </div>
      )}

      {/* ── BANK / CASH TAB ── */}
      {tab === 'bank' && (
        <div className="space-y-4">
          {/* Bank */}
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="bg-blue-500 px-4 py-2.5">
              <p className="text-xs font-bold text-white opacity-90">{L('Bank Account', '银行账户')}</p>
            </div>
            <div className="divide-y divide-border">
              <FlowRow label={L('Stored into Bank', '存入银行')} value={totals.bankTotal} color="text-blue-600" plus />
              <div className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-blue-800">{L('Bank Spent / Transferred Out', '银行支出')}</p>
                  <p className="text-[10px] text-muted-foreground">{L('Bills, transfers, spending from bank', '账单/转账/消费')}</p>
                </div>
                {isFinalized ? <span className="text-sm font-bold text-destructive">− RM {bo.toFixed(2)}</span>
                  : <AmtInput value={bankOut} onChange={setBankOut} />}
              </div>
              <div className="px-4 py-3 flex items-center justify-between bg-blue-50">
                <p className="text-sm font-bold text-blue-700">{L('Remaining Bank Balance', '银行余额')}</p>
                <p className={`text-lg font-extrabold ${bankBalance >= 0 ? 'text-blue-700' : 'text-destructive'}`}>
                  RM {bankBalance.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          {/* Cash */}
          <div className="bg-card rounded-2xl border border-border overflow-hidden">
            <div className="bg-amber-500 px-4 py-2.5">
              <p className="text-xs font-bold text-white opacity-90">{L('Cash', '现金')}</p>
            </div>
            <div className="divide-y divide-border">
              <FlowRow label={L('Stored as Cash', '保存现金')} value={totals.cashTotal} color="text-amber-600" plus />
              <div className="px-4 py-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-amber-800">{L('Cash Spent', '现金支出')}</p>
                  <p className="text-[10px] text-muted-foreground">{L('Cash used for expenses', '现金消费')}</p>
                </div>
                {isFinalized ? <span className="text-sm font-bold text-destructive">− RM {co.toFixed(2)}</span>
                  : <AmtInput value={cashOut} onChange={setCashOut} />}
              </div>
              <div className="px-4 py-3 flex items-center justify-between bg-amber-50">
                <p className="text-sm font-bold text-amber-700">{L('Remaining Cash', '现金余额')}</p>
                <p className={`text-lg font-extrabold ${cashBalance >= 0 ? 'text-amber-700' : 'text-destructive'}`}>
                  RM {cashBalance.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          {/* Combined */}
          <div className="bg-card rounded-2xl border border-border p-4">
            <p className="text-sm font-bold mb-3">{L('Combined Balance', '银行+现金合计')}</p>
            <div className="grid grid-cols-2 gap-3">
              {[
                { label: L('Bank In', '存入银行'), val: totals.bankTotal, color: 'text-blue-600', bg: 'bg-blue-50' },
                { label: L('Cash In', '存入现金'), val: totals.cashTotal, color: 'text-amber-600', bg: 'bg-amber-50' },
                { label: L('Bank Out', '银行支出'), val: bo, color: 'text-destructive', bg: 'bg-red-50' },
                { label: L('Cash Out', '现金支出'), val: co, color: 'text-destructive', bg: 'bg-red-50' },
                { label: L('Bank Balance', '银行余额'), val: bankBalance, color: bankBalance >= 0 ? 'text-blue-700' : 'text-destructive', bg: 'bg-blue-100' },
                { label: L('Cash Balance', '现金余额'), val: cashBalance, color: cashBalance >= 0 ? 'text-amber-700' : 'text-destructive', bg: 'bg-amber-100' },
              ].map(s => (
                <div key={s.label} className={`rounded-xl p-3 text-center ${s.bg}`}>
                  <p className="text-[10px] text-muted-foreground">{s.label}</p>
                  <p className={`text-sm font-extrabold ${s.color}`}>RM {s.val.toFixed(2)}</p>
                </div>
              ))}
            </div>
            <div className="mt-3 bg-secondary rounded-xl p-3 flex items-center justify-between">
              <p className="text-sm font-bold">{L('Total Balance (Bank + Cash)', '总余额')}</p>
              <p className={`text-lg font-extrabold ${(bankBalance + cashBalance) >= 0 ? 'text-primary' : 'text-destructive'}`}>
                RM {(bankBalance + cashBalance).toFixed(2)}
              </p>
            </div>
          </div>

          {/* Carry Forward reminder */}
          <div className="bg-teal-50 border border-teal-200 rounded-2xl px-4 py-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-teal-700">{L('Carry Forward → Next Month', '结转下月')}</p>
                <p className="text-[10px] text-teal-500">{L('From Money Flow tab', '来自资金流向')}</p>
              </div>
              <p className={`text-lg font-extrabold ${carryForwardOut >= 0 ? 'text-teal-700' : 'text-destructive'}`}>
                RM {carryForwardOut.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Save button */}
          {!isFinalized ? (
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => handleSave(false)} disabled={saving} className="flex-1 h-12 rounded-2xl font-semibold">
                {L('Save Draft', '保存草稿')}
              </Button>
              <Button onClick={() => handleSave(true)} disabled={saving} className="flex-1 h-12 rounded-2xl font-bold">
                <Lock className="w-4 h-4 mr-1" />{L('Finalize', '完成结算')}
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={handleUnlock} className="w-full h-12 rounded-2xl font-semibold">
              <Unlock className="w-4 h-4 mr-2" />{L('Unlock & Edit', '解锁编辑')}
            </Button>
          )}
        </div>
      )}

      {/* ── GOALS TAB ── */}
      {tab === 'goals' && (
        <div className="space-y-4">
          {activeGoals.length === 0 && (
            <div className="text-center py-10">
              <Target className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">{L('No goals yet', '暂无目标')}</p>
            </div>
          )}
          {activeGoals.map(goal => {
            const cat = GOAL_CATEGORIES.find(c => c.key === goal.category);
            const pct = goal.target_amount > 0 ? Math.min(100, (goal.current_saved / goal.target_amount) * 100) : 0;
            const remaining = Math.max(0, goal.target_amount - goal.current_saved);
            return (
              <div key={goal.id} className="bg-card rounded-2xl border border-border p-4 space-y-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{cat?.icon || '⭐'}</span>
                    <div>
                      <p className="text-sm font-bold">{goal.name}</p>
                      <p className="text-xs text-muted-foreground">{lang === 'zh' ? cat?.labelZh : cat?.label}</p>
                    </div>
                  </div>
                  <button onClick={() => navigate(`/goals/edit?id=${goal.id}`)} className="p-1 text-muted-foreground hover:text-foreground">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-muted-foreground">RM {(goal.current_saved || 0).toFixed(0)} / RM {(goal.target_amount || 0).toFixed(0)}</span>
                    <span className="font-bold text-primary">{pct.toFixed(0)}%</span>
                  </div>
                  <ProgressBar value={goal.current_saved || 0} max={goal.target_amount || 1} barClass="bg-primary" />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{L(`RM${remaining.toFixed(0)} remaining`, `还差 RM${remaining.toFixed(0)}`)}</span>
                  {goal.monthly_contribution > 0 && (
                    <span>RM{goal.monthly_contribution}/mo</span>
                  )}
                </div>
              </div>
            );
          })}
          <Button variant="outline" onClick={() => navigate('/goals/new')} className="w-full h-12 rounded-2xl font-semibold">
            <Plus className="w-4 h-4 mr-2" />{L('Add New Goal', '添加新目标')}
          </Button>
        </div>
      )}
    </div>
  );
}