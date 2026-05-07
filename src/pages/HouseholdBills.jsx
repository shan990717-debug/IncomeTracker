import React, { useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { monthStr } from '@/lib/finance';
import { Plus, ChevronLeft, ChevronRight, Check, X, Pencil, Trash2, RefreshCw } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

import SharedFamilyFundSection from '@/components/bills/SharedFamilyFundSection.jsx';
import BillPaymentTracker from '@/components/bills/BillPaymentTracker';

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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const mStr = monthStr(currentMonth);
  const [tab, setTab] = useState('checklist');

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

  // Build a merged view: each active bill combined with its payment record (if any)
  // This ensures fixed bills always show their default amount even before generation
  const mergedHouseholdRows = activeBills.map(bill => {
    const payment = payments.find(p => p.bill_id === bill.id && p.section === 'household');
    const isFixed = (bill.default_amount || 0) > 0;
    // Effective amount: use payment.amount if payment exists, else use default for fixed bills
    const effectiveAmount = payment
      ? (payment.amount > 0 ? payment.amount : (isFixed ? bill.default_amount : 0))
      : (isFixed ? bill.default_amount : 0);
    return { bill, payment, isFixed, effectiveAmount };
  });

  const othersPayments = payments.filter(p => p.section === 'others');

  // Total includes fixed defaults even if no payment record yet
  const householdTotal = mergedHouseholdRows.reduce((s, r) => s + r.effectiveAmount, 0);
  const othersTotal = othersPayments.reduce((s, p) => s + (p.amount || 0), 0);
  const grandTotal = householdTotal + othersTotal;

  const householdPayments = mergedHouseholdRows.map(r => r.payment).filter(Boolean);
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
    // Also fix existing zero-amount payments for fixed bills
    const toFix = mergedHouseholdRows.filter(r => r.payment && r.payment.amount === 0 && r.isFixed);
    await Promise.all([
      toCreate.length > 0 ? base44.entities.BillPayment.bulkCreate(toCreate) : Promise.resolve(),
      ...toFix.map(r => base44.entities.BillPayment.update(r.payment.id, { amount: r.bill.default_amount })),
    ]);
    queryClient.invalidateQueries({ queryKey: ['billPayments', mStr] });
    if (toCreate.length > 0 || toFix.length > 0) {
      toast.success(lang === 'zh' ? `已生成/更新 ${toCreate.length + toFix.length} 笔账单` : `Generated/updated ${toCreate.length + toFix.length} bill entries`);
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

  const updateBillDefault = async (billId, newAmount) => {
    await base44.entities.HouseholdBill.update(billId, { default_amount: newAmount });
    queryClient.invalidateQueries({ queryKey: ['householdBills'] });
    toast.success(lang === 'zh' ? '默认金额已更新，将用于未来月份' : 'Default amount updated for future months');
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
        <Button size="sm" className="h-9 rounded-xl" onClick={() => navigate('/bills/new')}>
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
          <button onClick={generateMonthlyPayments} disabled={generating}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-2xl border border-dashed border-primary/30 text-primary font-semibold text-xs hover:bg-primary/5 transition-colors">
            <RefreshCw className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
            {payments.length === 0
              ? (lang === 'zh' ? '生成本月账单（启用付款操作）' : "Generate Bills (enable payment actions)")
              : (lang === 'zh' ? '重新生成 / 修复账单' : "Re-generate / fix bills")}
          </button>

          <SectionHeader title={lang === 'zh' ? '家庭账单' : 'Household Bills'} total={householdTotal} />
          {mergedHouseholdRows.map(({ bill, payment, isFixed, effectiveAmount }) => (
            <ChecklistRow
              key={bill.id}
              bill={bill}
              payment={payment}
              effectiveAmount={effectiveAmount}
              isFixed={isFixed}
              lang={lang}
              onToggleSettled={payment ? () => toggleSettled(payment) : null}
              onMarkPaid={payment ? () => markPaid(payment) : null}
              onEdit={payment ? () => navigate(`/bills/payment/edit?id=${payment.id}`) : null}
              onDelete={payment ? () => deletePayment(payment.id) : null}
              onUpdate={payment ? (data) => updatePayment(payment.id, data) : null}
              onUpdateDefault={(newAmt) => updateBillDefault(bill.id, newAmt)}
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
            <ChecklistRow key={p.id} payment={p} bill={null} lang={lang}
              onToggleSettled={() => toggleSettled(p)}
              onMarkPaid={() => markPaid(p)}
              onEdit={() => navigate(`/bills/payment/edit?id=${p.id}`)}
              onDelete={() => deletePayment(p.id)}
              onUpdate={(data) => updatePayment(p.id, data)}
              onUpdateDefault={null}
            />
          ))}
          <button onClick={() => navigate(`/bills/payment/new?new=1&month=${mStr}&section=others`)}
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

function ChecklistRow({ bill, payment, effectiveAmount, isFixed, lang, onToggleSettled, onMarkPaid, onEdit, onDelete, onUpdate, onUpdateDefault }) {
  const [amtEdit, setAmtEdit] = useState(false);
  const [amtVal, setAmtVal] = useState(String(effectiveAmount || 0));

  const isSettled = payment?.is_settled || false;
  const status = payment?.status || 'pending';

  const saveAmt = () => {
    if (onUpdate) onUpdate({ amount: parseFloat(amtVal) || 0 });
    setAmtEdit(false);
  };

  const handleUpdateDefault = () => {
    const newAmt = parseFloat(amtVal) || 0;
    if (onUpdate) onUpdate({ amount: newAmt });
    if (onUpdateDefault) onUpdateDefault(newAmt);
    setAmtEdit(false);
  };

  const displayAmt = effectiveAmount || 0;
  // For fixed bills, always show amount. For manual bills, show "点击输入" if 0.
  const showPlaceholder = !isFixed && displayAmt === 0;

  return (
    <div className={`bg-card rounded-2xl border p-3 space-y-2 transition-all ${isSettled ? 'opacity-60 border-border' : 'border-border'}`}>
      <div className="flex items-center justify-between gap-2">
        {/* Settled checkbox */}
        <button onClick={onToggleSettled || undefined} disabled={!payment}
          className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${isSettled ? 'bg-emerald-500 border-emerald-500' : 'border-muted-foreground/40 hover:border-emerald-400'} ${!payment ? 'opacity-40 cursor-not-allowed' : ''}`}>
          {isSettled && <Check className="w-3.5 h-3.5 text-white" />}
        </button>

        {/* Name */}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold truncate ${isSettled ? 'line-through text-muted-foreground' : ''}`}>{bill.name}</p>
          {isFixed && <p className="text-[10px] text-muted-foreground">{lang === 'zh' ? '固定金额' : 'Fixed amount'}</p>}
        </div>

        {/* Amount */}
        {amtEdit ? (
          <div className="flex flex-col items-end gap-1">
            <div className="flex items-center gap-1">
              <input type="number" inputMode="decimal" value={amtVal} onChange={e => setAmtVal(e.target.value)}
                className="w-20 text-right bg-secondary rounded-lg px-2 py-1 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-primary" autoFocus />
              <button onClick={() => setAmtEdit(false)} className="p-1 text-muted-foreground"><X className="w-4 h-4" /></button>
            </div>
            <div className="flex gap-1">
              {payment && (
                <button onClick={saveAmt}
                  className="text-[10px] font-semibold px-2 py-1 bg-primary/10 text-primary border border-primary/30 rounded-lg hover:bg-primary/20">
                  {lang === 'zh' ? '仅本月' : 'This month only'}
                </button>
              )}
              {isFixed && (
                <button onClick={handleUpdateDefault}
                  className="text-[10px] font-semibold px-2 py-1 bg-orange-50 text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-100">
                  {lang === 'zh' ? '更新默认金额' : 'Update default'}
                </button>
              )}
            </div>
          </div>
        ) : (
          <button onClick={() => { setAmtVal(String(displayAmt)); setAmtEdit(true); }}
            className={`text-sm font-extrabold hover:text-primary transition-colors ${showPlaceholder ? 'text-muted-foreground text-xs' : 'text-foreground'}`}>
            {showPlaceholder ? (lang === 'zh' ? '点击输入' : 'Enter amt') : `RM ${displayAmt.toFixed(2)}`}
          </button>
        )}

        <StatusBadge status={status} lang={lang} />
      </div>

      {/* Bottom row */}
      <div className="flex items-center gap-2 flex-wrap">
        {payment && status === 'pending' && (
          <button onClick={onMarkPaid} className="text-[10px] font-semibold px-2.5 py-1 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
            {lang === 'zh' ? '✓ 标记已付' : '✓ Mark Paid'}
          </button>
        )}
        {!payment && (
          <span className="text-[10px] text-amber-500 font-medium">{lang === 'zh' ? '点击"生成账单"以启用操作' : 'Generate bills to enable actions'}</span>
        )}
        {payment?.payment_date && (
          <span className="text-[10px] text-muted-foreground">{lang === 'zh' ? '付款: ' : 'Paid: '}{payment.payment_date}</span>
        )}
        {payment?.remark && <span className="text-[10px] text-muted-foreground italic truncate max-w-[120px]">{payment.remark}</span>}
        <div className="ml-auto flex gap-1">
          {payment && <button onClick={onEdit} className="p-1 text-muted-foreground hover:text-foreground"><Pencil className="w-3.5 h-3.5" /></button>}
          {payment && <button onClick={onDelete} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="w-3.5 h-3.5" /></button>}
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



function FormRow({ label, children }) {
  return (
    <div>
      <label className="text-xs font-semibold text-muted-foreground mb-1.5 block">{label}</label>
      {children}
    </div>
  );
}