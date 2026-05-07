import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Plus, Wallet, Pencil, Trash2, X, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const emptyCollect = () => ({
  amount: '', collected_from: '', date: format(new Date(), 'yyyy-MM-dd'), notes: '',
});

const SEE_MAY_DEFAULTS = [
  { bill_name: 'Car Loan（Axia）',         defaultAmount: 427.00, isFixed: true },
  { bill_name: 'Electricity Bill（Popo）', defaultAmount: 0,       isFixed: false },
];

/**
 * Compute running balance up to (and including) a given month.
 * Starting balance for a month = sum of all contributions before that month
 *                                - sum of all paid expenses before that month
 * Ending balance = starting + this month contributions - this month paid expenses
 *
 * Only status === 'paid' deducts. 'settled' is just confirmation, not double-deducted.
 * 'pending' never deducts.
 */
function calcRunningBalance(allContributions, allPaidPayments, mStr) {
  // Split by whether the record is before, equal to, or after mStr
  // Contributions use date → derive YYYY-MM
  const contribBeforeMonth = allContributions.filter(e => (e.month || e.date?.substring(0, 7)) < mStr);
  const contribThisMonth   = allContributions.filter(e => (e.month || e.date?.substring(0, 7)) === mStr);

  // Paid payments use month field on BillPayment
  const paidBeforeMonth = allPaidPayments.filter(p => p.month < mStr);
  const paidThisMonth   = allPaidPayments.filter(p => p.month === mStr);

  const startingBalance = contribBeforeMonth.reduce((s, e) => s + (e.amount || 0), 0)
                        - paidBeforeMonth.reduce((s, p) => s + (p.amount || 0), 0);

  const thisMonthContributions = contribThisMonth.reduce((s, e) => s + (e.amount || 0), 0);
  const thisMonthPaid          = paidThisMonth.reduce((s, p) => s + (p.amount || 0), 0);

  const endingBalance = startingBalance + thisMonthContributions - thisMonthPaid;

  return { startingBalance, thisMonthContributions, thisMonthPaid, endingBalance };
}

export default function SharedFamilyFundSection({ lang, mStr, seeMayPayments = [], onUpdate, onMarkPaid, onToggleSettled, onDelete, onEdit }) {
  const queryClient = useQueryClient();
  const [showCollectForm, setShowCollectForm] = useState(false);
  const [collectForm, setCollectForm] = useState(emptyCollect());
  const [editingContribId, setEditingContribId] = useState(null);
  const [editingAmtKey, setEditingAmtKey] = useState(null);
  const [amtVal, setAmtVal] = useState('');

  // All contribution records (across all months)
  const { data: fundEntries = [] } = useQuery({
    queryKey: ['sharedFamilyFund'],
    queryFn: () => base44.entities.SharedFamilyFund.list('-date', 500),
  });

  // All See May BillPayments across all months (to compute running paid total)
  const { data: allSeeMayPayments = [] } = useQuery({
    queryKey: ['allSeeMayPayments'],
    queryFn: () => base44.entities.BillPayment.filter({ section: 'shared_family' }),
  });

  const contributions = fundEntries.filter(e => e.type === 'collection');

  // Only 'paid' status deducts from balance — 'settled' is confirmation, not double-deduction
  // 'pending' never deducts
  const allPaidPayments = allSeeMayPayments.filter(p => p.status === 'paid');

  const { startingBalance, thisMonthContributions, thisMonthPaid, endingBalance } =
    calcRunningBalance(contributions, allPaidPayments, mStr);

  // This month display stats (from passed-in seeMayPayments for current month)
  const monthTotal = seeMayPayments.reduce((s, p) => s + (p.amount || 0), 0);
  const monthPending = seeMayPayments
    .filter(p => p.status === 'pending')
    .reduce((s, p) => s + (p.amount || 0), 0);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['sharedFamilyFund'] });
    queryClient.invalidateQueries({ queryKey: ['allSeeMayPayments'] });
  };

  const getPayment = (billName) => seeMayPayments.find(p => p.bill_name === billName);

  const handleSaveContrib = async () => {
    if (!collectForm.amount) return;
    const contribMonth = collectForm.date?.substring(0, 7) || mStr;
    if (editingContribId) {
      await base44.entities.SharedFamilyFund.update(editingContribId, {
        amount: parseFloat(collectForm.amount) || 0,
        date: collectForm.date,
        month: contribMonth,
        collected_from: collectForm.collected_from,
        notes: collectForm.notes,
      });
      toast.success(lang === 'zh' ? '已更新' : 'Updated');
      setEditingContribId(null);
    } else {
      await base44.entities.SharedFamilyFund.create({
        type: 'collection',
        amount: parseFloat(collectForm.amount) || 0,
        date: collectForm.date,
        month: contribMonth,
        collected_from: collectForm.collected_from,
        notes: collectForm.notes,
      });
      toast.success(lang === 'zh' ? '收款已记录' : 'Collection recorded');
    }
    invalidate();
    setCollectForm(emptyCollect());
    setShowCollectForm(false);
  };

  const handleEditContrib = (e) => {
    setEditingContribId(e.id);
    setCollectForm({ amount: String(e.amount || ''), collected_from: e.collected_from || '', date: e.date || format(new Date(), 'yyyy-MM-dd'), notes: e.notes || '' });
    setShowCollectForm(true);
  };

  const handleDeleteContrib = async (id) => {
    if (!confirm(lang === 'zh' ? '确定删除此收款记录？' : 'Delete this contribution record?')) return;
    await base44.entities.SharedFamilyFund.delete(id);
    invalidate();
    toast.success(lang === 'zh' ? '已删除' : 'Deleted');
  };

  const startAmtEdit = (billName, currentAmt) => {
    setEditingAmtKey(billName);
    setAmtVal(String(currentAmt || ''));
  };

  const saveAmt = (payment) => {
    if (onUpdate && payment) onUpdate(payment.id, { amount: parseFloat(amtVal) || 0 });
    setEditingAmtKey(null);
  };

  // Contributions for current month display
  const thisMonthContribs = contributions.filter(e => (e.month || e.date?.substring(0, 7)) === mStr);

  return (
    <div className="space-y-4">

      {/* 1. Fund Balance Card — running balance */}
      <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-2 mb-1">
          <Wallet className="w-4 h-4 opacity-75" />
          <p className="text-xs opacity-75 font-medium">See May Fund Balance</p>
        </div>
        <p className="text-3xl font-extrabold">RM {endingBalance.toFixed(2)}</p>
        <p className="text-[10px] opacity-60 mt-0.5">
          {lang === 'zh' ? `${mStr} 月末余额` : `Ending balance for ${mStr}`}
        </p>
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="bg-white/15 rounded-xl p-2 text-center">
            <p className="text-[10px] opacity-75">{lang === 'zh' ? '月初余额' : 'Starting'}</p>
            <p className="text-sm font-bold">RM {startingBalance.toFixed(0)}</p>
          </div>
          <div className="bg-white/15 rounded-xl p-2 text-center">
            <p className="text-[10px] opacity-75">{lang === 'zh' ? '本月收款' : 'Contributions'}</p>
            <p className="text-sm font-bold text-green-300">+RM {thisMonthContributions.toFixed(0)}</p>
          </div>
          <div className="bg-white/15 rounded-xl p-2 text-center">
            <p className="text-[10px] opacity-75">{lang === 'zh' ? '本月已付' : 'Paid Out'}</p>
            <p className="text-sm font-bold text-red-300">-RM {thisMonthPaid.toFixed(0)}</p>
          </div>
        </div>
      </div>

      {/* 2. This Month Summary */}
      <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4">
        <p className="text-xs font-bold text-purple-700 mb-3">
          {lang === 'zh' ? `${mStr} 月度摘要` : `${mStr} Monthly Summary`}
        </p>
        <div className="space-y-1.5 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">{lang === 'zh' ? '月初结余（上月带入）' : 'Starting Balance (carried forward)'}</span>
            <span className="font-bold">RM {startingBalance.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center text-green-700">
            <span>{lang === 'zh' ? '+ 本月收款' : '+ Contributions this month'}</span>
            <span className="font-bold">RM {thisMonthContributions.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center text-red-600">
            <span>{lang === 'zh' ? '− 本月已付支出（Paid）' : '− Paid expenses this month'}</span>
            <span className="font-bold">RM {thisMonthPaid.toFixed(2)}</span>
          </div>
          <div className="border-t border-purple-200 pt-1.5 flex justify-between items-center font-bold text-purple-700">
            <span>{lang === 'zh' ? '= 月末结余' : '= Ending Balance'}</span>
            <span>RM {endingBalance.toFixed(2)}</span>
          </div>
        </div>
        {monthPending > 0 && (
          <p className="text-[10px] text-amber-600 mt-2">
            ⚠️ {lang === 'zh'
              ? `待付 RM${monthPending.toFixed(2)} 尚未扣除（标记为已付后才计算）`
              : `RM${monthPending.toFixed(2)} pending — will deduct once marked Paid`}
          </p>
        )}
      </div>

      {/* 3. Payment Checklist */}
      <div>
        <p className="text-sm font-bold mb-2">
          {lang === 'zh' ? 'See May 本月付款清单' : 'See May Payment Checklist'}
        </p>
        <div className="space-y-2">
          {SEE_MAY_DEFAULTS.map(item => {
            const payment = getPayment(item.bill_name);
            const status = payment?.status || 'pending';
            const isSettled = payment?.is_settled || false;
            const displayAmt = payment ? payment.amount : item.defaultAmount;
            const isEditingAmt = editingAmtKey === item.bill_name;

            return (
              <div key={item.bill_name}
                className={`rounded-2xl border p-3 space-y-2 transition-all ${isSettled ? 'opacity-70 bg-card border-emerald-200' : 'bg-purple-50/50 border-purple-200'}`}>

                <div className="flex items-center gap-2">
                  <button
                    disabled={!payment}
                    onClick={() => payment && onToggleSettled && onToggleSettled(payment)}
                    title={lang === 'zh' ? '已付后可结清' : 'Must be Paid before Settling'}
                    className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${isSettled ? 'bg-emerald-500 border-emerald-500' : 'border-muted-foreground/40 hover:border-emerald-400'} ${!payment ? 'opacity-40 cursor-not-allowed' : ''}`}>
                    {isSettled && <Check className="w-3.5 h-3.5 text-white" />}
                  </button>

                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold truncate ${isSettled ? 'line-through text-muted-foreground' : ''}`}>
                      {item.bill_name}
                    </p>
                    {item.isFixed && <p className="text-[10px] text-muted-foreground">{lang === 'zh' ? '固定金额' : 'Fixed · ends 2029-01'}</p>}
                  </div>

                  {isEditingAmt ? (
                    <div className="flex items-center gap-1">
                      <input type="number" inputMode="decimal" autoFocus value={amtVal}
                        onChange={e => setAmtVal(e.target.value)}
                        className="w-20 text-right bg-white rounded-lg px-2 py-1 text-sm font-bold border border-purple-300 focus:outline-none focus:ring-1 focus:ring-purple-400" />
                      <button onClick={() => saveAmt(payment)} className="p-1 text-purple-600"><Check className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setEditingAmtKey(null)} className="p-1 text-muted-foreground"><X className="w-3.5 h-3.5" /></button>
                    </div>
                  ) : (
                    <button onClick={() => startAmtEdit(item.bill_name, displayAmt)}
                      className="text-sm font-extrabold text-foreground hover:text-purple-600 transition-colors">
                      {displayAmt > 0
                        ? `RM ${displayAmt.toFixed(2)}`
                        : <span className="text-muted-foreground text-xs font-medium">{lang === 'zh' ? '点击输入' : 'Enter amt'}</span>}
                    </button>
                  )}

                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${
                    isSettled ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                    : status === 'paid' ? 'bg-blue-50 text-blue-600 border-blue-200'
                    : 'bg-amber-50 text-amber-600 border-amber-200'
                  }`}>
                    {isSettled ? (lang === 'zh' ? '已结' : 'Settled')
                      : status === 'paid' ? (lang === 'zh' ? '已付' : 'Paid')
                      : (lang === 'zh' ? '待付' : 'Pending')}
                  </span>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {payment && status === 'pending' && (
                    <button onClick={() => onMarkPaid && onMarkPaid(payment)}
                      className="text-[10px] font-semibold px-2.5 py-1 bg-blue-50 text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                      {lang === 'zh' ? '✓ 标记已付' : '✓ Mark Paid'}
                    </button>
                  )}
                  {payment && status === 'paid' && !isSettled && (
                    <button onClick={() => onToggleSettled && onToggleSettled(payment)}
                      className="text-[10px] font-semibold px-2.5 py-1 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors">
                      {lang === 'zh' ? '✓ 标记结清' : '✓ Mark Settled'}
                    </button>
                  )}
                  {!payment && (
                    <span className="text-[10px] text-amber-500 font-medium">
                      {lang === 'zh' ? '点击"生成账单"以启用付款操作' : 'Generate bills to enable payment actions'}
                    </span>
                  )}
                  {payment?.payment_date && (
                    <span className="text-[10px] text-muted-foreground">{lang === 'zh' ? '付款: ' : 'Paid: '}{payment.payment_date}</span>
                  )}
                  {payment?.remark && (
                    <span className="text-[10px] text-muted-foreground italic truncate max-w-[120px]">{payment.remark}</span>
                  )}
                  <div className="ml-auto flex gap-1">
                    {payment && onEdit && (
                      <button onClick={() => onEdit(payment.id)} className="p-1 text-muted-foreground hover:text-foreground">
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {payment && onDelete && (
                      <button onClick={() => onDelete(payment.id)} className="p-1 text-muted-foreground hover:text-destructive">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-3 bg-purple-50 border border-purple-100 rounded-xl px-4 py-2.5 flex justify-between items-center">
          <p className="text-xs font-semibold text-purple-700">{lang === 'zh' ? 'See May 本月账单合计' : 'See May Monthly Total'}</p>
          <p className="text-base font-extrabold text-purple-700">RM {monthTotal.toFixed(2)}</p>
        </div>
      </div>

      {/* 4. Add Contribution */}
      <button
        onClick={() => { setEditingContribId(null); setCollectForm(emptyCollect()); setShowCollectForm(v => !v); }}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-purple-300 text-purple-600 font-semibold text-sm hover:bg-purple-50 transition-colors">
        <Plus className="w-4 h-4" />{lang === 'zh' ? '记录收款（兄弟汇款）' : 'Record Sibling Contribution'}
      </button>

      {/* Contribution Form */}
      {showCollectForm && (
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-purple-700">
              {editingContribId ? (lang === 'zh' ? '编辑收款记录' : 'Edit Contribution') : (lang === 'zh' ? '新增收款记录' : 'Add Contribution')}
            </p>
            <button onClick={() => { setShowCollectForm(false); setEditingContribId(null); }}>
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">{lang === 'zh' ? '金额 (RM)' : 'Amount (RM)'}</label>
              <input type="number" inputMode="decimal" value={collectForm.amount}
                onChange={e => setCollectForm(p => ({ ...p, amount: e.target.value }))}
                placeholder="0.00"
                className="w-full bg-white rounded-xl px-3 py-2 text-sm font-bold border border-purple-200 focus:outline-none focus:ring-1 focus:ring-purple-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">{lang === 'zh' ? '日期' : 'Date'}</label>
              <input type="date" value={collectForm.date}
                onChange={e => setCollectForm(p => ({ ...p, date: e.target.value }))}
                className="w-full bg-white rounded-xl px-3 py-2 text-sm border border-purple-200 focus:outline-none focus:ring-1 focus:ring-purple-400" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">{lang === 'zh' ? '收款来源' : 'Collected From'}</label>
            <input value={collectForm.collected_from}
              onChange={e => setCollectForm(p => ({ ...p, collected_from: e.target.value }))}
              placeholder={lang === 'zh' ? '例：大哥、二姐' : 'e.g. Elder Brother'}
              className="w-full bg-white rounded-xl px-3 py-2 text-sm border border-purple-200 focus:outline-none focus:ring-1 focus:ring-purple-400" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">{lang === 'zh' ? '备注' : 'Notes'}</label>
            <input value={collectForm.notes}
              onChange={e => setCollectForm(p => ({ ...p, notes: e.target.value }))}
              className="w-full bg-white rounded-xl px-3 py-2 text-sm border border-purple-200 focus:outline-none focus:ring-1 focus:ring-purple-400" />
          </div>
          <Button onClick={handleSaveContrib} className="w-full h-10 rounded-xl font-bold bg-purple-600 hover:bg-purple-700 text-white">
            {lang === 'zh' ? '保存' : 'Save'}
          </Button>
        </div>
      )}

      {/* 5. Contribution History (this month) */}
      {thisMonthContribs.length > 0 && (
        <div>
          <p className="text-sm font-bold mb-2">{lang === 'zh' ? '本月收款记录' : 'This Month Contributions'}</p>
          <div className="space-y-1.5">
            {thisMonthContribs.map(e => (
              <div key={e.id} className="flex items-center justify-between rounded-xl px-3 py-2 bg-purple-50 border border-purple-100">
                <div>
                  <p className="text-xs font-semibold">📥 {e.collected_from || (lang === 'zh' ? '收款' : 'Collection')}</p>
                  <p className="text-[10px] text-muted-foreground">{e.date}{e.notes ? ` · ${e.notes}` : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-extrabold text-purple-600">+RM {(e.amount || 0).toFixed(2)}</p>
                  <button onClick={() => handleEditContrib(e)} className="p-1 text-muted-foreground hover:text-purple-600 transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDeleteContrib(e.id)} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 6. All Contributions History */}
      {contributions.length > thisMonthContribs.length && (
        <details className="group">
          <summary className="text-xs font-semibold text-purple-600 cursor-pointer list-none flex items-center gap-1">
            <span>{lang === 'zh' ? '查看所有收款记录' : 'View all contribution history'}</span>
            <span className="text-muted-foreground">({contributions.length})</span>
          </summary>
          <div className="mt-2 space-y-1.5">
            {contributions.filter(e => (e.month || e.date?.substring(0, 7)) !== mStr).map(e => (
              <div key={e.id} className="flex items-center justify-between rounded-xl px-3 py-2 bg-secondary border border-border">
                <div>
                  <p className="text-xs font-semibold">📥 {e.collected_from || (lang === 'zh' ? '收款' : 'Collection')}</p>
                  <p className="text-[10px] text-muted-foreground">{e.date}{e.notes ? ` · ${e.notes}` : ''}</p>
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-extrabold text-purple-600">+RM {(e.amount || 0).toFixed(2)}</p>
                  <button onClick={() => handleEditContrib(e)} className="p-1 text-muted-foreground hover:text-purple-600 transition-colors">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => handleDeleteContrib(e.id)} className="p-1 text-muted-foreground hover:text-destructive transition-colors">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </details>
      )}
    </div>
  );
}