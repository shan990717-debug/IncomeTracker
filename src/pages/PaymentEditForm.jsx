import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  labelZh: '待付',   bg: 'bg-amber-50',   text: 'text-amber-600',   border: 'border-amber-200' },
  paid:     { label: 'Paid',     labelZh: '已付',   bg: 'bg-blue-50',    text: 'text-blue-600',    border: 'border-blue-200' },
  settled:  { label: 'Settled',  labelZh: '已结',   bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
  overdue:  { label: 'Overdue',  labelZh: '逾期',   bg: 'bg-red-50',     text: 'text-red-600',     border: 'border-red-200' },
};

export default function PaymentEditForm() {
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const editId = searchParams.get('id');
  const isNew = searchParams.get('new') === '1';
  const defaultMonth = searchParams.get('month') || '';
  const defaultSection = searchParams.get('section') || 'others';

  const [form, setForm] = useState({
    bill_name: '', amount: '0', payment_date: '', due_date: '',
    status: 'pending', is_settled: false, remark: '',
    section: defaultSection, month: defaultMonth,
  });
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(isNew);

  useEffect(() => {
    if (editId && !isNew) {
      base44.entities.BillPayment.list('-created_date', 200).then(all => {
        const p = all.find(x => x.id === editId);
        if (p) {
          setForm({
            bill_name: p.bill_name || '',
            amount: String(p.amount || 0),
            payment_date: p.payment_date || '',
            due_date: p.due_date || '',
            status: p.status || 'pending',
            is_settled: p.is_settled || false,
            remark: p.remark || '',
            section: p.section || 'household',
            month: p.month || defaultMonth,
          });
        }
        setLoaded(true);
      });
    }
  }, [editId]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    setSaving(true);
    const record = { ...form, amount: parseFloat(form.amount) || 0 };
    if (isNew) {
      await base44.entities.BillPayment.create(record);
    } else {
      await base44.entities.BillPayment.update(editId, record);
    }
    queryClient.invalidateQueries({ queryKey: ['billPayments'] });
    toast.success(lang === 'zh' ? '已保存' : 'Saved');
    navigate('/bills');
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
        <button onClick={() => navigate('/bills')} className="p-2 rounded-xl hover:bg-secondary transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold flex-1">
          {isNew ? (lang === 'zh' ? '添加支出' : 'Add Expense') : (lang === 'zh' ? '编辑账单' : 'Edit Bill')}
        </h1>
      </div>

      {/* Scrollable Form */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 pb-32">
        <FormRow label={lang === 'zh' ? '账单名称' : 'Bill Name'}>
          <input value={form.bill_name} onChange={e => set('bill_name', e.target.value)}
            className="w-full bg-secondary rounded-xl px-3 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary" />
        </FormRow>

        <FormRow label={lang === 'zh' ? '金额 (RM)' : 'Amount (RM)'}>
          <input type="number" inputMode="decimal" value={form.amount} onChange={e => set('amount', e.target.value)}
            className="w-full bg-secondary rounded-xl px-3 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary" />
        </FormRow>

        <div className="grid grid-cols-2 gap-3">
          <FormRow label={lang === 'zh' ? '到期日' : 'Due Date'}>
            <input type="date" value={form.due_date} onChange={e => set('due_date', e.target.value)}
              className="w-full bg-secondary rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </FormRow>
          <FormRow label={lang === 'zh' ? '付款日期' : 'Payment Date'}>
            <input type="date" value={form.payment_date} onChange={e => set('payment_date', e.target.value)}
              className="w-full bg-secondary rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </FormRow>
        </div>

        <FormRow label={lang === 'zh' ? '状态' : 'Status'}>
          <div className="flex gap-2 flex-wrap">
            {Object.entries(STATUS_CONFIG).map(([k, s]) => (
              <button key={k} onClick={() => set('status', k)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold border transition-all ${form.status === k ? `${s.bg} ${s.text} ${s.border}` : 'bg-secondary border-transparent text-muted-foreground'}`}>
                {lang === 'zh' ? s.labelZh : s.label}
              </button>
            ))}
          </div>
        </FormRow>

        <FormRow label={lang === 'zh' ? '类别' : 'Section'}>
          <div className="flex gap-2">
            {[['household', lang === 'zh' ? '家庭账单' : 'Household'], ['others', lang === 'zh' ? '其他支出' : 'Others']].map(([k, l]) => (
              <button key={k} onClick={() => set('section', k)}
                className={`flex-1 py-2.5 rounded-xl text-xs font-semibold border transition-all ${form.section === k ? 'bg-primary/10 border-primary text-primary' : 'bg-secondary border-transparent text-muted-foreground'}`}>
                {l}
              </button>
            ))}
          </div>
        </FormRow>

        <div className="flex items-center justify-between bg-card border border-border rounded-xl px-4 py-3">
          <span className="text-sm font-semibold">{lang === 'zh' ? '已结清' : 'Settled'}</span>
          <button onClick={() => set('is_settled', !form.is_settled)}
            className={`w-12 h-6 rounded-full transition-colors ${form.is_settled ? 'bg-emerald-500' : 'bg-muted'}`}>
            <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform mx-0.5 ${form.is_settled ? 'translate-x-6' : 'translate-x-0'}`} />
          </button>
        </div>

        <FormRow label={lang === 'zh' ? '备注' : 'Remark'}>
          <input value={form.remark} onChange={e => set('remark', e.target.value)}
            className="w-full bg-secondary rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </FormRow>
      </div>

      {/* Sticky Bottom Save Button */}
      <div className="sticky bottom-0 bg-background border-t border-border px-4 py-4">
        <Button onClick={handleSave} disabled={saving} className="w-full h-12 rounded-2xl font-bold text-base bg-primary">
          {saving ? '...' : (lang === 'zh' ? '保存' : 'Save')}
        </Button>
      </div>
    </div>
  );
}

function FormRow({ label, children }) {
  return (
    <div>
      <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}