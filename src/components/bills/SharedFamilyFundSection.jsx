import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Plus, X, Check, Wallet } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const STATUS_CONFIG = {
  pending:  { label: 'Pending',  labelZh: '待付',   bg: 'bg-amber-50',   text: 'text-amber-600',   border: 'border-amber-200' },
  paid:     { label: 'Paid',     labelZh: '已付',   bg: 'bg-blue-50',    text: 'text-blue-600',    border: 'border-blue-200' },
  settled:  { label: 'Settled',  labelZh: '已结',   bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
};

export default function SharedFamilyFundSection({ lang, mStr, sharedBills, payments, onPaymentsChange }) {
  const queryClient = useQueryClient();
  const [showCollectForm, setShowCollectForm] = useState(false);
  const [collectForm, setCollectForm] = useState({ amount: '', collected_from: '', date: format(new Date(), 'yyyy-MM-dd'), notes: '' });

  const { data: fundEntries = [] } = useQuery({
    queryKey: ['sharedFamilyFund'],
    queryFn: () => base44.entities.SharedFamilyFund.list('-date', 100),
  });

  const totalCollected = fundEntries.filter(e => e.type === 'collection').reduce((s, e) => s + (e.amount || 0), 0);
  const totalDeducted = fundEntries.filter(e => e.type === 'deduction').reduce((s, e) => s + (e.amount || 0), 0);
  const balance = totalCollected - totalDeducted;

  const sharedMonthlyTotal = payments.reduce((s, p) => s + (p.amount || 0), 0);

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

  const generateSharedPayments = async () => {
    const existing = payments.map(p => p.bill_id).filter(Boolean);
    const toCreate = sharedBills.filter(b => !existing.includes(b.id)).map(b => ({
      bill_id: b.id, bill_name: b.name, month: mStr, amount: b.default_amount || 0,
      section: 'shared_family', category: b.category, status: 'pending', is_settled: false, is_shared_family: true,
    }));
    if (toCreate.length > 0) {
      await base44.entities.BillPayment.bulkCreate(toCreate);
      onPaymentsChange();
      toast.success(lang === 'zh' ? '已生成基金账单' : 'Fund bills generated');
    }
  };

  const markPaid = async (p) => {
    await base44.entities.BillPayment.update(p.id, { status: 'paid', payment_date: format(new Date(), 'yyyy-MM-dd') });
    // Record deduction
    await base44.entities.SharedFamilyFund.create({
      type: 'deduction', amount: p.amount, date: format(new Date(), 'yyyy-MM-dd'),
      notes: p.bill_name, month: mStr, bill_payment_id: p.id,
    });
    queryClient.invalidateQueries({ queryKey: ['sharedFamilyFund'] });
    onPaymentsChange();
    toast.success(lang === 'zh' ? '已付款，已从基金扣除' : 'Paid & deducted from fund');
  };

  const toggleSettled = async (p) => {
    await base44.entities.BillPayment.update(p.id, { is_settled: !p.is_settled, status: !p.is_settled ? 'settled' : 'paid' });
    onPaymentsChange();
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
        <div className="grid grid-cols-2 gap-2 mt-3">
          <div className="bg-white/15 rounded-xl p-2.5 text-center">
            <p className="text-[10px] opacity-75">{lang === 'zh' ? '累计收款' : 'Total Collected'}</p>
            <p className="text-sm font-bold">RM {totalCollected.toFixed(0)}</p>
          </div>
          <div className="bg-white/15 rounded-xl p-2.5 text-center">
            <p className="text-[10px] opacity-75">{lang === 'zh' ? '累计支出' : 'Total Deducted'}</p>
            <p className="text-sm font-bold">RM {totalDeducted.toFixed(0)}</p>
          </div>
        </div>
        <div className="mt-2 pt-2 border-t border-white/20 flex justify-between text-xs opacity-80">
          <span>{lang === 'zh' ? '本月 See May 支出' : 'This month See May payments'}</span>
          <span className="font-bold">RM {sharedMonthlyTotal.toFixed(2)}</span>
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
          <p className="text-sm font-bold text-purple-700">{lang === 'zh' ? '新增收款记录' : 'Add See May Contribution'}</p>
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
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">{lang === 'zh' ? '收款来源（哪位兄弟）' : 'Collected From'}</label>
            <input value={collectForm.collected_from} onChange={e => setCollectForm(p => ({ ...p, collected_from: e.target.value }))}
              placeholder={lang === 'zh' ? '例：大哥、二姐' : 'e.g. Elder Brother'}
              className="w-full bg-white rounded-xl px-3 py-2 text-sm border border-purple-200 focus:outline-none focus:ring-1 focus:ring-purple-400" />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">{lang === 'zh' ? '备注' : 'Notes'}</label>
            <input value={collectForm.notes} onChange={e => setCollectForm(p => ({ ...p, notes: e.target.value }))}
              className="w-full bg-white rounded-xl px-3 py-2 text-sm border border-purple-200 focus:outline-none focus:ring-1 focus:ring-purple-400" />
          </div>
          <Button onClick={handleAddCollection} className="w-full h-10 rounded-xl font-bold bg-purple-600 hover:bg-purple-700 text-white">
            {lang === 'zh' ? '保存收款' : 'Save Collection'}
          </Button>
        </div>
      )}

      {/* Monthly Bills */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-bold">{lang === 'zh' ? '本月 See May 账单' : "This Month's See May Bills"}</p>
          {payments.length === 0 && (
            <button onClick={generateSharedPayments} className="text-xs text-purple-600 font-semibold hover:underline">{lang === 'zh' ? '生成账单' : 'Generate'}</button>
          )}
        </div>
        {payments.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-3">{lang === 'zh' ? '点击"生成账单"创建本月账单' : 'Tap Generate to create this month\'s bills'}</p>
        )}
        {payments.map(p => {
          const s = STATUS_CONFIG[p.status] || STATUS_CONFIG.pending;
          return (
            <div key={p.id} className={`bg-card rounded-2xl border ${s.border} p-3 mb-2 flex items-center gap-3`}>
              <button onClick={() => toggleSettled(p)}
                className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center shrink-0 transition-all ${p.is_settled ? 'bg-emerald-500 border-emerald-500' : 'border-muted-foreground/40'}`}>
                {p.is_settled && <Check className="w-3.5 h-3.5 text-white" />}
              </button>
              <div className="flex-1 min-w-0">
                <p className={`text-sm font-semibold ${p.is_settled ? 'line-through text-muted-foreground' : ''}`}>{p.bill_name}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${s.bg} ${s.text} ${s.border}`}>{lang === 'zh' ? s.labelZh : s.label}</span>
                  {p.payment_date && <span className="text-[10px] text-muted-foreground">{p.payment_date}</span>}
                </div>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-extrabold">RM {(p.amount || 0).toFixed(2)}</p>
                {p.status === 'pending' && (
                  <button onClick={() => markPaid(p)} className="text-[10px] text-blue-600 font-semibold hover:underline">{lang === 'zh' ? '付款' : 'Pay'}</button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Fund History */}
      {fundEntries.length > 0 && (
        <div>
          <p className="text-sm font-bold mb-2">{lang === 'zh' ? 'See May 流水记录' : 'See May History'}</p>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {fundEntries.slice(0, 20).map(e => (
              <div key={e.id} className={`flex items-center justify-between rounded-xl px-3 py-2 ${e.type === 'collection' ? 'bg-purple-50 border border-purple-100' : 'bg-secondary border border-border'}`}>
                <div>
                  <p className="text-xs font-semibold">{e.type === 'collection' ? `📥 ${e.collected_from || (lang === 'zh' ? '收款' : 'Collection')}` : `📤 ${e.notes || (lang === 'zh' ? '支出' : 'Deduction')}`}</p>
                  <p className="text-[10px] text-muted-foreground">{e.date}</p>
                </div>
                <p className={`text-sm font-extrabold ${e.type === 'collection' ? 'text-purple-600' : 'text-muted-foreground'}`}>
                  {e.type === 'collection' ? '+' : '-'}RM {(e.amount || 0).toFixed(2)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}