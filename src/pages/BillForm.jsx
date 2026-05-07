import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/i18n';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const CATEGORIES = [
  { key: 'telco',      label: 'Telco',      labelZh: '电讯' },
  { key: 'utilities',  label: 'Utilities',  labelZh: '水电' },
  { key: 'loan',       label: 'Loan',       labelZh: '贷款' },
  { key: 'insurance',  label: 'Insurance',  labelZh: '保险' },
  { key: 'allowance',  label: 'Allowance',  labelZh: '零用钱' },
  { key: 'management', label: 'Management', labelZh: '管理费' },
  { key: 'others',     label: 'Others',     labelZh: '其他' },
];

const emptyForm = () => ({ name: '', category: 'others', default_amount: '', due_day: '', is_active: true, is_shared_family: false, notes: '' });

export default function BillForm() {
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const editId = searchParams.get('id');

  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(!editId);

  useEffect(() => {
    if (editId) {
      base44.entities.HouseholdBill.filter({ id: editId }).then(results => {
        // fallback: list and find
        base44.entities.HouseholdBill.list('sort_order', 50).then(all => {
          const bill = all.find(b => b.id === editId);
          if (bill) {
            setForm({ ...emptyForm(), ...bill, default_amount: String(bill.default_amount || ''), due_day: String(bill.due_day || '') });
          }
          setLoaded(true);
        });
      }).catch(() => setLoaded(true));
    }
  }, [editId]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.name) return toast.error(lang === 'zh' ? '请输入账单名称' : 'Name required');
    setSaving(true);
    const record = { ...form, default_amount: parseFloat(form.default_amount) || 0, due_day: parseInt(form.due_day) || null };
    if (editId) {
      await base44.entities.HouseholdBill.update(editId, record);
    } else {
      await base44.entities.HouseholdBill.create({ ...record, sort_order: 99 });
    }
    queryClient.invalidateQueries({ queryKey: ['householdBills'] });
    toast.success(lang === 'zh' ? '已保存' : 'Saved');
    navigate('/bills');
  };

  const handleDelete = async () => {
    if (!editId || !confirm(lang === 'zh' ? '确定删除此账单模板？' : 'Delete this bill template?')) return;
    await base44.entities.HouseholdBill.delete(editId);
    queryClient.invalidateQueries({ queryKey: ['householdBills'] });
    toast.success(lang === 'zh' ? '已删除' : 'Deleted');
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
          {editId ? (lang === 'zh' ? '编辑账单模板' : 'Edit Bill') : (lang === 'zh' ? '新增账单模板' : 'New Bill')}
        </h1>
        {editId && (
          <button onClick={handleDelete} className="p-2 rounded-xl text-destructive hover:bg-destructive/10 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Scrollable Form */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 pb-32">
        <FormRow label={lang === 'zh' ? '账单名称 *' : 'Bill Name *'}>
          <input value={form.name} onChange={e => set('name', e.target.value)}
            className="w-full bg-secondary rounded-xl px-3 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary" />
        </FormRow>

        <FormRow label={lang === 'zh' ? '类别' : 'Category'}>
          <div className="grid grid-cols-4 gap-1.5">
            {CATEGORIES.map(c => (
              <button key={c.key} onClick={() => set('category', c.key)}
                className={`py-2 rounded-xl text-xs font-semibold border transition-all ${form.category === c.key ? 'bg-primary/10 border-primary text-primary' : 'bg-secondary border-transparent text-muted-foreground'}`}>
                {lang === 'zh' ? c.labelZh : c.label}
              </button>
            ))}
          </div>
        </FormRow>

        <div className="grid grid-cols-2 gap-3">
          <FormRow label={lang === 'zh' ? '默认金额 (RM)' : 'Default Amount (RM)'}>
            <input type="number" inputMode="decimal" value={form.default_amount} onChange={e => set('default_amount', e.target.value)}
              placeholder="0.00" className="w-full bg-secondary rounded-xl px-3 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary" />
          </FormRow>
          <FormRow label={lang === 'zh' ? '每月到期日' : 'Due Day'}>
            <input type="number" inputMode="numeric" min="1" max="31" value={form.due_day} onChange={e => set('due_day', e.target.value)}
              placeholder="e.g. 15" className="w-full bg-secondary rounded-xl px-3 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary" />
          </FormRow>
        </div>

        <FormRow label={lang === 'zh' ? '备注' : 'Notes'}>
          <input value={form.notes} onChange={e => set('notes', e.target.value)}
            className="w-full bg-secondary rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
        </FormRow>

        <div className="bg-card rounded-2xl border border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{lang === 'zh' ? '母亲共同基金' : 'Shared Family Fund'}</span>
            <button onClick={() => set('is_shared_family', !form.is_shared_family)}
              className={`w-12 h-6 rounded-full transition-colors ${form.is_shared_family ? 'bg-purple-500' : 'bg-muted'}`}>
              <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform mx-0.5 ${form.is_shared_family ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{lang === 'zh' ? '启用' : 'Active'}</span>
            <button onClick={() => set('is_active', !form.is_active)}
              className={`w-12 h-6 rounded-full transition-colors ${form.is_active ? 'bg-primary' : 'bg-muted'}`}>
              <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform mx-0.5 ${form.is_active ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>
        </div>
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