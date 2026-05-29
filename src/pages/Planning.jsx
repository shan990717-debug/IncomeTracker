import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/lib/i18n';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, subMonths, addMonths } from 'date-fns';
import { ChevronLeft, ChevronRight, Lock, Unlock, Pencil, Plus, Target, Save } from 'lucide-react';
import { calcMonthlyTotals, monthStr, formatDate } from '@/lib/finance';
import { DEFAULT_PERSONAL_SPENDING_PCT, GOAL_CATEGORIES } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

const PREV_MONTH = (mStr) => {
  const [y, m] = mStr.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

function Divider({ label }) {
  return (
    <div className="flex items-center gap-2 my-1">
      <div className="flex-1 h-px bg-border" />
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">{label}</span>
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}

function FlowRow({ label, value, color = '', subtext, editable, onEdit, indent = false }) {
  return (
    <div className={`flex items-center justify-between py-2 ${indent ? 'pl-4' : ''}`}>
      <div>
        <p className={`text-sm font-semibold ${color}`}>{label}</p>
        {subtext && <p className="text-[10px] text-muted-foreground">{subtext}</p>}
      </div>
      <div className="flex items-center gap-2">
        <span className={`text-sm font-extrabold tabular-nums ${color || 'text-foreground'}`}>
          {value}
        </span>
        {editable && (
          <button onClick={onEdit} className="p-1 text-muted-foreground hover:text-foreground">
            <Pencil className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

function AmtInput({ value, onChange, placeholder = '0.00' }) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="number" inputMode="decimal" step="0.01" placeholder={placeholder}
        value={value}
        onChange={e => onChange(e.target.value)}
        className="w-28 text-right text-sm font-bold bg-secondary rounded-xl px-3 py-1.5 border-0 focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <span className="text-xs text-muted-foreground">RM</span>
    </div>
  );
}

export default function Planning() {
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [tab, setTab] = useState('flow');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const mStr = monthStr(currentMonth);
  const prevMStr = PREV_MONTH(mStr);

  // Editable allocation state
  const [alloc, setAlloc] = useState({
    personal_spending_pct: DEFAULT_PERSONAL_SPENDING_PCT,
    family_essential: '',
    family_claims: '',
    goal_savings: '',
    other_spending: '',
    bank_out: '',
    cash_out: '',
    notes: '',
  });
  const [settlement, setSettlement] = useState(null);
  const [saving, setSaving] = useState(false);
  const [editingPct, setEditingPct] = useState(false);
  const [pctInput, setPctInput] = useState(String(DEFAULT_PERSONAL_SPENDING_PCT));

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

  // Get previous month's carry-forward
  const prevSettlement = settlements.find(s => s.month === prevMStr);
  const carryForwardIn = prevSettlement?.cashflow_balance ?? 0;

  // Load settlement when month changes
  useEffect(() => {
    const existing = settlements.find(s => s.month === mStr);
    if (existing) {
      setSettlement(existing);
      setAlloc({
        personal_spending_pct: existing.personal_spending_pct ?? DEFAULT_PERSONAL_SPENDING_PCT,
        family_essential: String(existing.family_essential || ''),
        family_claims: String(existing.family_claims || ''),
        goal_savings: String(existing.goal_savings || ''),
        other_spending: String(existing.other_spending || ''),
        bank_out: String(existing.bank_out || ''),
        cash_out: String(existing.cash_out || ''),
        notes: existing.notes || '',
      });
      setPctInput(String(existing.personal_spending_pct ?? DEFAULT_PERSONAL_SPENDING_PCT));
    } else {
      setSettlement(null);
      setAlloc({
        personal_spending_pct: DEFAULT_PERSONAL_SPENDING_PCT,
        family_essential: '', family_claims: '', goal_savings: '',
        other_spending: '', bank_out: '', cash_out: '', notes: '',
      });
      setPctInput(String(DEFAULT_PERSONAL_SPENDING_PCT));
    }
  }, [mStr, settlements.length]);

  const f = (k) => parseFloat(alloc[k]) || 0;
  const pct = parseFloat(alloc.personal_spending_pct) || DEFAULT_PERSONAL_SPENDING_PCT;
  const personalSpending = +(totals.actualIncome * pct / 100).toFixed(2);
  const familyEssential = f('family_essential');
  const familyClaims = f('family_claims');
  const goalSavings = f('goal_savings');
  const otherSpending = f('other_spending');
  const bankOut = f('bank_out');
  const cashOut = f('cash_out');

  const totalAllocated = personalSpending + familyEssential + familyClaims + goalSavings + otherSpending;
  const cashflowBalance = +(carryForwardIn + totals.actualIncome - totalAllocated).toFixed(2);

  // Bank/Cash balances
  const bankRemaining = +(totals.bankTotal - bankOut).toFixed(2);
  const cashRemaining = +(totals.cashTotal - cashOut).toFixed(2);

  const isFinalized = settlement?.status === 'finalized';

  const setA = (key, val) => setAlloc(p => ({ ...p, [key]: val }));

  const handleSave = async (finalize = false) => {
    setSaving(true);
    const record = {
      month: mStr,
      gross_income: totals.grossIncome,
      total_operating_expense: totals.totalExpense,
      actual_income: totals.actualIncome,
      bank_total: totals.bankTotal,
      cash_total: totals.cashTotal,
      bank_out: bankOut,
      cash_out: cashOut,
      working_days: monthRecords.length,
      personal_spending_pct: pct,
      personal_spending: personalSpending,
      family_essential: familyEssential,
      family_claims: familyClaims,
      goal_savings: goalSavings,
      other_spending: otherSpending,
      carry_forward_in: carryForwardIn,
      cashflow_balance: cashflowBalance,
      notes: alloc.notes,
      status: finalize ? 'finalized' : 'draft',
    };
    if (settlement?.id) {
      await base44.entities.MonthlySettlement.update(settlement.id, record);
    } else {
      const created = await base44.entities.MonthlySettlement.create(record);
      setSettlement(created);
    }
    qc.invalidateQueries({ queryKey: ['settlements'] });
    setSaving(false);
    toast.success(finalize ? (lang === 'zh' ? '已结算' : 'Month finalized') : (lang === 'zh' ? '已保存' : 'Draft saved'));
  };

  const handleUnlock = async () => {
    if (!settlement?.id) return;
    await base44.entities.MonthlySettlement.update(settlement.id, { status: 'draft' });
    qc.invalidateQueries({ queryKey: ['settlements'] });
    toast.success(lang === 'zh' ? '已解锁' : 'Unlocked');
  };

  const activeGoals = goals.filter(g => g.is_active !== false);

  return (
    <div className="px-4 pt-14 pb-28 space-y-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">{lang === 'zh' ? '规划' : 'Planning'}</h1>
        {isFinalized && (
          <span className="text-xs bg-primary/10 text-primary font-semibold px-2 py-1 rounded-lg flex items-center gap-1">
            <Lock className="w-3 h-3" />{lang === 'zh' ? '已结算' : 'Finalized'}
          </span>
        )}
      </div>

      {/* Month Nav */}
      <div className="flex items-center justify-between bg-card rounded-2xl px-4 py-3 border border-border">
        <button onClick={() => setCurrentMonth(m => subMonths(m, 1))} className="p-1">
          <ChevronLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <p className="font-bold">{format(currentMonth, 'MMMM yyyy')}</p>
        <button onClick={() => setCurrentMonth(m => addMonths(m, 1))} className="p-1">
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex bg-secondary rounded-2xl p-1 gap-1">
        {[
          { key: 'flow',  label: lang === 'zh' ? '月度规划' : 'Monthly Flow' },
          { key: 'bank',  label: lang === 'zh' ? '银行/现金' : 'Bank & Cash' },
          { key: 'goals', label: lang === 'zh' ? '目标' : 'Goals' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-all ${tab === t.key ? 'bg-card shadow text-foreground' : 'text-muted-foreground'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── MONTHLY FLOW TAB ── */}
      {tab === 'flow' && (
        <div className="space-y-3">

          {/* Step 1: Income */}
          <div className="bg-card rounded-2xl border border-border p-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">
              {lang === 'zh' ? '① 本月收入' : '① Monthly Income'}
            </p>
            <FlowRow label={lang === 'zh' ? '总毛收入' : 'Gross Income'} value={`RM ${totals.grossIncome.toFixed(2)}`} />
            <FlowRow label={lang === 'zh' ? '运营扣除' : 'Operating Deductions'} value={`− RM ${totals.totalExpense.toFixed(2)}`} color="text-red-500" indent />
            <div className="h-px bg-border my-2" />
            <FlowRow label={lang === 'zh' ? '实际净收入' : 'Actual Net Income'} value={`RM ${totals.actualIncome.toFixed(2)}`} color="text-primary" />
            {carryForwardIn > 0 && (
              <FlowRow label={lang === 'zh' ? '上月结转' : 'Carry Forward (prev month)'} value={`+ RM ${carryForwardIn.toFixed(2)}`} color="text-teal-600" subtext={prevMStr} />
            )}
            <p className="text-[10px] text-muted-foreground mt-2">{monthRecords.length} {lang === 'zh' ? '个工作日' : 'working days'}</p>
          </div>

          {/* Step 2: Allocation */}
          <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
              {lang === 'zh' ? '② 月度分配' : '② Monthly Allocation'}
            </p>

            {/* Personal Spending */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold">{lang === 'zh' ? '个人消费' : 'Personal Spending'}</p>
                <p className="text-[10px] text-muted-foreground">{lang === 'zh' ? '实际净收入 × ' : 'Net income × '}{pct}%</p>
              </div>
              {isFinalized ? (
                <span className="text-sm font-extrabold text-orange-600">RM {personalSpending.toFixed(2)}</span>
              ) : editingPct ? (
                <div className="flex items-center gap-1">
                  <input type="number" inputMode="decimal" min="0" max="100" value={pctInput}
                    onChange={e => setPctInput(e.target.value)}
                    className="w-14 text-right text-sm font-bold bg-secondary rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary" autoFocus />
                  <span className="text-xs">%</span>
                  <button onClick={() => { const v = parseFloat(pctInput); if (!isNaN(v)) setA('personal_spending_pct', v); setEditingPct(false); }}
                    className="text-xs font-bold px-2 py-1 bg-primary text-primary-foreground rounded-lg">✓</button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <span className="text-sm font-extrabold text-orange-600">RM {personalSpending.toFixed(2)}</span>
                  <button onClick={() => setEditingPct(true)} className="p-1 text-muted-foreground hover:text-foreground"><Pencil className="w-3 h-3" /></button>
                </div>
              )}
            </div>

            {/* Allocation Rows */}
            {[
              { key: 'family_essential', label: lang === 'zh' ? '家庭必需支出' : 'Family Essential',  color: 'bg-blue-50 text-blue-600' },
              { key: 'family_claims',    label: lang === 'zh' ? '家庭报销' : 'Family Claims',         color: 'bg-indigo-50 text-indigo-600' },
              { key: 'goal_savings',     label: lang === 'zh' ? '目标储蓄' : 'Goal Savings',          color: 'bg-teal-50 text-teal-600' },
              { key: 'other_spending',   label: lang === 'zh' ? '其他支出' : 'Other Spending',        color: 'bg-gray-100 text-gray-600' },
            ].map(row => (
              <div key={row.key} className="flex items-center justify-between">
                <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${row.color}`}>{row.label}</span>
                {isFinalized ? (
                  <span className="text-sm font-extrabold">RM {f(row.key).toFixed(2)}</span>
                ) : (
                  <AmtInput value={alloc[row.key]} onChange={v => setA(row.key, v)} />
                )}
              </div>
            ))}

            <div className="h-px bg-border" />
            <div className="flex items-center justify-between">
              <p className="text-sm font-bold">{lang === 'zh' ? '总分配' : 'Total Allocated'}</p>
              <p className="text-sm font-extrabold text-red-500">RM {totalAllocated.toFixed(2)}</p>
            </div>
          </div>

          {/* Step 3: Cash Flow Balance */}
          <div className={`rounded-2xl border p-4 space-y-2 ${cashflowBalance >= 0 ? 'bg-primary/5 border-primary/20' : 'bg-red-50 border-red-200'}`}>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
              {lang === 'zh' ? '③ 现金流余额' : '③ Cash Flow Balance'}
            </p>
            {carryForwardIn > 0 && (
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{lang === 'zh' ? '上月结转' : 'Carry Forward In'}</span>
                <span className="font-semibold text-teal-600">RM {carryForwardIn.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{lang === 'zh' ? '实际净收入' : 'Net Income'}</span>
              <span>RM {totals.actualIncome.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{lang === 'zh' ? '总分配支出' : 'Total Allocated'}</span>
              <span className="text-red-500">− RM {totalAllocated.toFixed(2)}</span>
            </div>
            <div className="h-px bg-border" />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold">{lang === 'zh' ? '本月结余 → 结转下月' : 'Month Ending → Carry Forward'}</p>
                <p className="text-[10px] text-muted-foreground">{lang === 'zh' ? '自动结转至下月' : 'Auto-carries to next month'}</p>
              </div>
              <p className={`text-xl font-extrabold ${cashflowBalance >= 0 ? 'text-primary' : 'text-destructive'}`}>
                RM {cashflowBalance.toFixed(2)}
              </p>
            </div>
          </div>

          {/* Notes */}
          {!isFinalized && (
            <div className="bg-card rounded-2xl border border-border p-4">
              <p className="text-xs font-semibold text-muted-foreground mb-2">{lang === 'zh' ? '备注' : 'Notes'}</p>
              <textarea value={alloc.notes} onChange={e => setA('notes', e.target.value)} rows={2}
                className="w-full bg-secondary rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none"
                placeholder={lang === 'zh' ? '本月备注...' : 'Month notes...'} />
            </div>
          )}

          {/* Actions */}
          {!isFinalized ? (
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => handleSave(false)} disabled={saving} className="flex-1 h-12 rounded-2xl font-semibold">
                <Save className="w-4 h-4 mr-1" />{lang === 'zh' ? '保存草稿' : 'Save Draft'}
              </Button>
              <Button onClick={() => handleSave(true)} disabled={saving} className="flex-1 h-12 rounded-2xl font-bold">
                <Lock className="w-4 h-4 mr-1" />{lang === 'zh' ? '完成结算' : 'Finalize'}
              </Button>
            </div>
          ) : (
            <Button variant="outline" onClick={handleUnlock} className="w-full h-12 rounded-2xl font-semibold">
              <Unlock className="w-4 h-4 mr-2" />{lang === 'zh' ? '解锁编辑' : 'Unlock & Edit'}
            </Button>
          )}
        </div>
      )}

      {/* ── BANK & CASH TAB ── */}
      {tab === 'bank' && (
        <div className="space-y-3">
          {/* Income breakdown */}
          <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
              {lang === 'zh' ? '本月存入' : 'Stored In This Month'}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-3 text-center">
                <p className="text-xs text-blue-500 font-medium mb-1">🏦 {lang === 'zh' ? '存入银行' : 'Bank In'}</p>
                <p className="text-xl font-extrabold text-blue-700">RM {totals.bankTotal.toFixed(2)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{lang === 'zh' ? '来自每日记录' : 'From daily records'}</p>
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-3 text-center">
                <p className="text-xs text-amber-600 font-medium mb-1">💵 {lang === 'zh' ? '存入现金' : 'Cash In'}</p>
                <p className="text-xl font-extrabold text-amber-700">RM {totals.cashTotal.toFixed(2)}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{lang === 'zh' ? '来自每日记录' : 'From daily records'}</p>
              </div>
            </div>
          </div>

          {/* Spending out */}
          <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
              {lang === 'zh' ? '本月使用' : 'Used / Spent Out'}
            </p>
            <div className="space-y-3">
              {[
                { key: 'bank_out', label: lang === 'zh' ? '银行支出' : 'Bank Out', emoji: '🏦', bg: 'bg-blue-50', text: 'text-blue-700' },
                { key: 'cash_out', label: lang === 'zh' ? '现金支出' : 'Cash Out', emoji: '💵', bg: 'bg-amber-50', text: 'text-amber-700' },
              ].map(row => (
                <div key={row.key} className={`${row.bg} rounded-xl p-3 flex items-center justify-between`}>
                  <div className="flex items-center gap-2">
                    <span>{row.emoji}</span>
                    <p className={`text-sm font-semibold ${row.text}`}>{row.label}</p>
                  </div>
                  {isFinalized ? (
                    <span className={`text-sm font-extrabold ${row.text}`}>RM {f(row.key).toFixed(2)}</span>
                  ) : (
                    <AmtInput value={alloc[row.key]} onChange={v => setA(row.key, v)} />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Remaining balances */}
          <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">
              {lang === 'zh' ? '余额' : 'Remaining Balance'}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div className={`rounded-xl p-3 text-center border ${bankRemaining >= 0 ? 'bg-blue-50 border-blue-100' : 'bg-red-50 border-red-100'}`}>
                <p className="text-xs text-muted-foreground font-medium mb-1">🏦 {lang === 'zh' ? '银行余额' : 'Bank Balance'}</p>
                <p className={`text-xl font-extrabold ${bankRemaining >= 0 ? 'text-blue-700' : 'text-destructive'}`}>
                  RM {bankRemaining.toFixed(2)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {totals.bankTotal.toFixed(0)} − {bankOut.toFixed(0)}
                </p>
              </div>
              <div className={`rounded-xl p-3 text-center border ${cashRemaining >= 0 ? 'bg-amber-50 border-amber-100' : 'bg-red-50 border-red-100'}`}>
                <p className="text-xs text-muted-foreground font-medium mb-1">💵 {lang === 'zh' ? '现金余额' : 'Cash Balance'}</p>
                <p className={`text-xl font-extrabold ${cashRemaining >= 0 ? 'text-amber-700' : 'text-destructive'}`}>
                  RM {cashRemaining.toFixed(2)}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {totals.cashTotal.toFixed(0)} − {cashOut.toFixed(0)}
                </p>
              </div>
            </div>
          </div>

          {/* Carry forward summary */}
          <div className={`rounded-2xl border p-4 ${cashflowBalance >= 0 ? 'bg-primary/5 border-primary/20' : 'bg-red-50 border-red-200'}`}>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">
              {lang === 'zh' ? '结转下月' : 'Carry Forward to Next Month'}
            </p>
            <p className={`text-2xl font-extrabold ${cashflowBalance >= 0 ? 'text-primary' : 'text-destructive'}`}>
              RM {cashflowBalance.toFixed(2)}
            </p>
            <p className="text-[10px] text-muted-foreground mt-1">
              {lang === 'zh'
                ? `上月结转 RM${carryForwardIn.toFixed(0)} + 净收入 RM${totals.actualIncome.toFixed(0)} − 分配 RM${totalAllocated.toFixed(0)}`
                : `CF in RM${carryForwardIn.toFixed(0)} + net RM${totals.actualIncome.toFixed(0)} − alloc RM${totalAllocated.toFixed(0)}`}
            </p>
          </div>

          {!isFinalized && (
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => handleSave(false)} disabled={saving} className="flex-1 h-12 rounded-2xl font-semibold">
                <Save className="w-4 h-4 mr-1" />{lang === 'zh' ? '保存草稿' : 'Save Draft'}
              </Button>
              <Button onClick={() => handleSave(true)} disabled={saving} className="flex-1 h-12 rounded-2xl font-bold">
                <Lock className="w-4 h-4 mr-1" />{lang === 'zh' ? '完成结算' : 'Finalize'}
              </Button>
            </div>
          )}
          {isFinalized && (
            <Button variant="outline" onClick={handleUnlock} className="w-full h-12 rounded-2xl font-semibold">
              <Unlock className="w-4 h-4 mr-2" />{lang === 'zh' ? '解锁编辑' : 'Unlock & Edit'}
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
              <p className="text-sm text-muted-foreground">{lang === 'zh' ? '暂无目标' : 'No goals yet'}</p>
            </div>
          )}
          {activeGoals.map(goal => {
            const cat = GOAL_CATEGORIES.find(c => c.key === goal.category);
            const pctG = goal.target_amount > 0 ? Math.min(100, (goal.current_saved / goal.target_amount) * 100) : 0;
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
                    <span className="font-bold text-primary">{pctG.toFixed(0)}%</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pctG}%` }} />
                  </div>
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{lang === 'zh' ? `还差 RM${remaining.toFixed(0)}` : `RM${remaining.toFixed(0)} remaining`}</span>
                  {goal.monthly_contribution > 0 && (
                    <span>{lang === 'zh' ? `每月 RM${goal.monthly_contribution}` : `RM${goal.monthly_contribution}/mo`}</span>
                  )}
                </div>
                {goal.target_date && (
                  <p className="text-[10px] text-muted-foreground">{lang === 'zh' ? '目标日期: ' : 'Target: '}{formatDate(goal.target_date)}</p>
                )}
              </div>
            );
          })}
          <Button variant="outline" onClick={() => navigate('/goals/new')} className="w-full h-12 rounded-2xl font-semibold">
            <Plus className="w-4 h-4 mr-2" />{lang === 'zh' ? '添加新目标' : 'Add New Goal'}
          </Button>
        </div>
      )}
    </div>
  );
}