import React, { useState, useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { X } from 'lucide-react';
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

export default function BillFormDrawer({ open, onClose, editBill, lang, onSaved }) {
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (editBill) setForm({ ...emptyForm(), ...editBill, default_amount: String(editBill.default_amount || ''), due_day: String(editBill.due_day || '') });
    else setForm(emptyForm());
  }, [editBill, open]);

  if (!open) return null;

  const handleSave = async () => {
    if (!form.name) return toast.error(lang === 'zh' ? '请输入账单名称' : 'Name required');
    setSaving(true);
    const record = { ...form, default_amount: parseFloat(form.default_amount) || 0, due_day: parseInt(form.due_day) || null };
    if (editBill?.id) await base44.entities.HouseholdBill.update(editBill.id, record);
    else await base44.entities.HouseholdBill.create({ ...record, sort_order: 99 });
    setSaving(false);
    toast.success(lang === 'zh' ? '已保存' : 'Saved');
    onSaved();
  };

  const handleDelete = async () => {
    if (!editBill?.id || !confirm(lang === 'zh' ? '确定删除此账单模板？' : 'Delete this bill template?')) return;
    await base44.entities.HouseholdBill.delete(editBill.id);
    toast.success(lang === 'zh' ? '已删除' : 'Deleted');
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={onClose}>
      <div className="bg-background w-full max-w-lg mx-auto rounded-t-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">{editBill ? (lang === 'zh' ? '编辑账单模板' : 'Edit Bill') : (lang === 'zh' ? '新增账单模板' : 'New Bill')}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{lang === 'zh' ? '账单名称 *' : 'Bill Name *'}</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
              className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{lang === 'zh' ? '类别' : 'Category'}</label>
            <div className="grid grid-cols-4 gap-1.5">
              {CATEGORIES.map(c => (
                <button key={c.key} onClick={() => setForm(p => ({ ...p, category: c.key }))}
                  className={`py-1.5 rounded-xl text-xs font-semibold border transition-all ${form.category === c.key ? 'bg-primary/10 border-primary text-primary' : 'bg-secondary border-transparent text-muted-foreground'}`}>
                  {lang === 'zh' ? c.labelZh : c.label}
                </button>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{lang === 'zh' ? '默认金额 (RM)' : 'Default Amount (RM)'}</label>
              <input type="number" inputMode="decimal" value={form.default_amount} onChange={e => setForm(p => ({ ...p, default_amount: e.target.value }))}
                placeholder="0.00" className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{lang === 'zh' ? '每月到期日' : 'Due Day (of month)'}</label>
              <input type="number" inputMode="numeric" min="1" max="31" value={form.due_day} onChange={e => setForm(p => ({ ...p, due_day: e.target.value }))}
                placeholder="e.g. 15" className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-primary" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{lang === 'zh' ? '母亲共同基金' : 'Shared Family Fund'}</span>
            <button onClick={() => setForm(p => ({ ...p, is_shared_family: !p.is_shared_family }))}
              className={`w-12 h-6 rounded-full transition-colors ${form.is_shared_family ? 'bg-purple-500' : 'bg-muted'}`}>
              <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform mx-0.5 ${form.is_shared_family ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{lang === 'zh' ? '启用' : 'Active'}</span>
            <button onClick={() => setForm(p => ({ ...p, is_active: !p.is_active }))}
              className={`w-12 h-6 rounded-full transition-colors ${form.is_active ? 'bg-primary' : 'bg-muted'}`}>
              <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform mx-0.5 ${form.is_active ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{lang === 'zh' ? '备注' : 'Notes'}</label>
            <input value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </div>
        </div>
        <div className="flex gap-3">
          {editBill?.id && (
            <Button variant="outline" onClick={handleDelete} className="h-11 rounded-xl text-destructive border-destructive/30 hover:bg-destructive/10">
              {lang === 'zh' ? '删除' : 'Delete'}
            </Button>
          )}
          <Button onClick={handleSave} disabled={saving} className="flex-1 h-11 rounded-xl font-bold bg-primary">
            {saving ? '...' : (lang === 'zh' ? '保存' : 'Save')}
          </Button>
        </div>
      </div>
    </div>
  );
}