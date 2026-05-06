import React, { useState, useEffect } from 'react';
import { useLanguage } from '@/lib/i18n';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { calcDailyTotals } from '@/lib/finance';
import { Button } from '@/components/ui/button';
import { Save, ChevronDown, ChevronUp, Landmark, Banknote, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';

const TODAY = format(new Date(), 'yyyy-MM-dd');

// Primary income (shown by default)
const PRIMARY_INCOME = [
  { key: 'income_grab',    label: 'Grab' },
  { key: 'income_indrive', label: 'In Drive' },
  { key: 'income_bolt',    label: 'Bolt' },
  { key: 'income_tips',    label: 'Tips' },
];

// Secondary income (hidden under "More")
const SECONDARY_INCOME = [
  { key: 'income_incentive',      label: 'Incentive' },
  { key: 'income_turbo5',         label: 'Turbo 5%' },
  { key: 'income_turbo_cashback', label: 'Turbo Cash Back' },
  { key: 'income_cdian',          label: 'C单' },
  { key: 'income_aa',             label: 'AA' },
  { key: 'income_3party',         label: '3 Party Comm' },
];

const EXPENSE_FIELDS = [
  { key: 'expense_petrol',    label: 'Petrol' },
  { key: 'expense_toll',      label: 'Toll' },
  { key: 'expense_parking',   label: 'Parking' },
  { key: 'expense_car_small', label: 'Small Car Exp' },
  { key: 'expense_others',    label: 'Others' },
];

const ALL_INCOME_KEYS = [...PRIMARY_INCOME, ...SECONDARY_INCOME].map(f => f.key);
const ALL_EXPENSE_KEYS = EXPENSE_FIELDS.map(f => f.key);

const emptyForm = () => ({
  income_grab: '', income_tips: '', income_incentive: '', income_turbo5: '',
  income_turbo_cashback: '', income_cdian: '', income_indrive: '', income_aa: '',
  income_bolt: '', income_3party: '',
  expense_petrol: '', expense_toll: '', expense_parking: '',
  expense_car_small: '', expense_others: '',
  stored_bank: '', stored_cash: '',
});

export default function Today() {
  const { lang } = useLanguage();
  const queryClient = useQueryClient();
  const [data, setData] = useState(emptyForm());
  const [recordId, setRecordId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [showMoreIncome, setShowMoreIncome] = useState(false);

  useEffect(() => {
    base44.entities.DailyRecord.filter({ date: TODAY }).then(records => {
      if (records.length > 0) {
        const r = records[0];
        setRecordId(r.id);
        const loaded = emptyForm();
        Object.keys(loaded).forEach(k => { loaded[k] = r[k] ? String(r[k]) : ''; });
        setData(loaded);
        // Auto-open more income if any secondary fields have values
        const hasSecondary = SECONDARY_INCOME.some(f => parseFloat(r[f.key]) > 0);
        if (hasSecondary) setShowMoreIncome(true);
      }
    });
  }, []);

  const set = (key, val) => setData(p => ({ ...p, [key]: val }));

  const totalIncome = ALL_INCOME_KEYS.reduce((s, k) => s + (parseFloat(data[k]) || 0), 0);
  const totalExpense = ALL_EXPENSE_KEYS.reduce((s, k) => s + (parseFloat(data[k]) || 0), 0);
  const actualIncome = totalIncome - totalExpense;
  const bankAmt = parseFloat(data.stored_bank) || 0;
  const cashAmt = parseFloat(data.stored_cash) || 0;
  const unallocated = actualIncome - bankAmt - cashAmt;

  const handleSave = async () => {
    setSaving(true);
    const record = { date: TODAY, total_income: totalIncome, total_expense: totalExpense, actual_income: actualIncome };
    Object.keys(emptyForm()).forEach(k => { record[k] = parseFloat(data[k]) || 0; });
    if (recordId) {
      await base44.entities.DailyRecord.update(recordId, record);
      toast.success(lang === 'zh' ? '已更新' : 'Updated');
    } else {
      const created = await base44.entities.DailyRecord.create(record);
      setRecordId(created.id);
      toast.success(lang === 'zh' ? '已保存' : 'Saved');
    }
    queryClient.invalidateQueries({ queryKey: ['dailyRecords'] });
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!recordId || !confirm(lang === 'zh' ? '删除今日记录？' : "Delete today's record?")) return;
    await base44.entities.DailyRecord.delete(recordId);
    setRecordId(null);
    setData(emptyForm());
    queryClient.invalidateQueries({ queryKey: ['dailyRecords'] });
    toast.success(lang === 'zh' ? '已删除' : 'Deleted');
  };

  return (
    <div className="px-4 pt-12 pb-8 space-y-4 max-w-lg mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold">{lang === 'zh' ? '今日记录' : 'Today'}</h1>
          <p className="text-xs text-muted-foreground">{format(new Date(), 'EEE, d MMM yyyy')}</p>
        </div>
        {recordId && (
          <button onClick={handleDelete} className="p-2 rounded-xl text-muted-foreground hover:text-destructive transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2">
        <SummaryChip label={lang === 'zh' ? '实际收入' : 'Net Income'} value={actualIncome} big green />
        <SummaryChip label={lang === 'zh' ? '总收入' : 'Earnings'} value={totalIncome} />
        <SummaryChip label={lang === 'zh' ? '运营支出' : 'Expenses'} value={totalExpense} orange />
      </div>

      {/* Income Section */}
      <Section title={lang === 'zh' ? '收入来源' : 'Income Sources'} accent="green">
        <div className="space-y-1">
          {PRIMARY_INCOME.map(f => (
            <InputRow key={f.key} label={f.label} value={data[f.key]} onChange={v => set(f.key, v)} />
          ))}

          <button onClick={() => setShowMoreIncome(v => !v)}
            className="flex items-center gap-1 text-xs text-muted-foreground py-1.5 w-full">
            {showMoreIncome ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {showMoreIncome
              ? (lang === 'zh' ? '收起其他来源' : 'Hide more sources')
              : (lang === 'zh' ? '更多收入来源' : 'More income sources')}
          </button>

          <AnimatePresence>
            {showMoreIncome && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }} className="overflow-hidden space-y-1">
                {SECONDARY_INCOME.map(f => (
                  <InputRow key={f.key} label={f.label} value={data[f.key]} onChange={v => set(f.key, v)} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </Section>

      {/* Expense Section */}
      <Section title={lang === 'zh' ? '运营支出' : 'Operating Expenses'} accent="orange">
        <div className="space-y-1">
          {EXPENSE_FIELDS.map(f => (
            <InputRow key={f.key} label={f.label} value={data[f.key]} onChange={v => set(f.key, v)} />
          ))}
        </div>
      </Section>

      {/* Storage Section */}
      <Section title={lang === 'zh' ? '钱放哪里？' : 'Where to store?'} accent="blue">
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <StorageInput icon={<Landmark className="w-4 h-4 text-blue-500" />} label={lang === 'zh' ? '银行' : 'Bank'} bg="bg-blue-50"
              value={data.stored_bank} onChange={v => set('stored_bank', v)} />
            <StorageInput icon={<Banknote className="w-4 h-4 text-amber-500" />} label={lang === 'zh' ? '现金' : 'Cash'} bg="bg-amber-50"
              value={data.stored_cash} onChange={v => set('stored_cash', v)} />
          </div>
          <div className="flex gap-2">
            {[
              { label: lang === 'zh' ? '全存银行' : 'All Bank', b: actualIncome, c: 0 },
              { label: lang === 'zh' ? '全现金' : 'All Cash',   b: 0, c: actualIncome },
              { label: '50/50',                                  b: actualIncome / 2, c: actualIncome / 2 },
            ].map(o => (
              <button key={o.label} onClick={() => { set('stored_bank', o.b.toFixed(2)); set('stored_cash', o.c.toFixed(2)); }}
                className="flex-1 text-xs font-semibold py-2 rounded-xl border border-border bg-secondary hover:bg-border transition-colors">
                {o.label}
              </button>
            ))}
          </div>
          {Math.abs(unallocated) > 0.01 && (
            <p className={`text-xs font-medium text-center ${unallocated < 0 ? 'text-destructive' : 'text-amber-600'}`}>
              {unallocated > 0
                ? `${lang === 'zh' ? '还有' : 'Unallocated:'} RM${unallocated.toFixed(2)}`
                : `${lang === 'zh' ? '超额' : 'Over by'} RM${Math.abs(unallocated).toFixed(2)}`}
            </p>
          )}
        </div>
      </Section>

      {/* Net result */}
      <div className="bg-primary rounded-2xl px-5 py-4 text-primary-foreground text-center">
        <p className="text-xs opacity-75 mb-1">{lang === 'zh' ? '今日实际收入' : 'Actual Daily Income'}</p>
        <p className="text-4xl font-black">RM {actualIncome.toFixed(2)}</p>
      </div>

      <Button onClick={handleSave} disabled={saving} className="w-full h-12 rounded-2xl font-bold text-base bg-primary hover:bg-primary/90">
        <Save className="w-4 h-4 mr-2" />
        {saving ? '...' : (lang === 'zh' ? '保存' : 'Save Record')}
      </Button>
    </div>
  );
}

function SummaryChip({ label, value, big, green, orange }) {
  return (
    <div className={`rounded-2xl p-3 text-center ${green ? 'bg-primary/10' : orange ? 'bg-orange-50' : 'bg-card border border-border'}`}>
      <p className="text-[10px] text-muted-foreground font-medium mb-0.5">{label}</p>
      <p className={`font-extrabold ${big ? 'text-lg' : 'text-base'} ${green ? 'text-primary' : orange ? 'text-orange-600' : 'text-foreground'}`}>
        RM {(value || 0).toFixed(0)}
      </p>
    </div>
  );
}

function Section({ title, children, accent }) {
  const borderColor = accent === 'green' ? 'border-l-primary' : accent === 'orange' ? 'border-l-orange-400' : 'border-l-blue-400';
  return (
    <div className={`bg-card rounded-2xl border border-border border-l-4 ${borderColor} p-4`}>
      <p className="text-sm font-bold mb-3">{title}</p>
      {children}
    </div>
  );
}

function InputRow({ label, value, onChange }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
      <span className="text-sm text-muted-foreground w-36 shrink-0">{label}</span>
      <div className="flex items-center gap-1 flex-1 justify-end">
        <input type="number" inputMode="decimal" step="0.01" placeholder="0.00"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          className="w-24 text-right text-sm font-bold bg-transparent focus:outline-none focus:bg-secondary rounded-lg px-2 py-0.5 transition-colors" />
        <span className="text-xs text-muted-foreground w-6">RM</span>
      </div>
    </div>
  );
}

function StorageInput({ icon, label, bg, value, onChange }) {
  return (
    <div className={`${bg} rounded-xl p-3`}>
      <div className="flex items-center gap-1.5 mb-1.5">{icon}<span className="text-xs font-medium text-muted-foreground">{label}</span></div>
      <div className="flex items-center gap-1">
        <input type="number" inputMode="decimal" step="0.01" placeholder="0.00"
          value={value || ''}
          onChange={e => onChange(e.target.value)}
          className="flex-1 text-base font-bold bg-transparent focus:outline-none w-0" />
        <span className="text-xs text-muted-foreground">RM</span>
      </div>
    </div>
  );
}