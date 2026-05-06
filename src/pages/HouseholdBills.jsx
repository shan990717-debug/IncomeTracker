import React, { useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { monthStr } from '@/lib/finance';
import { Plus, ChevronLeft, ChevronRight, Check, X, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import BillFormDrawer from '@/components/bills/BillFormDrawer.jsx';
import SharedFamilyFundSection from '@/components/bills/SharedFamilyFundSection.jsx';
import BillPaymentTracker from '@/components/bills/BillPaymentTracker.jsx';

function isBillCompleted(bill, mStr) {
  if (!bill.installment_end) return false;
  return mStr > bill.installment_end;
}

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  labelZh: '待付',   bg: 'bg-amber-50',   text: 'text-amber-600',   border: 'border-amber-200' },
  paid:     { label: 'Paid',     labelZh: '已付',   bg: 'bg-blue-50',    text: 'text-blue-600',    border: 'border-blue-200' },
  settled:  { label: 'Settled',  labelZh: '已结',   bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
  overdue:  { label: 'Overdue',  labelZh: '逾期',   bg: 'bg-red-50',     text: 'text-red-600',     border: 'border-red-200' },
};

export default function HouseholdBills() {
  const { lang } = useLanguage();
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const mStr = monthStr(currentMonth);
  const [tab, setTab] = useState('checklist');
  const [showForm, setShowForm] = useState(false);
  const [editBill, setEditBill] = useState(null);
  const [editPayment, setEditPayment] = useState(null);
  const [generating, setGenerating] = useState(false);

  const { data: bills = [] } = useQuery({
    queryKey: ['householdBills'],
    queryFn: () => base44.entities.HouseholdBill.list('sort_order', 50),
  });
  const { data: payments = [] } = useQuery({
    queryKey: ['billPayments', mStr],
    queryFn: () => base44.entities.BillPayment.filter({ month: mStr }),
  });

  const activeBills = bills
    .filter(b => b.is_active && !b.is_shared_family && !isBillCompleted(b, mStr))
    .sort((a, b) => (a.sort_order || 99) - (b.sort_order || 99));

  const completedBills = bills
    .filter(b => b.is_active && !b.is_shared_family && isBillCompleted(b, mStr))
    .sort((a, b) => (a.sort_order || 99) - (b.sort_order || 99));

  const householdPayments = payments.filter(p => p.section === 'household');
  const othersPayments = payments.filter(p => p.section === 'others');

  const householdTotal = householdPayments.reduce((s, p) => s + (p.amount || 0), 0);
  const othersTotal = othersPayments.reduce((s, p) => s + (p.amount || 0), 0);
  const grandTotal = householdTotal + othersTotal;

  const pendingCount = [...householdPayments, ...othersPayments].filter(p => p.status === 'pending' || p.status === 'overdue').length;
  const settledCount = [...householdPayments, ...othersPayments].filter(p => p.is_settled).length;

  const generateMonthlyPayments = async () => {
    setGenerating(true);
    const existing = payments.map(p => p.bill_id).filter(Boolean);
    const toCreate = activeBills
      .filter(b => !existing.includes(b.id))
      .map(b => ({
        bill_id: b.id, bill_name: b.name, month: mStr,
        amount: b.default_amount || 0, section: 'household',
        category: b.category, status: 'pending', is_settled: false, is_shared_family: false,
      }));
    if (toCreate.length > 0) {
      await base44.entities.BillPayment.bulkCreate(toCreate);
      queryClient.invalidateQueries({ queryKey: ['billPayments', mStr] });
      toast.success(lang === 'zh' ? `已生成 ${toCreate.length} 笔账单` : `Generated ${toCreate.length} bill entries`);
    } else {
      toast(lang === 'zh' ? '本月账单已存在' : 'Bills already generated for this month');
    }
    setGenerating(false);
  };

  const updatePayment = async (id, data) => {
    await base44.entities.BillPayment.update(id, data);
    queryClient.invalidateQueries({ queryKey: ['billPayments', mStr] });
  };

  const deletePayment = async (id) => {
    if (!confirm(lang === 'zh' ? '确定删除？' : 'Delete this entry?')) return;
    await base44.entities.BillPayment.delete(id);
    queryClient.invalidateQueries({ queryKey: ['billPayments', mStr] });
    toast.success(lang === 'zh' ? '已删除' : 'Deleted');
  };

  const toggleSettled = async (p) => {
    const newSettled = !p.is_settled;
    await updatePayment(p.id, {
      is_settled: newSettled,
      status: newSettled ? 'settled' : (p.payment_date ? 'paid' : 'pending'),
    });
  };

  const markPaid = async (p) => {
    await updatePayment(p.id, { status: 'paid', payment_date: format(new Date(), 'yyyy-MM-dd') });
  };

  return (
    <div className="px-4 pt-14 pb-24 space-y-4 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold">{lang === 'zh' ? '家庭账单' : 'Household Bills'}</h1>
          <p className="text-xs text-muted-foreground">{lang === 'zh' ? '账单清单 · 付款追踪 · See May' : 'Checklist · Tracker · See May'}</p>
        </div>
        <Button size="sm" className="h-9 rounded-xl" onClick={() => { setEditBill(null); setShowForm(true); }}>
          <Plus className="w-4 h-4 mr-1" />{lang === 'zh' ? '新增' : 'Add'}
        </Button>
      </div>

      {/* Month Nav */}
      <div className="flex items-center justify-between bg-card rounded-2xl px-4 py-3 border border-border">
        <button onClick={() => setCurrentMonth(m => { const d = new Date(m); d.setMonth(d.getMonth() - 1); return d; })} className="p-1">
          <ChevronLeft className="w-5 h-5 text-muted-foreground" />
        </button>
        <p className="font-bold">{format(currentMonth, 'MMMM yyyy')}</p>
        <button onClick={() => setCurrentMonth(m => { const d = new Date(m); d.setMonth(d.getMonth() + 1); return d; })} className="p-1">
          <ChevronRight className="w-5 h-5 text-muted-foreground" />
        </button>
      </div>

      {/* Summary Strip */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: lang === 'zh' ? '账单合计' : 'Total', val: `RM${grandTotal.toFixed(0)}`, color: 'text-foreground' },
          { label: lang === 'zh' ? '待付' : 'Pending', val: pendingCount, color: 'text-amber-600' },
          { label: lang === 'zh' ? '已结' : 'Settled', val: settledCount, color: 'text-emerald-600' },
          { label: lang === 'zh' ? '已完成' : 'Completed', val: completedBills.length, color: 'text-muted-foreground' },
        ].map(s => (
          <div key={s.label} className="bg-card rounded-2xl border border-border p-2.5 text-center">
            <p className="text-[10px] text-muted-foreground font-medium">{s.label}</p>
            <p className={`text-sm font-extrabold ${s.color}`}>{s.val}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex bg-secondary rounded-2xl p-1 gap-1">
        {[
          { key: 'checklist', label: lang === 'zh' ? '账单清单' : 'Checklist' },
          { key: 'tracker',   label: lang === 'zh' ? '付款追踪' : 'Tracker' },
          { key: 'shared',    label: 'See May' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-2 text-xs font-semibold rounded-xl transition-all ${tab === t.key ? 'bg-card shadow text-foreground' : 'text-muted-foreground'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── CHECKLIST TAB ── */}
      {tab === 'checklist' && (
        <div className="space-y-4">
          {payments.length === 0 && (
            <button onClick={generateMonthlyPayments} disabled={generating}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-primary/40 text-primary font-semibold text-sm hover:bg-primary/5 transition-colors">
              <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
              {lang === 'zh' ? '生成本月账单清单' : "Generate This Month's Bill List"}
            </button>
          )}

          <SectionHeader title={lang === 'zh' ? '家庭账单' : 'Household Bills'} total={householdTotal} />
          {householdPayments.length === 0 && payments.length > 0 && (
            <p className="text-xs text-muted-foreground text-center py-2">{lang === 'zh' ? '暂无账单' : 'No household bills'}</p>
          )}
          {householdPayments
            .sort((a, b) => a.bill_name.localeCompare(b.bill_name))
            .map(p => (
              <ChecklistRow key={p.id} payment={p} lang={lang}
                onToggleSettled={() => toggleSettled(p)}
                onMarkPaid={() => markPaid(p)}
                onEdit={() => setEditPayment(p)}
                onDelete={() => deletePayment(p.id)}
                onUpdate={(data) => updatePayment(p.id, data)}
              />
            ))}

          {/* Completed installments */}
          {completedBills.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold text-muted-foreground">{lang === 'zh' ? '✅ 已完成分期（无需缴付）' : '✅ Completed Installments'}</p>
              {completedBills.map(b => (
                <div key={b.id} className="bg-secondary/40 rounded-xl px-4 py-3 flex items-center justify-between opacity-60">
                  <div>
                    <p className="text-sm font-semibold line-through text-muted-foreground">{b.name}</p>
                    {b.installment_end && <p className="text-[10px] text-muted-foreground">{lang === 'zh' ? '已于 ' : 'Ended '}{b.installment_end}</p>}
                  </div>
                  <span className="text-[10px] font-bold px-2 py-1 bg-secondary rounded-lg text-muted-foreground">
                    {lang === 'zh' ? '已完成' : 'Completed'}
                  </span>
                </div>
              ))}
            </div>
          )}

          <SectionHeader title={lang === 'zh' ? '其他支出（特殊情况）' : 'Others Expenses'} total={othersTotal} />
          {othersPayments.map(p => (
            <ChecklistRow key={p.id} payment={p} lang={lang}
              onToggleSettled={() => toggleSettled(p)}
              onMarkPaid={() => markPaid(p)}
              onEdit={() => setEditPayment(p)}
              onDelete={() => deletePayment(p.id)}
              onUpdate={(data) => updatePayment(p.id, data)}
            />
          ))}
          <button onClick={() => setEditPayment({ section: 'others', month: mStr, status: 'pending', amount: 0, bill_name: '', is_settled: false, _isNew: true })}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-dashed border-border text-muted-foreground text-xs font-semibold hover:border-primary/40 hover:text-primary transition-colors">
            <Plus className="w-3.5 h-3.5" />{lang === 'zh' ? '添加其他支出' : 'Add Other Expense'}
          </button>

          {/* Total Summary Card */}
          <div className="bg-card border border-border rounded-2xl overflow-hidden">
            <div className="px-4 py-3 space-y-2 border-b border-border">
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">{lang === 'zh' ? '家庭账单小计' : 'Household Bills Subtotal'}</span>
                <span className="font-bold">RM {householdTotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">{lang === 'zh' ? '其他支出小计' : 'Others Expenses Subtotal'}</span>
                <span className="font-bold">RM {othersTotal.toFixed(2)}</span>
              </div>
            </div>
            <div className="px-4 py-3 bg-primary/5">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-bold">{lang === 'zh' ? '本月账单合计' : 'Monthly Bills Total'}</p>
                  <p className="text-[10px] text-muted-foreground">{lang === 'zh' ? '同步至月度结算→家庭必需' : 'Synced to Settlement → Family Essential'}</p>
                </div>
                <p className="text-2xl font-extrabold text-primary">RM {grandTotal.toFixed(2)}</p>
              </div>
            </div>
            <div className="px-4 py-3 bg-blue-50 border-t border-blue-100">
              <div className="flex justify-between items-center">
                <p className="text-sm font-bold text-blue-700">{lang === 'zh' ? '💳 本月转账金额' : '💳 Amount to Transfer This Month'}</p>
                <p className="text-xl font-extrabold text-blue-700">RM {grandTotal.toFixed(2)}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TRACKER TAB ── */}
      {tab === 'tracker' && (
        <BillPaymentTracker
          lang={lang}
          bills={bills.filter(b => !b.is_shared_family)}
          currentMonth={currentMonth}
        />
      )}

      {/* ── SEE MAY TAB ── */}
      {tab === 'shared' && (
        <SharedFamilyFundSection lang={lang} mStr={mStr} />
      )}

      {/* Bill Form Drawer */}
      <BillFormDrawer
        open={showForm}
        onClose={() => setShowForm(false)}
        editBill={editBill}
        lang={lang}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ['householdBills'] });
          setShowForm(false);
        }}
      />

      {/* Payment Edit Drawer */}
      {editPayment && (
        <PaymentEditDrawer
          payment={editPayment}
          lang={lang}
          mStr={mStr}
          onClose={() => setEditPayment(null)}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['billPayments', mStr] });
            setEditPayment(null);
          }}
        />
      )}
    </div>
  );
}

function SectionHeader({ title, total }) {
  return (
    <div className="flex items-center justify-between">
      <p className="text-sm font-bold">{title}</p>
      <p className="text-sm font-bold text-primary">RM {total.toFixed(2)}</p>
    </div>
  );
}

function ChecklistRow({ payment, lang, onToggleSettled, onMarkPaid, onEdit, onDelete, onUpdate }) {
  const [amtEdit, setAmtEdit] = useState(false);
  const [amtVal, setAmtVal] = useState(String(payment.amount || 0));

  const saveAmt = () => {
    onUpdate({ amount: parseFloat(amtVal) || 0 });
    setAmtEdit(false);
  };

  return (
    <div className={`bg-card rounded-2xl border p-3 space-y-2 transition-all ${payment.is_settled ? 'opacity-60 border-border' : 'border-border'}`}>
      <div className="flex items-center justify-between gap-2">
        <button onClick={onToggleSettled}
          className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${payment.is_settled ? 'bg-emerald-500 border-emerald-500' : 'border-muted-foreground/40 hover:border-emerald-400'}`}>
          {payment.is_settled && <Check className="w-3.5 h-3.5 text-white" />}
        </button>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold truncate ${payment.is_settled ? 'line-through text-muted-foreground' : ''}`}>{payment.bill_name}</p>
        </div>
        {amtEdit ? (
          <div className="flex items-center gap-1">
            <input type="number" inputMode="decimal" value={amtVal} onChange={e => setAmtVal(e.target.value)}
              className="w-20 text-right bg-secondary rounded-lg px-2 py-1 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-primary" autoFocus />
            <button onClick={saveAmt} className="p-1 text-primary"><Check className="w-4 h-4" /></button>
            <button onClick={() => setAmtEdit(false)} className="p-1 text-muted-foreground"><X className="w-4 h-4" /></button>
          </div>
        ) : (
          <button onClick={() => { setAmtVal(String(payment.amount || 0)); setAmtEdit(true); }}
            className={`text-sm font-extrabold hover:text-primary transition-colors ${(payment.amount || 0) === 0 ? 'text-muted-foreground text-xs' : 'text-foreground'}`}>
            {(payment.amount || 0) === 0 ? (lang === 'zh' ? '点击输入' : 'Enter amt') : `RM ${(payment.amount || 0).toFixed(2)}`}
          </button>
        )}
        <StatusBadge status={payment.status} lang={lang} />
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {payment.status === 'pending' && (
          <button onClick={onMarkPaid} className="text-[10px] font-semibold px-2.5 py-1 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
            {lang === 'zh' ? '✓ 标记已付' : '✓ Mark Paid'}
          </button>
        )}
        {payment.payment_date && (
          <span className="text-[10px] text-muted-foreground">{lang === 'zh' ? '付款: ' : 'Paid: '}{payment.payment_date}</span>
        )}
        {payment.remark && <span className="text-[10px] text-muted-foreground italic truncate max-w-[120px]">{payment.remark}</span>}
        <div className="ml-auto flex gap-1">
          <button onClick={onEdit} className="p-1 text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>
          <button onClick={onDelete} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status, lang }) {
  const s = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${s.bg} ${s.text} ${s.border}`}>
      {lang === 'zh' ? s.labelZh : s.label}
    </span>
  );
}

function PaymentEditDrawer({ payment, lang, mStr, onClose, onSaved }) {
  const [form, setForm] = useState({
    bill_name: payment.bill_name || '',
    amount: String(payment.amount || 0),
    payment_date: payment.payment_date || '',
    due_date: payment.due_date || '',
    status: payment.status || 'pending',
    is_settled: payment.is_settled || false,
    remark: payment.remark || '',
    section: payment.section || 'household',
    month: payment.month || mStr,
  });
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    const record = { ...form, amount: parseFloat(form.amount) || 0 };
    if (payment._isNew) await base44.entities.BillPayment.create(record);
    else await base44.entities.BillPayment.update(payment.id, record);
    setSaving(false);
    onSaved();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={onClose}>
      <div className="bg-background w-full max-w-lg mx-auto rounded-t-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">{payment._isNew ? (lang === 'zh' ? '添加支出' : 'Add Expense') : (lang === 'zh' ? '编辑账单' : 'Edit Bill')}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        <div className="space-y-3">
          <FormRow label={lang === 'zh' ? '账单名称' : 'Bill Name'}>
            <input value={form.bill_name} onChange={e => setForm(p => ({ ...p, bill_name: e.target.value }))}
              className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary" />
          </FormRow>
          <FormRow label={lang === 'zh' ? '金额 (RM)' : 'Amount (RM)'}>
            <input type="number" inputMode="decimal" value={form.amount} onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
              className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-primary" />
          </FormRow>
          <div className="grid grid-cols-2 gap-3">
            <FormRow label={lang === 'zh' ? '到期日' : 'Due Date'}>
              <input type="date" value={form.due_date} onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))}
                className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </FormRow>
            <FormRow label={lang === 'zh' ? '付款日期' : 'Payment Date'}>
              <input type="date" value={form.payment_date} onChange={e => setForm(p => ({ ...p, payment_date: e.target.value }))}
                className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            </FormRow>
          </div>
          <FormRow label={lang === 'zh' ? '状态' : 'Status'}>
            <div className="flex gap-2 flex-wrap">
              {Object.entries(STATUS_CONFIG).map(([k, s]) => (
                <button key={k} onClick={() => setForm(p => ({ ...p, status: k }))}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all ${form.status === k ? `${s.bg} ${s.text} ${s.border}` : 'bg-secondary border-transparent text-muted-foreground'}`}>
                  {lang === 'zh' ? s.labelZh : s.label}
                </button>
              ))}
            </div>
          </FormRow>
          <FormRow label={lang === 'zh' ? '类别' : 'Section'}>
            <div className="flex gap-2">
              {[['household', lang === 'zh' ? '家庭账单' : 'Household'], ['others', lang === 'zh' ? '其他支出' : 'Others']].map(([k, l]) => (
                <button key={k} onClick={() => setForm(p => ({ ...p, section: k }))}
                  className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-all ${form.section === k ? 'bg-primary/10 border-primary text-primary' : 'bg-secondary border-transparent text-muted-foreground'}`}>
                  {l}
                </button>
              ))}
            </div>
          </FormRow>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold">{lang === 'zh' ? '已结清' : 'Settled'}</span>
            <button onClick={() => setForm(p => ({ ...p, is_settled: !p.is_settled }))}
              className={`w-12 h-6 rounded-full transition-colors ${form.is_settled ? 'bg-emerald-500' : 'bg-muted'}`}>
              <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform mx-0.5 ${form.is_settled ? 'translate-x-6' : 'translate-x-0'}`} />
            </button>
          </div>
          <FormRow label={lang === 'zh' ? '备注' : 'Remark'}>
            <input value={form.remark} onChange={e => setForm(p => ({ ...p, remark: e.target.value }))}
              className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
          </FormRow>
        </div>
        <Button onClick={handleSave} disabled={saving} className="w-full h-11 rounded-xl font-bold bg-primary">
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