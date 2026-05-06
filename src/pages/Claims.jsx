import React, { useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { CLAIM_CATEGORIES } from '@/lib/constants';
import { Plus, Landmark, Banknote, ChevronRight, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

const TODAY = format(new Date(), 'yyyy-MM-dd');
const THIS_MONTH = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

const STATUS_CONFIG = {
  to_be_claimed: { label: 'To Be Claimed', labelZh: '待报销', color: 'bg-amber-50 text-amber-600' },
  claimed:       { label: 'Claimed',        labelZh: '已报销', color: 'bg-primary/10 text-primary' },
  not_claimable: { label: 'Not Claimable',  labelZh: '不可报销', color: 'bg-destructive/10 text-destructive' },
};

const emptyForm = () => ({
  title: '', amount: '', date_paid: TODAY, paid_from: 'cash',
  category: 'other', expected_claim_month: THIS_MONTH,
  claim_status: 'to_be_claimed', notes: '',
});

export default function Claims() {
  const { lang } = useLanguage();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const { data: claims = [] } = useQuery({
    queryKey: ['claims'],
    queryFn: () => base44.entities.Claim.list('-date_paid', 100),
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const openAdd = () => { setForm(emptyForm()); setEditItem(null); setShowForm(true); };
  const openEdit = (c) => {
    setForm({ title: c.title, amount: String(c.amount), date_paid: c.date_paid, paid_from: c.paid_from, category: c.category, expected_claim_month: c.expected_claim_month || THIS_MONTH, claim_status: c.claim_status, notes: c.notes || '' });
    setEditItem(c);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.amount) return toast.error(lang === 'zh' ? '请填写必填项' : 'Fill required fields');
    setSaving(true);
    const record = { ...form, amount: parseFloat(form.amount) || 0 };
    if (editItem) {
      await base44.entities.Claim.update(editItem.id, record);
      toast.success(lang === 'zh' ? '已更新' : 'Updated');
    } else {
      await base44.entities.Claim.create(record);
      toast.success(lang === 'zh' ? '已添加' : 'Added');
    }
    queryClient.invalidateQueries({ queryKey: ['claims'] });
    setSaving(false);
    setShowForm(false);
  };

  const handleDelete = async (id) => {
    if (!confirm(lang === 'zh' ? '确定删除？' : 'Delete this claim?')) return;
    await base44.entities.Claim.delete(id);
    queryClient.invalidateQueries({ queryKey: ['claims'] });
    toast.success(lang === 'zh' ? '已删除' : 'Deleted');
  };

  const pending = claims.filter(c => c.claim_status === 'to_be_claimed');
  const received = claims.filter(c => c.claim_status === 'claimed');
  const thisMonth = claims.filter(c => c.date_paid?.startsWith(THIS_MONTH.substring(0, 7)));

  const sumAmt = arr => arr.reduce((s, c) => s + (c.amount || 0), 0);

  return (
    <div className="px-4 pt-14 pb-6 space-y-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">{lang === 'zh' ? '报销记录' : 'Claims'}</h1>
        <Button onClick={openAdd} size="sm" className="h-9 rounded-xl font-semibold bg-primary">
          <Plus className="w-4 h-4 mr-1" />{lang === 'zh' ? '添加' : 'Add'}
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: lang === 'zh' ? '本月支出' : 'Paid This Month', val: sumAmt(thisMonth), color: 'text-foreground' },
          { label: lang === 'zh' ? '待报销' : 'Pending', val: sumAmt(pending), color: 'text-amber-600' },
          { label: lang === 'zh' ? '已收回' : 'Received', val: sumAmt(received), color: 'text-primary' },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-2xl border border-border p-3 text-center">
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
            <p className={`text-sm font-extrabold ${s.color}`}>RM {s.val.toFixed(0)}</p>
          </div>
        ))}
      </div>

      {/* Claims list */}
      <div className="space-y-2">
        {claims.length === 0 && <p className="text-center text-muted-foreground text-sm py-8">{lang === 'zh' ? '暂无报销记录' : 'No claims yet'}</p>}
        {claims.map(c => {
          const sc = STATUS_CONFIG[c.claim_status] || STATUS_CONFIG.to_be_claimed;
          const cat = CLAIM_CATEGORIES.find(x => x.key === c.category);
          return (
            <motion.div key={c.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
              className="bg-card rounded-2xl border border-border p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold">{c.title}</p>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-lg ${sc.color}`}>
                      {lang === 'zh' ? sc.labelZh : sc.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-muted-foreground">{c.date_paid}</span>
                    {cat && <span className="text-xs text-muted-foreground">· {lang === 'zh' ? cat.labelZh : cat.label}</span>}
                    <span className="text-xs flex items-center gap-0.5 text-muted-foreground">
                      · {c.paid_from === 'bank' ? <Landmark className="w-3 h-3" /> : <Banknote className="w-3 h-3" />} {c.paid_from}
                    </span>
                  </div>
                  {c.notes && <p className="text-xs text-muted-foreground mt-1 italic">{c.notes}</p>}
                </div>
                <div className="flex items-center gap-2 ml-2">
                  <span className="text-base font-extrabold">RM {(c.amount || 0).toFixed(2)}</span>
                  <button onClick={() => openEdit(c)} className="p-1 text-muted-foreground hover:text-primary transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Form Drawer */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setShowForm(false)}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-background w-full max-w-lg mx-auto rounded-t-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold">{editItem ? (lang === 'zh' ? '编辑报销' : 'Edit Claim') : (lang === 'zh' ? '添加报销' : 'Add Claim')}</h2>
                <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
              </div>
              <FormField label={lang === 'zh' ? '标题 *' : 'Title *'}>
                <input value={form.title} onChange={e => set('title', e.target.value)} placeholder={lang === 'zh' ? '报销名称' : 'Claim title'} className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary" />
              </FormField>
              <FormField label={lang === 'zh' ? '金额 (RM) *' : 'Amount (RM) *'}>
                <input type="number" inputMode="decimal" value={form.amount} onChange={e => set('amount', e.target.value)} placeholder="0.00" className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-primary" />
              </FormField>
              <div className="grid grid-cols-2 gap-3">
                <FormField label={lang === 'zh' ? '支付日期' : 'Date Paid'}>
                  <input type="date" value={form.date_paid} onChange={e => set('date_paid', e.target.value)} className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                </FormField>
                <FormField label={lang === 'zh' ? '支付方式' : 'Paid From'}>
                  <select value={form.paid_from} onChange={e => set('paid_from', e.target.value)} className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                    <option value="bank">{lang === 'zh' ? '银行' : 'Bank'}</option>
                    <option value="cash">{lang === 'zh' ? '现金' : 'Cash'}</option>
                  </select>
                </FormField>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <FormField label={lang === 'zh' ? '类别' : 'Category'}>
                  <select value={form.category} onChange={e => set('category', e.target.value)} className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                    {CLAIM_CATEGORIES.map(c => <option key={c.key} value={c.key}>{lang === 'zh' ? c.labelZh : c.label}</option>)}
                  </select>
                </FormField>
                <FormField label={lang === 'zh' ? '状态' : 'Status'}>
                  <select value={form.claim_status} onChange={e => set('claim_status', e.target.value)} className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                    <option value="to_be_claimed">{lang === 'zh' ? '待报销' : 'To Be Claimed'}</option>
                    <option value="claimed">{lang === 'zh' ? '已报销' : 'Claimed'}</option>
                    <option value="not_claimable">{lang === 'zh' ? '不可报销' : 'Not Claimable'}</option>
                  </select>
                </FormField>
              </div>
              <FormField label={lang === 'zh' ? '预计报销月份' : 'Expected Claim Month'}>
                <input type="month" value={form.expected_claim_month} onChange={e => set('expected_claim_month', e.target.value)} className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
              </FormField>
              <FormField label={lang === 'zh' ? '备注' : 'Notes'}>
                <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} placeholder={lang === 'zh' ? '可选备注...' : 'Optional notes...'} className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
              </FormField>
              <div className="flex gap-3">
                {editItem && (
                  <Button variant="outline" onClick={() => handleDelete(editItem.id)} className="h-11 rounded-xl text-destructive border-destructive/30 hover:bg-destructive/10">
                    {lang === 'zh' ? '删除' : 'Delete'}
                  </Button>
                )}
                <Button onClick={handleSave} disabled={saving} className="flex-1 h-11 rounded-xl font-bold bg-primary">
                  {saving ? '...' : (lang === 'zh' ? '保存' : 'Save')}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function FormField({ label, children }) {
  return (
    <div>
      <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}