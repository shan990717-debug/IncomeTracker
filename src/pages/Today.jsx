import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/lib/i18n';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { INCOME_FIELDS, EXPENSE_FIELDS } from '@/lib/constants';
import { calcDailyTotals } from '@/lib/finance';
import AmountInput from '@/components/ui/AmountInput';
import ShidanForm from '@/components/record/ShidanForm';
import GrabLoanField from '@/components/record/GrabLoanField';
import PAInsuranceField from '@/components/record/PAInsuranceField';
import { Button } from '@/components/ui/button';
import { Save, ChevronDown, ChevronUp, Landmark, Banknote, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const TODAY = format(new Date(), 'yyyy-MM-dd');

const emptyForm = () => ({
  // Income
  income_grab: '', income_tips: '', income_incentive: '', income_turbo5: '',
  income_turbo_cashback: '', income_cdian: '', income_indrive: '', income_aa: '',
  income_bolt: '', income_3party: '',
  // Expenses (operating deductions before saving)
  expense_petrol: '', expense_shidan: '', expense_shidan_order_amt: '',
  expense_shidan_rate: '25', expense_shidan_incentive: '',
  expense_toll: '', expense_parking: '',
  expense_grab_loan: '', expense_pa_insurance: '0',
  // Storage
  stored_bank: '', stored_cash: '',
});

export default function Today() {
  const { lang } = useLanguage();
  const queryClient = useQueryClient();
  const [data, setData] = useState(emptyForm());
  const [recordId, setRecordId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [incomeOpen, setIncomeOpen] = useState(true);
  const [expenseOpen, setExpenseOpen] = useState(true);

  useEffect(() => {
    base44.entities.DailyRecord.filter({ date: TODAY }).then(records => {
      if (records.length > 0) {
        const r = records[0];
        setRecordId(r.id);
        const loaded = emptyForm();
        Object.keys(loaded).forEach(k => { loaded[k] = r[k] != null ? String(r[k]) : loaded[k]; });
        setData(loaded);
      }
    });
  }, []);

  const set = (key, val) => setData(p => ({ ...p, [key]: val }));

  const { totalIncome, totalExpense, actualIncome } = calcDailyTotals(data);
  const bankAmt = parseFloat(data.stored_bank) || 0;
  const cashAmt = parseFloat(data.stored_cash) || 0;
  const unallocated = actualIncome - bankAmt - cashAmt;

  const handleSave = async () => {
    setSaving(true);
    const record = { date: TODAY, total_income: totalIncome, total_expense: totalExpense, actual_income: actualIncome };
    Object.keys(emptyForm()).forEach(k => { record[k] = parseFloat(data[k]) || 0; });
    if (recordId) {
      await base44.entities.DailyRecord.update(recordId, record);
      toast.success(lang === 'zh' ? '记录已更新' : 'Record updated');
    } else {
      const created = await base44.entities.DailyRecord.create(record);
      setRecordId(created.id);
      toast.success(lang === 'zh' ? '记录已保存' : 'Record saved');
    }
    queryClient.invalidateQueries({ queryKey: ['dailyRecords'] });
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!recordId || !confirm(lang === 'zh' ? '确定删除今日记录？' : "Delete today's record?")) return;
    await base44.entities.DailyRecord.delete(recordId);
    setRecordId(null);
    setData(emptyForm());
    queryClient.invalidateQueries({ queryKey: ['dailyRecords'] });
    toast.success(lang === 'zh' ? '已删除' : 'Deleted');
  };

  return (
    <div className="px-4 pt-14 pb-6 space-y-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-foreground">{lang === 'zh' ? '今日记录' : 'Today'}</h1>
          <p className="text-xs text-muted-foreground">{format(new Date(), 'EEEE, d MMM yyyy')}</p>
        </div>
        <div className="flex items-center gap-2">
          {recordId && (
            <button onClick={handleDelete} className="p-2 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          {recordId && <span className="text-xs bg-primary/10 text-primary font-semibold px-2 py-1 rounded-lg">{lang === 'zh' ? '已保存' : 'Saved'}</span>}
        </div>
      </div>

      {/* Live summary bar */}
      <div className="bg-gradient-to-r from-primary to-primary/80 rounded-2xl p-4 text-primary-foreground">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div>
            <p className="text-[10px] opacity-75 font-medium">{lang === 'zh' ? '总收入' : 'Gross Earnings'}</p>
            <p className="text-lg font-extrabold">RM {totalIncome.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-[10px] opacity-75 font-medium">{lang === 'zh' ? '运营扣除' : 'Deductions'}</p>
            <p className="text-lg font-extrabold">RM {totalExpense.toFixed(2)}</p>
          </div>
          <div>
            <p className="text-[10px] opacity-75 font-medium">{lang === 'zh' ? '实际收入' : 'Actual Income'}</p>
            <p className="text-xl font-extrabold">RM {actualIncome.toFixed(2)}</p>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-white/20 text-center">
          <p className="text-[10px] opacity-70">
            {lang === 'zh'
              ? '实际收入 = 总收入 - 运营扣除（存入银行/现金前）'
              : 'Actual Income = Gross Earnings - All Deductions (before Bank/Cash storage)'}
          </p>
        </div>
      </div>

      {/* ── INCOME SECTION ── */}
      <CollapsibleSection
        title={lang === 'zh' ? '📥 收入来源' : '📥 Daily Earnings'}
        total={totalIncome}
        totalColor="text-primary"
        open={incomeOpen}
        onToggle={() => setIncomeOpen(v => !v)}
      >
        <div className="space-y-2">
          {INCOME_FIELDS.map(f => (
            <div key={f.key} className="flex items-center gap-3 rounded-xl bg-secondary/50 px-3 py-2.5">
              <span className={`text-xs font-bold px-2 py-1 rounded-lg min-w-[90px] text-center ${f.color}`}>{f.label}</span>
              <AmountInput value={data[f.key]} onChange={v => set(f.key, v)} />
              <span className="text-xs text-muted-foreground font-medium shrink-0">RM</span>
            </div>
          ))}
        </div>
      </CollapsibleSection>

      {/* ── DEDUCTIONS BEFORE SAVING ── */}
      <CollapsibleSection
        title={lang === 'zh' ? '📤 存入前扣除（运营成本）' : '📤 Deductions Before Saving'}
        total={totalExpense}
        totalColor="text-destructive"
        totalPrefix="- "
        open={expenseOpen}
        onToggle={() => setExpenseOpen(v => !v)}
      >
        <div className="space-y-2">
          {/* Petrol, Toll, Parking — simple inputs */}
          {EXPENSE_FIELDS.filter(f => f.key !== 'expense_shidan').map(f => (
            <div key={f.key} className="flex items-center gap-3 rounded-xl bg-secondary/50 px-3 py-2.5">
              <span className={`text-xs font-bold px-2 py-1 rounded-lg min-w-[90px] text-center ${f.color}`}>{f.label}</span>
              <AmountInput value={data[f.key]} onChange={v => set(f.key, v)} />
              <span className="text-xs text-muted-foreground font-medium shrink-0">RM</span>
            </div>
          ))}

          {/* 射单 — special expandable form */}
          <ShidanForm data={data} set={set} />

          {/* Grab Loan — flexible mode */}
          <GrabLoanField value={data.expense_grab_loan} onChange={v => set('expense_grab_loan', v)} />

          {/* PA Insurance — monthly fixed toggle */}
          <PAInsuranceField value={data.expense_pa_insurance} onChange={v => set('expense_pa_insurance', v)} />
        </div>

        {/* Deduction breakdown */}
        <div className="mt-3 bg-destructive/5 border border-destructive/15 rounded-xl p-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2">{lang === 'zh' ? '扣除明细' : 'Deduction Breakdown'}</p>
          <div className="space-y-1">
            {[
              { label: 'Petrol', val: parseFloat(data.expense_petrol) || 0 },
              { label: '射单 Cost', val: parseFloat(data.expense_shidan) || 0 },
              { label: 'Toll', val: parseFloat(data.expense_toll) || 0 },
              { label: 'Parking', val: parseFloat(data.expense_parking) || 0 },
              { label: 'Grab Loan', val: parseFloat(data.expense_grab_loan) || 0 },
              { label: 'PA Insurance', val: parseFloat(data.expense_pa_insurance) || 0 },
            ].filter(i => i.val > 0).map(i => (
              <div key={i.label} className="flex justify-between text-xs">
                <span className="text-muted-foreground">{i.label}</span>
                <span className="font-medium text-destructive">- RM {i.val.toFixed(2)}</span>
              </div>
            ))}
            <div className="border-t border-destructive/20 pt-1 flex justify-between text-xs font-bold">
              <span>{lang === 'zh' ? '总扣除' : 'Total Deductions'}</span>
              <span className="text-destructive">- RM {totalExpense.toFixed(2)}</span>
            </div>
          </div>
        </div>
      </CollapsibleSection>

      {/* ── STORE INCOME (after deductions) ── */}
      <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold">{lang === 'zh' ? '存入银行 / 现金' : 'Store to Bank / Cash'}</h3>
            <p className="text-xs text-muted-foreground">{lang === 'zh' ? `可存入: RM${actualIncome.toFixed(2)}` : `Available to store: RM${actualIncome.toFixed(2)}`}</p>
          </div>
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg ${
            Math.abs(unallocated) < 0.01
              ? 'bg-primary/10 text-primary'
              : unallocated < 0
                ? 'bg-destructive/10 text-destructive'
                : 'bg-amber-50 text-amber-600'
          }`}>
            {Math.abs(unallocated) < 0.01
              ? (lang === 'zh' ? '✓ 已分配' : '✓ Allocated')
              : unallocated > 0
                ? `${lang === 'zh' ? '剩余' : 'Left'} RM${unallocated.toFixed(2)}`
                : `${lang === 'zh' ? '超额' : 'Over'} RM${Math.abs(unallocated).toFixed(2)}`}
          </span>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <StorageField icon={<Landmark className="w-4 h-4 text-blue-500" />} label={lang === 'zh' ? '银行' : 'Bank'} bg="bg-blue-50" value={data.stored_bank} onChange={v => set('stored_bank', v)} />
          <StorageField icon={<Banknote className="w-4 h-4 text-amber-500" />} label={lang === 'zh' ? '现金' : 'Cash'} bg="bg-amber-50" value={data.stored_cash} onChange={v => set('stored_cash', v)} />
        </div>

        <div className="flex gap-2">
          {[
            { label: lang === 'zh' ? '全存银行' : 'All Bank', bank: actualIncome, cash: 0 },
            { label: lang === 'zh' ? '全用现金' : 'All Cash', bank: 0, cash: actualIncome },
            { label: '50/50', bank: actualIncome / 2, cash: actualIncome / 2 },
          ].map(opt => (
            <button key={opt.label}
              onClick={() => { set('stored_bank', opt.bank.toFixed(2)); set('stored_cash', opt.cash.toFixed(2)); }}
              className="flex-1 text-xs font-semibold py-2 rounded-xl border border-border bg-secondary hover:bg-border transition-colors">
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Save */}
      <Button onClick={handleSave} disabled={saving} className="w-full h-12 rounded-2xl font-bold text-base bg-primary hover:bg-primary/90">
        <Save className="w-4 h-4 mr-2" />
        {saving ? '...' : (lang === 'zh' ? '保存今日记录' : "Save Today's Record")}
      </Button>
    </div>
  );
}

function CollapsibleSection({ title, total, totalColor, totalPrefix = '', open, onToggle, children }) {
  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      <button onClick={onToggle} className="w-full flex items-center justify-between px-4 py-3">
        <span className="text-sm font-bold">{title}</span>
        <div className="flex items-center gap-2">
          <span className={`text-sm font-bold ${totalColor}`}>{totalPrefix}RM {total.toFixed(2)}</span>
          {open ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
        </div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
            <div className="px-4 pb-4 space-y-2">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StorageField({ icon, label, bg, value, onChange }) {
  return (
    <div className={`rounded-xl ${bg} px-3 py-2.5`}>
      <div className="flex items-center gap-1.5 mb-1">{icon}<span className="text-xs font-medium text-muted-foreground">{label}</span></div>
      <div className="flex items-center gap-1">
        <AmountInput value={value} onChange={onChange} />
        <span className="text-xs text-muted-foreground">RM</span>
      </div>
    </div>
  );
}