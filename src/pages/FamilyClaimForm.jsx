import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const TODAY = format(new Date(), 'yyyy-MM-dd');
const THIS_MONTH = TODAY.substring(0, 7);

const CATEGORIES = [
  { key: 'medical',    label: 'Medical',    labelZh: '医疗' },
  { key: 'food',       label: 'Food',       labelZh: '餐饮' },
  { key: 'utilities',  label: 'Utilities',  labelZh: '水电' },
  { key: 'transport',  label: 'Transport',  labelZh: '交通' },
  { key: 'groceries',  label: 'Groceries',  labelZh: '杂货' },
  { key: 'repair',     label: 'Repair',     labelZh: '维修' },
  { key: 'other',      label: 'Other',      labelZh: '其他' },
];

const PAID_FROM = [
  { key: 'cash',        label: 'Cash',        labelZh: '现金' },
  { key: 'bank',        label: 'Bank',        labelZh: '银行' },
  { key: 'ewallet',     label: 'E-wallet',    labelZh: '电子钱包' },
  { key: 'credit_card', label: 'Credit Card', labelZh: '信用卡' },
];

const emptyForm = (mStr) => ({
  title: '', amount: '', claim_by: '', category: 'other',
  date_paid: TODAY, month: mStr || THIS_MONTH, paid_from: 'cash',
  status: 'pending', reimbursed_date: '', notes: '',
});

export default function FamilyClaimForm() {
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const editId = searchParams.get('id') || null;
  const defaultMonth = searchParams.get('month') || THIS_MONTH;

  const [form, setForm] = useState(emptyForm(defaultMonth));
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(!editId);

  useEffect(() => {
    if (editId) {
      base44.entities.FamilyClaim.list('-date_paid', 200).then(all => {
        const c = all.find(x => x.id === editId);
        if (c) {
          setForm({
            title: c.title || '', amount: String(c.amount || ''), claim_by: c.claim_by || '',
            category: c.category || 'other', date_paid: c.date_paid || TODAY,
            month: c.month || defaultMonth, paid_from: c.paid_from || 'cash',
            status: c.status || 'pending', reimbursed_date: c.reimbursed_date || '',
            notes: c.notes || '',
          });
        }
        setLoaded(true);
      });
    }
  }, [editId]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.title || !form.amount || !form.claim_by) {
      toast.error(lang === 'zh' ? '请填写标题、金额和报销人' : 'Fill in title, amount, and claimant');
      return;
    }
    setSaving(true);
    const record = { ...form, amount: parseFloat(form.amount) || 0 };
    if (editId) {
      await base44.entities.FamilyClaim.update(editId, record);
      toast.success(lang === 'zh' ? '已更新' : 'Updated');
    } else {
      await base44.entities.FamilyClaim.create(record);
      toast.success(lang === 'zh' ? '已添加' : 'Added');
    }
    queryClient.invalidateQueries({ queryKey: ['familyClaims'] });
    setSaving(false);
    navigate('/bills?tab=claims');
  };

  const handleDelete = async () => {
    if (!confirm(lang === 'zh' ? '确定删除？' : 'Delete this claim?')) return;
    await base44.entities.FamilyClaim.delete(editId);
    queryClient.invalidateQueries({ queryKey: ['familyClaims'] });
    toast.success(lang === 'zh' ? '已删除' : 'Deleted');
    navigate('/bills?tab=claims');
  };

  if (!loaded) return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-lg mx-auto">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/bills?tab=claims')} className="p-2 rounded-xl hover:bg-secondary transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold flex-1">
          {editId ? (lang === 'zh' ? '编辑报销记录' : 'Edit Claim') : (lang === 'zh' ? '添加报销记录' : 'Add Claim')}
        </h1>
        {editId && (
          <button onClick={handleDelete} className="p-2 rounded-xl text-destructive hover:bg-destructive/10 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Scrollable Form */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-28">

        <F label={lang === 'zh' ? '标题 *' : 'Title *'}>
          <input value={form.title} onChange={e => set('title', e.target.value)}
            placeholder={lang === 'zh' ? '报销名称' : 'Claim title'}
            className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary" />
        </F>

        <div className="grid grid-cols-2 gap-3">
          <F label={lang === 'zh' ? '金额 (RM) *' : 'Amount (RM) *'}>
            <input type="number" inputMode="decimal" value={form.amount}
              onChange={e => set('amount', e.target.value)} placeholder="0.00"
              className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary" />
          </F>
          <F label={lang === 'zh' ? '报销人 *' : 'Claim By *'}>
            <input value={form.claim_by} onChange={e => set('claim_by', e.target.value)}
              placeholder={lang === 'zh' ? '姓名' : 'Name'}
              className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary" />
          </F>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <F label={lang === 'zh' ? '支付日期' : 'Date Paid'}>
            <input type="date" value={form.date_paid} onChange={e => set('date_paid', e.target.value)}
              className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </F>
          <F label={lang === 'zh' ? '报销月份' : 'Claim Month'}>
            <input type="month" value={form.month} onChange={e => set('month', e.target.value)}
              className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </F>
        </div>

        <F label={lang === 'zh' ? '类别' : 'Category'}>
          <div className="grid grid-cols-4 gap-1.5">
            {CATEGORIES.map(c => (
              <button key={c.key} onClick={() => set('category', c.key)}
                className={`py-2 rounded-xl text-xs font-semibold border transition-all ${form.category === c.key ? 'bg-primary/10 border-primary text-primary' : 'bg-secondary border-transparent text-muted-foreground'}`}>
                {lang === 'zh' ? c.labelZh : c.label}
              </button>
            ))}
          </div>
        </F>

        <F label={lang === 'zh' ? '支付方式' : 'Paid From'}>
          <div className="grid grid-cols-4 gap-1.5">
            {PAID_FROM.map(p => (
              <button key={p.key} onClick={() => set('paid_from', p.key)}
                className={`py-2 rounded-xl text-xs font-semibold border transition-all ${form.paid_from === p.key ? 'bg-primary/10 border-primary text-primary' : 'bg-secondary border-transparent text-muted-foreground'}`}>
                {lang === 'zh' ? p.labelZh : p.label}
              </button>
            ))}
          </div>
        </F>

        <F label={lang === 'zh' ? '状态' : 'Status'}>
          <div className="flex gap-2">
            {[['pending', lang === 'zh' ? '待报销' : 'Pending'], ['reimbursed', lang === 'zh' ? '已报销' : 'Reimbursed']].map(([k, l]) => (
              <button key={k} onClick={() => set('status', k)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all ${form.status === k ? 'bg-primary/10 border-primary text-primary' : 'bg-secondary border-transparent text-muted-foreground'}`}>
                {l}
              </button>
            ))}
          </div>
        </F>

        {form.status === 'reimbursed' && (
          <F label={lang === 'zh' ? '报销日期' : 'Reimbursement Date'}>
            <input type="date" value={form.reimbursed_date} onChange={e => set('reimbursed_date', e.target.value)}
              className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </F>
        )}

        <F label={lang === 'zh' ? '备注' : 'Notes'}>
          <input value={form.notes} onChange={e => set('notes', e.target.value)}
            placeholder={lang === 'zh' ? '可选备注' : 'Optional notes'}
            className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </F>
      </div>

      {/* Sticky Save Button */}
      <div className="sticky bottom-0 bg-background border-t border-border px-4 py-4">
        <Button onClick={handleSave} disabled={saving} className="w-full h-12 rounded-2xl font-bold text-base bg-primary">
          {saving ? '...' : (lang === 'zh' ? '保存' : 'Save')}
        </Button>
      </div>
    </div>
  );
}

function F({ label, children }) {
  return (
    <div>
      <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}