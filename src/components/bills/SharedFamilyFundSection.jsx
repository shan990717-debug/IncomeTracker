import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Plus, Check, Wallet, Pencil, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

// See May default checklist items
const SEE_MAY_ITEMS = [
  { key: 'car_loan_axia',      name: 'Car Loan（Axia）',         nameZh: '车贷（Axia）',      fixedAmount: 427.00,  isFixed: true },
  { key: 'electricity_popo',   name: 'Electricity Bill（Popo）', nameZh: '电费（婆婆）',        fixedAmount: null,    isFixed: false },
];

export default function SharedFamilyFundSection({ lang, mStr }) {
  const queryClient = useQueryClient();
  const [showCollectForm, setShowCollectForm] = useState(false);
  const [collectForm, setCollectForm] = useState({ amount: '', collected_from: '', date: format(new Date(), 'yyyy-MM-dd'), notes: '' });
  const [editAmounts, setEditAmounts] = useState({});
  const [editRemarks, setEditRemarks] = useState({});

  // Use SharedFamilyFund entity to store checklist items per month
  const { data: fundEntries = [] } = useQuery({
    queryKey: ['sharedFamilyFund'],
    queryFn: () => base44.entities.SharedFamilyFund.list('-date', 200),
  });

  // Contributions (type=collection)
  const contributions = fundEntries.filter(e => e.type === 'collection');
  const totalCollected = contributions.reduce((s, e) => s + (e.amount || 0), 0);

  // Checklist payments for this month (type=deduction, stored with key in notes field as "checklist:{key}")
  const monthChecklist = fundEntries.filter(e => e.month === mStr && e.type === 'deduction' && e.notes?.startsWith('checklist:'));

  const getCheckItem = (key) => monthChecklist.find(e => e.notes === `checklist:${key}`);

  const totalDeducted = fundEntries.filter(e => e.type === 'deduction').reduce((s, e) => s + (e.amount || 0), 0);
  const balance = totalCollected - totalDeducted;

  const monthPaymentTotal = SEE_MAY_ITEMS.reduce((s, item) => {
    const rec = getCheckItem(item.key);
    return s + (rec ? (rec.amount || 0) : 0);
  }, 0);

  const pendingCount = SEE_MAY_ITEMS.filter(item => !getCheckItem(item.key)?.is_settled).length;

  // Mark item as paid / unpaid
  const togglePaid = async (item) => {
    const existing = getCheckItem(item.key);
    if (existing) {
      // Toggle settled
      await base44.entities.SharedFamilyFund.update(existing.id, { is_settled: !existing.is_settled });
      queryClient.invalidateQueries({ queryKey: ['sharedFamilyFund'] });
    } else {
      // Create new checklist deduction record
      const amt = item.isFixed ? item.fixedAmount : (parseFloat(editAmounts[item.key]) || 0);
      if (!item.isFixed && !amt) {
        toast.error(lang === 'zh' ? '请先输入金额' : 'Please enter amount first');
        return;
      }
      await base44.entities.SharedFamilyFund.create({
        type: 'deduction',
        amount: amt,
        date: format(new Date(), 'yyyy-MM-dd'),
        month: mStr,
        notes: `checklist:${item.key}`,
        collected_from: item.name,
        is_settled: true,
      });
      queryClient.invalidateQueries({ queryKey: ['sharedFamilyFund'] });
      toast.success(lang === 'zh' ? '已标记付款' : 'Marked as paid');
    }
  };

  const saveAmount = async (item) => {
    const existing = getCheckItem(item.key);
    const amt = parseFloat(editAmounts[item.key]) || 0;
    if (existing) {
      await base44.entities.SharedFamilyFund.update(existing.id, { amount: amt });
    } else {
      await base44.entities.SharedFamilyFund.create({
        type: 'deduction', amount: amt, date: format(new Date(), 'yyyy-MM-dd'),
        month: mStr, notes: `checklist:${item.key}`, collected_from: item.name, is_settled: false,
      });
    }
    setEditAmounts(p => ({ ...p, [item.key]: undefined }));
    queryClient.invalidateQueries({ queryKey: ['sharedFamilyFund'] });
  };

  const handleAddCollection = async () => {
    if (!collectForm.amount) return;
    await base44.entities.SharedFamilyFund.create({
      type: 'collection', amount: parseFloat(collectForm.amount) || 0,
      date: collectForm.date, collected_from: collectForm.collected_from, notes: collectForm.notes, month: mStr,
    });
    queryClient.invalidateQueries({ queryKey: ['sharedFamilyFund'] });
    setCollectForm({ amount: '', collected_from: '', date: format(new Date(), 'yyyy-MM-dd'), notes: '' });
    setShowCollectForm(false);
    toast.success(lang === 'zh' ? '收款已记录' : 'Collection recorded');
  };

  return (
    <div className="space-y-4">
      {/* Fund Balance Card */}
      <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-2 mb-1">
          <Wallet className="w-4 h-4 opacity-75" />
          <p className="text-xs opacity-75 font-medium">See May Fund Balance</p>
        </div>
        <p className="text-3xl font-extrabold">RM {balance.toFixed(2)}</p>
        <div className="grid grid-cols-3 gap-2 mt-3">
          <div className="bg-white/15 rounded-xl p-2 text-center">
            <p className="text-[10px] opacity-75">{lang === 'zh' ? '累计收款' : 'Total In'}</p>
            <p className="text-sm font-bold">RM {totalCollected.toFixed(0)}</p>
          </div>
          <div className="bg-white/15 rounded-xl p-2 text-center">
            <p className="text-[10px] opacity-75">{lang === 'zh' ? '本月支出' : 'Month Pay'}</p>
            <p className="text-sm font-bold">RM {monthPaymentTotal.toFixed(0)}</p>
          </div>
          <div className="bg-white/15 rounded-xl p-2 text-center">
            <p className="text-[10px] opacity-75">{lang === 'zh' ? '待付项目' : 'Pending'}</p>
            <p className="text-sm font-bold">{pendingCount}</p>
          </div>
        </div>
      </div>

      {/* Payment Checklist */}
      <div>
        <p className="text-sm font-bold mb-2">{lang === 'zh' ? 'See May 本月付款清单' : 'See May Payment Checklist'}</p>
        <div className="space-y-2">
          {SEE_MAY_ITEMS.map(item => {
            const rec = getCheckItem(item.key);
            const isPaid = rec?.is_settled || false;
            const displayAmt = rec ? rec.amount : (item.isFixed ? item.fixedAmount : null);
            const isEditingAmt = editAmounts[item.key] !== undefined;

            return (
              <div key={item.key} className={`bg-card rounded-2xl border p-3 transition-all ${isPaid ? 'opacity-70 border-emerald-200' : 'border-border'}`}>
                <div className="flex items-center gap-3">
                  {/* Paid checkbox */}
                  <button onClick={() => togglePaid(item)}
                    className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${isPaid ? 'bg-emerald-500 border-emerald-500' : 'border-muted-foreground/40 hover:border-emerald-400'}`}>
                    {isPaid && <Check className="w-3.5 h-3.5 text-white" />}
                  </button>

                  {/* Name */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold ${isPaid ? 'line-through text-muted-foreground' : ''}`}>
                      {lang === 'zh' ? item.nameZh : item.name}
                    </p>
                    {rec?.date && <p className="text-[10px] text-muted-foreground">{lang === 'zh' ? '付款: ' : 'Paid: '}{rec.date}</p>}
                  </div>

                  {/* Amount */}
                  {item.isFixed ? (
                    <p className="text-sm font-extrabold text-foreground">RM {item.fixedAmount.toFixed(2)}</p>
                  ) : (
                    <div className="flex items-center gap-1">
                      {isEditingAmt ? (
                        <>
                          <input type="number" inputMode="decimal" autoFocus
                            value={editAmounts[item.key]}
                            onChange={e => setEditAmounts(p => ({ ...p, [item.key]: e.target.value }))}
                            className="w-20 text-right bg-secondary rounded-lg px-2 py-1 text-sm font-bold border border-border focus:outline-none focus:ring-1 focus:ring-primary" />
                          <button onClick={() => saveAmount(item)} className="p-1 text-primary"><Check className="w-3.5 h-3.5" /></button>
                          <button onClick={() => setEditAmounts(p => ({ ...p, [item.key]: undefined }))} className="p-1 text-muted-foreground"><X className="w-3.5 h-3.5" /></button>
                        </>
                      ) : (
                        <button onClick={() => setEditAmounts(p => ({ ...p, [item.key]: String(displayAmt || '') }))}
                          className="text-sm font-extrabold text-foreground hover:text-primary transition-colors flex items-center gap-1">
                          {displayAmt != null ? `RM ${parseFloat(displayAmt).toFixed(2)}` : <span className="text-muted-foreground text-xs font-medium">{lang === 'zh' ? '点击输入' : 'Enter amt'}</span>}
                          <Pencil className="w-3 h-3 text-muted-foreground" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {/* Month total */}
        <div className="mt-3 bg-purple-50 border border-purple-100 rounded-xl px-4 py-2.5 flex justify-between items-center">
          <p className="text-xs font-semibold text-purple-700">{lang === 'zh' ? 'See May 本月付款合计' : 'See May Monthly Total'}</p>
          <p className="text-base font-extrabold text-purple-700">RM {monthPaymentTotal.toFixed(2)}</p>
        </div>
      </div>

      {/* Add Collection Button */}
      <button onClick={() => setShowCollectForm(v => !v)}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-purple-300 text-purple-600 font-semibold text-sm hover:bg-purple-50 transition-colors">
        <Plus className="w-4 h-4" />{lang === 'zh' ? '记录收款（兄弟汇款）' : 'Record Sibling Contribution'}
      </button>

      {/* Collect Form */}
      {showCollectForm && (
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 space-y-3">
          <p className="text-sm font-bold text-purple-700">{lang === 'zh' ? '新增收款记录' : 'Add Contribution'}</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">{lang === 'zh' ? '金额 (RM)' : 'Amount (RM)'}</label>
              <input type="number" inputMode="decimal" value={collectForm.amount} onChange={e => setCollectForm(p => ({ ...p, amount: e.target.value }))}
                placeholder="0.00" className="w-full bg-white rounded-xl px-3 py-2 text-sm font-bold border border-purple-200 focus:outline-none focus:ring-1 focus:ring-purple-400" />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground mb-1 block">{lang === 'zh' ? '日期' : 'Date'}</label>
              <input type="date" value={collectForm.date} onChange={e => setCollectForm(p => ({ ...p, date: e.target.value }))}
                className="w-full bg-white rounded-xl px-3 py-2 text-sm border border-purple-200 focus:outline-none focus:ring-1 focus:ring-purple-400" />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">{lang === 'zh' ? '收款来源' : 'Collected From'}</label>
            <input value={collectForm.collected_from} onChange={e => setCollectForm(p => ({ ...p, collected_from: e.target.value }))}
              placeholder={lang === 'zh' ? '例：大哥、二姐' : 'e.g. Elder Brother'}
              className="w-full bg-white rounded-xl px-3 py-2 text-sm border border-purple-200 focus:outline-none focus:ring-1 focus:ring-purple-400" />
          </div>
          <Button onClick={handleAddCollection} className="w-full h-10 rounded-xl font-bold bg-purple-600 hover:bg-purple-700 text-white">
            {lang === 'zh' ? '保存收款' : 'Save'}
          </Button>
        </div>
      )}

      {/* History */}
      {contributions.length > 0 && (
        <div>
          <p className="text-sm font-bold mb-2">{lang === 'zh' ? '收款记录' : 'Contribution History'}</p>
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {contributions.slice(0, 10).map(e => (
              <div key={e.id} className="flex items-center justify-between rounded-xl px-3 py-2 bg-purple-50 border border-purple-100">
                <div>
                  <p className="text-xs font-semibold">📥 {e.collected_from || (lang === 'zh' ? '收款' : 'Collection')}</p>
                  <p className="text-[10px] text-muted-foreground">{e.date} · {e.month}</p>
                </div>
                <p className="text-sm font-extrabold text-purple-600">+RM {(e.amount || 0).toFixed(2)}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}