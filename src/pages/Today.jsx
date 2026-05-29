import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '@/lib/i18n';
import { base44 } from '@/api/base44Client';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { formatDate } from '@/lib/finance';
import { useIncomeSources, useDeductionCategories } from '@/hooks/useCategories';
import { PA_INSURANCE_MONTHLY } from '@/lib/constants';
import AmountInput from '@/components/ui/AmountInput';
import ShidanForm from '@/components/record/ShidanForm';
import PAInsuranceField from '@/components/record/PAInsuranceField';
import { Button } from '@/components/ui/button';
import { Save, ChevronDown, ChevronUp, Landmark, Banknote, Trash2, CalendarDays } from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const TODAY = format(new Date(), 'yyyy-MM-dd');

export default function Today() {
  const { lang } = useLanguage();
  const queryClient = useQueryClient();
  const { sources, isLoading: loadingSources } = useIncomeSources();
  const { categories, isLoading: loadingCats } = useDeductionCategories();

  const urlParams = new URLSearchParams(window.location.search);
  const paramDate = urlParams.get('date');
  const paramEditId = urlParams.get('edit');

  const [selectedDate, setSelectedDate] = useState(paramDate || TODAY);
  const [data, setData] = useState({});
  const [recordId, setRecordId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [incomeOpen, setIncomeOpen] = useState(true);
  const [expenseOpen, setExpenseOpen] = useState(true);
  const [loadingRecord, setLoadingRecord] = useState(false);
  const [duplicateRecord, setDuplicateRecord] = useState(null);
  const [showDuplicateDialog, setShowDuplicateDialog] = useState(false);

  const loadRecordForDate = useCallback(async (date, forceEditId = null) => {
    setLoadingRecord(true);
    setData({});
    setRecordId(null);
    const records = await base44.entities.DailyRecord.filter({ date });
    if (records.length > 0) {
      const r = forceEditId
        ? (records.find(x => x.id === forceEditId) || records[0])
        : records[0];
      setRecordId(r.id);
      const d = {};
      Object.keys(r).forEach(k => { if (typeof r[k] === 'number') d[k] = String(r[k]); });
      if (r.expense_shidan_order_amt != null) d.expense_shidan_order_amt = String(r.expense_shidan_order_amt);
      if (r.expense_shidan_rate != null) d.expense_shidan_rate = String(r.expense_shidan_rate);
      setData(d);
    }
    setLoadingRecord(false);
  }, []);

  useEffect(() => {
    loadRecordForDate(selectedDate, paramEditId);
  }, []);

  const handleDateChange = async (newDate) => {
    setSelectedDate(newDate);
    setLoadingRecord(true);
    setData({});
    setRecordId(null);
    const records = await base44.entities.DailyRecord.filter({ date: newDate });
    if (records.length > 0) {
      const r = records[0];
      setRecordId(r.id);
      const d = {};
      Object.keys(r).forEach(k => { if (typeof r[k] === 'number') d[k] = String(r[k]); });
      if (r.expense_shidan_order_amt != null) d.expense_shidan_order_amt = String(r.expense_shidan_order_amt);
      if (r.expense_shidan_rate != null) d.expense_shidan_rate = String(r.expense_shidan_rate);
      setData(d);
    }
    setLoadingRecord(false);
  };

  const set = (key, val) => setData(p => ({ ...p, [key]: val }));

  const totalIncome = sources.reduce((s, f) => s + (parseFloat(data[f.key]) || 0), 0);
  const totalExpense = categories.reduce((s, c) => s + (parseFloat(data[c.key]) || 0), 0);
  const actualIncome = totalIncome - totalExpense;
  const bankAmt = parseFloat(data.stored_bank) || 0;
  const cashAmt = parseFloat(data.stored_cash) || 0;
  const unallocated = actualIncome - bankAmt - cashAmt;

  const buildRecord = () => {
    const record = {
      date: selectedDate,
      total_income: totalIncome,
      total_expense: totalExpense,
      actual_income: actualIncome,
    };
    sources.forEach(f => { record[f.key] = parseFloat(data[f.key]) || 0; });
    categories.forEach(c => { record[c.key] = parseFloat(data[c.key]) || 0; });
    record.expense_shidan_order_amt = parseFloat(data.expense_shidan_order_amt) || 0;
    record.expense_shidan_rate = parseFloat(data.expense_shidan_rate) || 25;
    record.stored_bank = parseFloat(data.stored_bank) || 0;
    record.stored_cash = parseFloat(data.stored_cash) || 0;
    return record;
  };

  const doSave = async (useId) => {
    setSaving(true);
    const record = buildRecord();
    queryClient.setQueryData(['dailyRecords'], (old = []) => {
      const without = old.filter(r => !(r.date === selectedDate && r.id === (useId || 'optimistic')));
      return [{ ...record, id: useId || 'optimistic' }, ...without];
    });
    if (useId) {
      await base44.entities.DailyRecord.update(useId, record);
      toast.success(lang === 'zh' ? '记录已更新' : 'Record updated');
    } else {
      const created = await base44.entities.DailyRecord.create(record);
      setRecordId(created.id);
      toast.success(lang === 'zh' ? '记录已保存' : 'Record saved');
    }
    queryClient.invalidateQueries({ queryKey: ['dailyRecords'] });
    setSaving(false);
  };

  const handleSave = async () => {
    if (!recordId) {
      const existing = await base44.entities.DailyRecord.filter({ date: selectedDate });
      if (existing.length > 0) {
        setDuplicateRecord(existing[0]);
        setShowDuplicateDialog(true);
        return;
      }
    }
    await doSave(recordId);
  };

  const handleDuplicateEditExisting = async () => {
    setShowDuplicateDialog(false);
    const r = duplicateRecord;
    setRecordId(r.id);
    const d = {};
    Object.keys(r).forEach(k => { if (typeof r[k] === 'number') d[k] = String(r[k]); });
    if (r.expense_shidan_order_amt != null) d.expense_shidan_order_amt = String(r.expense_shidan_order_amt);
    if (r.expense_shidan_rate != null) d.expense_shidan_rate = String(r.expense_shidan_rate);
    setData(d);
    setDuplicateRecord(null);
    toast(lang === 'zh' ? '已加载现有记录，请编辑后保存' : 'Existing record loaded. Edit and save.');
  };

  const handleDuplicateAddNew = async () => {
    setShowDuplicateDialog(false);
    setDuplicateRecord(null);
    await doSave(null);
  };

  const handleDelete = async () => {
    if (!recordId || !confirm(
      lang === 'zh' ? `确定删除 ${selectedDate} 的记录？` : `Delete record for ${selectedDate}?`
    )) return;
    await base44.entities.DailyRecord.delete(recordId);
    setRecordId(null);
    setData({});
    queryClient.invalidateQueries({ queryKey: ['dailyRecords'] });
    toast.success(lang === 'zh' ? '已删除' : 'Deleted');
  };

  const isToday = selectedDate === TODAY;

  if (loadingSources || loadingCats) {
    return <div className="flex items-center justify-center h-screen"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;
  }

  const regularDeductions = categories.filter(c => !c.is_shidan && !c.is_pa_insurance);
  const shidanCat = categories.find(c => c.is_shidan);
  const paCat = categories.find(c => c.is_pa_insurance);

  return (
    <div className="px-4 pt-14 pb-6 space-y-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-foreground">
            {isToday ? (lang === 'zh' ? '今日记录' : "Today's Record") : (lang === 'zh' ? '日常记录' : 'Daily Record')}
          </h1>
          <p className="text-xs text-muted-foreground">
            {format(new Date(selectedDate + 'T00:00:00'), 'EEEE')} · {formatDate(selectedDate)}
            {!isToday && <span className="ml-1 text-amber-600 font-medium">({lang === 'zh' ? '历史记录' : 'Past Date'})</span>}
          </p>
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

      {/* Date Picker */}
      <div className="bg-card rounded-2xl border border-border px-4 py-3 flex items-center gap-3">
        <CalendarDays className="w-4 h-4 text-muted-foreground shrink-0" />
        <div className="flex-1">
          <p className="text-[10px] font-semibold text-muted-foreground mb-0.5">{lang === 'zh' ? '记录日期' : 'Record Date'}</p>
          <input
            type="date"
            value={selectedDate}
            max={TODAY}
            onChange={e => e.target.value && handleDateChange(e.target.value)}
            className="bg-transparent text-sm font-bold w-full focus:outline-none cursor-pointer"
          />
        </div>
        {!isToday && (
          <button onClick={() => handleDateChange(TODAY)}
            className="text-[10px] font-semibold px-2 py-1 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors">
            {lang === 'zh' ? '今天' : 'Today'}
          </button>
        )}
      </div>

      {loadingRecord ? (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* Live summary bar */}
          <div className="bg-gradient-to-r from-primary to-primary/80 rounded-2xl p-4 text-primary-foreground">
            <div className="grid grid-cols-3 gap-2 text-center">
              <div>
                <p className="text-[10px] opacity-75 font-medium">{lang === 'zh' ? '总收入' : 'Gross'}</p>
                <p className="text-lg font-extrabold">RM {totalIncome.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[10px] opacity-75 font-medium">{lang === 'zh' ? '运营扣除' : 'Deductions'}</p>
                <p className="text-lg font-extrabold">RM {totalExpense.toFixed(2)}</p>
              </div>
              <div>
                <p className="text-[10px] opacity-75 font-medium">{lang === 'zh' ? '实际收入' : 'Actual'}</p>
                <p className="text-xl font-extrabold">RM {actualIncome.toFixed(2)}</p>
              </div>
            </div>
            <div className="mt-2 pt-2 border-t border-white/20 text-center">
              <p className="text-[10px] opacity-70">
                {lang === 'zh' ? '实际收入 = 总收入 - 运营扣除' : 'Actual Income = Gross - All Deductions'}
              </p>
            </div>
          </div>

          {/* Income Section */}
          <CollapsibleSection
            title={lang === 'zh' ? '📥 收入来源' : '📥 Daily Earnings'}
            total={totalIncome} totalColor="text-primary"
            open={incomeOpen} onToggle={() => setIncomeOpen(v => !v)}
          >
            <div className="space-y-2">
              {sources.map(f => (
                <div key={f.key} className="flex items-center gap-3 rounded-xl bg-secondary/50 px-3 py-2.5">
                  <span className={`text-xs font-bold px-2 py-1 rounded-lg min-w-[90px] text-center ${f.color || 'bg-secondary text-foreground'}`}>
                    {lang === 'zh' && f.label_zh ? f.label_zh : f.label}
                  </span>
                  <AmountInput value={data[f.key] || ''} onChange={v => set(f.key, v)} />
                  <span className="text-xs text-muted-foreground font-medium shrink-0">RM</span>
                </div>
              ))}
            </div>
          </CollapsibleSection>

          {/* Deductions Section */}
          <CollapsibleSection
            title={lang === 'zh' ? '📤 存入前扣除（运营成本）' : '📤 Deductions Before Saving'}
            total={totalExpense} totalColor="text-destructive" totalPrefix="- "
            open={expenseOpen} onToggle={() => setExpenseOpen(v => !v)}
          >
            <div className="space-y-2">
              {regularDeductions.map(c => (
                <div key={c.key} className="flex items-center gap-3 rounded-xl bg-secondary/50 px-3 py-2.5">
                  <span className={`text-xs font-bold px-2 py-1 rounded-lg min-w-[90px] text-center ${c.color || 'bg-secondary text-foreground'}`}>
                    {lang === 'zh' && c.label_zh ? c.label_zh : c.label}
                  </span>
                  <AmountInput value={data[c.key] || ''} onChange={v => set(c.key, v)} />
                  <span className="text-xs text-muted-foreground font-medium shrink-0">RM</span>
                </div>
              ))}
              {shidanCat && <ShidanForm data={data} set={set} />}
              {paCat && (
                <PAInsuranceField
                  value={data[paCat.key] || '0'}
                  onChange={v => set(paCat.key, v)}
                  fixedAmount={paCat.fixed_amount || PA_INSURANCE_MONTHLY}
                />
              )}
            </div>
            <div className="mt-3 bg-destructive/5 border border-destructive/15 rounded-xl p-3">
              <p className="text-xs font-semibold text-muted-foreground mb-2">{lang === 'zh' ? '扣除明细' : 'Deduction Breakdown'}</p>
              <div className="space-y-1">
                {categories
                  .map(c => ({ label: (lang === 'zh' && c.label_zh) ? c.label_zh : c.label, val: parseFloat(data[c.key]) || 0 }))
                  .filter(i => i.val > 0)
                  .map(i => (
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

          {/* Store Income */}
          <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold">{lang === 'zh' ? '存入银行 / 现金' : 'Store to Bank / Cash'}</h3>
                <p className="text-xs text-muted-foreground">{lang === 'zh' ? `可存入: RM${actualIncome.toFixed(2)}` : `Available: RM${actualIncome.toFixed(2)}`}</p>
              </div>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-lg ${
                Math.abs(unallocated) < 0.01 ? 'bg-primary/10 text-primary'
                : unallocated < 0 ? 'bg-destructive/10 text-destructive'
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
              <StorageField icon={<Landmark className="w-4 h-4 text-blue-500" />} label={lang === 'zh' ? '银行' : 'Bank'} bg="bg-blue-50" value={data.stored_bank || ''} onChange={v => set('stored_bank', v)} />
              <StorageField icon={<Banknote className="w-4 h-4 text-amber-500" />} label={lang === 'zh' ? '现金' : 'Cash'} bg="bg-amber-50" value={data.stored_cash || ''} onChange={v => set('stored_cash', v)} />
            </div>
            <div className="flex gap-2">
              {[
                { label: lang === 'zh' ? '全存银行' : 'All Bank', bank: actualIncome, cash: 0 },
                { label: lang === 'zh' ? '全用现金' : 'All Cash', bank: 0, cash: actualIncome },
                { label: '50/50', bank: actualIncome / 2, cash: actualIncome / 2 },
              ].map(opt => (
                <button key={opt.label} onClick={() => { set('stored_bank', opt.bank.toFixed(2)); set('stored_cash', opt.cash.toFixed(2)); }}
                  className="flex-1 text-xs font-semibold py-2 rounded-xl border border-border bg-secondary hover:bg-border transition-colors">
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <Button onClick={handleSave} disabled={saving} className="w-full h-12 rounded-2xl font-bold text-base bg-primary hover:bg-primary/90">
            <Save className="w-4 h-4 mr-2" />
            {saving ? '...' : recordId
              ? (lang === 'zh' ? '更新记录' : 'Update Record')
              : (lang === 'zh' ? '保存记录' : 'Save Record')}
          </Button>
        </>
      )}

      {/* Duplicate Date Dialog */}
      <AnimatePresence>
        {showDuplicateDialog && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-6"
            onClick={() => setShowDuplicateDialog(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="bg-background rounded-2xl p-6 w-full max-w-sm shadow-2xl space-y-4"
              onClick={e => e.stopPropagation()}>
              <div>
                <p className="font-bold text-sm">
                  {lang === 'zh' ? '此日期已有记录' : 'Record Already Exists'}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {lang === 'zh'
                    ? `${selectedDate} 已有一条记录。您要如何处理？`
                    : `${selectedDate} already has a record. What would you like to do?`}
                </p>
              </div>
              <div className="space-y-2">
                <Button onClick={handleDuplicateEditExisting} className="w-full h-11 rounded-xl font-semibold bg-primary">
                  {lang === 'zh' ? '编辑现有记录' : 'Edit Existing Record'}
                </Button>
                <Button variant="outline" onClick={handleDuplicateAddNew} className="w-full h-11 rounded-xl font-semibold">
                  {lang === 'zh' ? '添加新记录' : 'Add Another Record'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
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