import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Plus, X, Pencil, Trash2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const TODAY = format(new Date(), 'yyyy-MM-dd');

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
  date_paid: TODAY, month: mStr, paid_from: 'cash',
  status: 'pending', reimbursed_date: '', notes: '',
});

export default function FamilyClaimsSection({ lang, mStr }) {
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState(emptyForm(mStr));

  const { data: allClaims = [] } = useQuery({
    queryKey: ['familyClaims'],
    queryFn: () => base44.entities.FamilyClaim.list('-date_paid', 200),
  });

  const monthClaims = allClaims.filter(c => c.month === mStr);
  const monthTotal = monthClaims.reduce((s, c) => s + (c.amount || 0), 0);
  const pendingTotal = monthClaims.filter(c => c.status === 'pending').reduce((s, c) => s + (c.amount || 0), 0);
  const reimbursedTotal = monthClaims.filter(c => c.status === 'reimbursed').reduce((s, c) => s + (c.amount || 0), 0);

  // Group by person
  const byPerson = monthClaims.reduce((acc, c) => {
    const name = c.claim_by || '—';
    if (!acc[name]) acc[name] = 0;
    acc[name] += c.amount || 0;
    return acc;
  }, {});

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['familyClaims'] });
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const openAdd = () => {
    setEditId(null);
    setForm(emptyForm(mStr));
    setShowForm(true);
  };

  const openEdit = (c) => {
    setEditId(c.id);
    setForm({
      title: c.title || '', amount: String(c.amount || ''), claim_by: c.claim_by || '',
      category: c.category || 'other', date_paid: c.date_paid || TODAY, month: c.month || mStr,
      paid_from: c.paid_from || 'cash', status: c.status || 'pending',
      reimbursed_date: c.reimbursed_date || '', notes: c.notes || '',
    });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.title || !form.amount || !form.claim_by) {
      toast.error(lang === 'zh' ? '请填写标题、金额和报销人' : 'Fill in title, amount, and claimant');
      return;
    }
    const record = { ...form, amount: parseFloat(form.amount) || 0 };
    if (editId) {
      await base44.entities.FamilyClaim.update(editId, record);
      toast.success(lang === 'zh' ? '已更新' : 'Updated');
    } else {
      await base44.entities.FamilyClaim.create(record);
      toast.success(lang === 'zh' ? '已添加' : 'Added');
    }
    invalidate();
    setShowForm(false);
    setEditId(null);
  };

  const handleDelete = async (id) => {
    if (!confirm(lang === 'zh' ? '确定删除？' : 'Delete this claim?')) return;
    await base44.entities.FamilyClaim.delete(id);
    invalidate();
    toast.success(lang === 'zh' ? '已删除' : 'Deleted');
  };

  const markReimbursed = async (c) => {
    await base44.entities.FamilyClaim.update(c.id, {
      status: 'reimbursed',
      reimbursed_date: format(new Date(), 'yyyy-MM-dd'),
    });
    invalidate();
    toast.success(lang === 'zh' ? '已标记为已报销' : 'Marked as reimbursed');
  };

  return (
    <div className="space-y-4">

      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: lang === 'zh' ? '本月合计' : 'Month Total', val: monthTotal, color: 'text-foreground' },
          { label: lang === 'zh' ? '待报销' : 'Pending', val: pendingTotal, color: 'text-amber-600' },
          { label: lang === 'zh' ? '已报销' : 'Reimbursed', val: reimbursedTotal, color: 'text-emerald-600' },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-2xl border border-border p-3 text-center">
            <p className="text-[10px] text-muted-foreground font-medium">{s.label}</p>
            <p className={`text-sm font-extrabold ${s.color}`}>RM {s.val.toFixed(2)}</p>
          </div>
        ))}
      </div>

      {/* Claims by person */}
      {Object.keys(byPerson).length > 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-2xl p-3 space-y-1">
          <p className="text-xs font-bold text-blue-700 mb-2">{lang === 'zh' ? '本月按人统计' : 'By Person This Month'}</p>
          {Object.entries(byPerson).map(([name, amt]) => (
            <div key={name} className="flex justify-between text-xs">
              <span className="text-blue-700 font-medium">👤 {name}</span>
              <span className="font-extrabold text-blue-700">RM {amt.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}

      {/* Add button */}
      <button onClick={openAdd}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-blue-300 text-blue-600 font-semibold text-sm hover:bg-blue-50 transition-colors">
        <Plus className="w-4 h-4" />{lang === 'zh' ? '添加报销记录' : 'Add Claim'}
      </button>

      {/* Claims list */}
      <div className="space-y-2">
        {monthClaims.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-6">
            {lang === 'zh' ? '本月暂无报销记录' : 'No claims this month'}
          </p>
        )}
        {monthClaims.map(c => {
          const cat = CATEGORIES.find(x => x.key === c.category);
          const isPending = c.status === 'pending';
          return (
            <div key={c.id} className={`bg-card rounded-2xl border p-3 space-y-1.5 transition-all ${!isPending ? 'opacity-70 border-emerald-200' : 'border-border'}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <p className={`text-sm font-bold truncate ${!isPending ? 'line-through text-muted-foreground' : ''}`}>{c.title}</p>
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${isPending ? 'bg-amber-50 text-amber-600 border-amber-200' : 'bg-emerald-50 text-emerald-600 border-emerald-200'}`}>
                      {isPending ? (lang === 'zh' ? '待报销' : 'Pending') : (lang === 'zh' ? '已报销' : 'Reimbursed')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5 flex-wrap">
                    <span>👤 {c.claim_by}</span>
                    {cat && <span>· {lang === 'zh' ? cat.labelZh : cat.label}</span>}
                    <span>· {c.date_paid}</span>
                    {c.reimbursed_date && <span>· {lang === 'zh' ? '报销: ' : 'Reimbursed: '}{c.reimbursed_date}</span>}
                  </div>
                  {c.notes && <p className="text-[10px] text-muted-foreground italic mt-0.5">{c.notes}</p>}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <p className="text-base font-extrabold">RM {(c.amount || 0).toFixed(2)}</p>
                  <button onClick={() => openEdit(c)} className="p-1 text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => handleDelete(c.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              {isPending && (
                <button onClick={() => markReimbursed(c)}
                  className="text-[10px] font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors">
                  ✓ {lang === 'zh' ? '标记已报销' : 'Mark Reimbursed'}
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Form Drawer */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setShowForm(false)}>
          <div className="bg-background w-full max-w-lg mx-auto rounded-t-3xl p-5 space-y-3 max-h-[85vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">
                {editId ? (lang === 'zh' ? '编辑报销' : 'Edit Claim') : (lang === 'zh' ? '添加报销' : 'Add Claim')}
              </h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>

            <F label={lang === 'zh' ? '标题 *' : 'Title *'}>
              <input value={form.title} onChange={e => set('title', e.target.value)}
                placeholder={lang === 'zh' ? '报销名称' : 'Claim title'}
                className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary" />
            </F>

            <div className="grid grid-cols-2 gap-3">
              <F label={lang === 'zh' ? '金额 (RM) *' : 'Amount (RM) *'}>
                <input type="number" inputMode="decimal" value={form.amount} onChange={e => set('amount', e.target.value)}
                  placeholder="0.00"
                  className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-primary" />
              </F>
              <F label={lang === 'zh' ? '报销人 *' : 'Claim By *'}>
                <input value={form.claim_by} onChange={e => set('claim_by', e.target.value)}
                  placeholder={lang === 'zh' ? '姓名' : 'Name'}
                  className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary" />
              </F>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <F label={lang === 'zh' ? '支付日期' : 'Date Paid'}>
                <input type="date" value={form.date_paid} onChange={e => set('date_paid', e.target.value)}
                  className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
              </F>
              <F label={lang === 'zh' ? '报销月份' : 'Claim Month'}>
                <input type="month" value={form.month} onChange={e => set('month', e.target.value)}
                  className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
              </F>
            </div>

            <F label={lang === 'zh' ? '类别' : 'Category'}>
              <div className="grid grid-cols-4 gap-1.5">
                {CATEGORIES.map(c => (
                  <button key={c.key} onClick={() => set('category', c.key)}
                    className={`py-1.5 rounded-xl text-xs font-semibold border transition-all ${form.category === c.key ? 'bg-primary/10 border-primary text-primary' : 'bg-secondary border-transparent text-muted-foreground'}`}>
                    {lang === 'zh' ? c.labelZh : c.label}
                  </button>
                ))}
              </div>
            </F>

            <F label={lang === 'zh' ? '支付方式' : 'Paid From'}>
              <div className="grid grid-cols-4 gap-1.5">
                {PAID_FROM.map(p => (
                  <button key={p.key} onClick={() => set('paid_from', p.key)}
                    className={`py-1.5 rounded-xl text-xs font-semibold border transition-all ${form.paid_from === p.key ? 'bg-primary/10 border-primary text-primary' : 'bg-secondary border-transparent text-muted-foreground'}`}>
                    {lang === 'zh' ? p.labelZh : p.label}
                  </button>
                ))}
              </div>
            </F>

            <F label={lang === 'zh' ? '状态' : 'Status'}>
              <div className="flex gap-2">
                {[['pending', lang === 'zh' ? '待报销' : 'Pending'], ['reimbursed', lang === 'zh' ? '已报销' : 'Reimbursed']].map(([k, l]) => (
                  <button key={k} onClick={() => set('status', k)}
                    className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${form.status === k ? 'bg-primary/10 border-primary text-primary' : 'bg-secondary border-transparent text-muted-foreground'}`}>
                    {l}
                  </button>
                ))}
              </div>
            </F>

            <F label={lang === 'zh' ? '备注' : 'Notes'}>
              <input value={form.notes} onChange={e => set('notes', e.target.value)}
                className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </F>

            <div className="flex gap-3 pt-1">
              {editId && (
                <Button variant="outline" onClick={() => { handleDelete(editId); setShowForm(false); }}
                  className="h-11 rounded-xl text-destructive border-destructive/30 hover:bg-destructive/10">
                  {lang === 'zh' ? '删除' : 'Delete'}
                </Button>
              )}
              <Button onClick={handleSave} className="flex-1 h-11 rounded-xl font-bold bg-primary">
                {lang === 'zh' ? '保存' : 'Save'}
              </Button>
            </div>
          </div>
        </div>
      )}
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