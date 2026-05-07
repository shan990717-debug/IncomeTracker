import React, { useState } from 'react';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format } from 'date-fns';
import { Plus, Wallet, Pencil, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const emptyCollect = () => ({ amount: '', collected_from: '', date: format(new Date(), 'yyyy-MM-dd'), notes: '' });

export default function SharedFamilyFundSection({ lang, mStr, seeMayPayments = [] }) {
  const queryClient = useQueryClient();
  const [showCollectForm, setShowCollectForm] = useState(false);
  const [collectForm, setCollectForm] = useState(emptyCollect());
  const [editingContrib, setEditingContrib] = useState(null); // id of contribution being edited

  const { data: fundEntries = [] } = useQuery({
    queryKey: ['sharedFamilyFund'],
    queryFn: () => base44.entities.SharedFamilyFund.list('-date', 200),
  });

  const contributions = fundEntries.filter(e => e.type === 'collection');
  const totalCollected = contributions.reduce((s, e) => s + (e.amount || 0), 0);

  // Balance deducts ONLY when status === 'paid' (not pending, not just settled)
  const paidSeeMayTotal = seeMayPayments
    .filter(p => p.status === 'paid' || p.status === 'settled')
    .reduce((s, p) => s + (p.amount || 0), 0);

  const balance = totalCollected - paidSeeMayTotal;

  // This month See May stats
  const monthSeeMay = seeMayPayments.filter(p => p.month === mStr);
  const monthTotal = monthSeeMay.reduce((s, p) => s + (p.amount || 0), 0);
  const monthPaid = monthSeeMay.filter(p => p.status === 'paid' || p.status === 'settled').reduce((s, p) => s + (p.amount || 0), 0);
  const monthPending = monthTotal - monthPaid;

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['sharedFamilyFund'] });

  const handleSaveContrib = async () => {
    if (!collectForm.amount) return;
    if (editingContrib) {
      await base44.entities.SharedFamilyFund.update(editingContrib, {
        amount: parseFloat(collectForm.amount) || 0,
        date: collectForm.date,
        collected_from: collectForm.collected_from,
        notes: collectForm.notes,
      });
      toast.success(lang === 'zh' ? '已更新' : 'Updated');
      setEditingContrib(null);
    } else {
      await base44.entities.SharedFamilyFund.create({
        type: 'collection',
        amount: parseFloat(collectForm.amount) || 0,
        date: collectForm.date,
        collected_from: collectForm.collected_from,
        notes: collectForm.notes,
        month: mStr,
      });
      toast.success(lang === 'zh' ? '收款已记录' : 'Collection recorded');
    }
    invalidate();
    setCollectForm(emptyCollect());
    setShowCollectForm(false);
  };

  const handleEditContrib = (e) => {
    setEditingContrib(e.id);
    setCollectForm({ amount: String(e.amount || ''), collected_from: e.collected_from || '', date: e.date || format(new Date(), 'yyyy-MM-dd'), notes: e.notes || '' });
    setShowCollectForm(true);
  };

  const handleDeleteContrib = async (id) => {
    if (!confirm(lang === 'zh' ? '确定删除此收款记录？' : 'Delete this contribution record?')) return;
    await base44.entities.SharedFamilyFund.delete(id);
    invalidate();
    toast.success(lang === 'zh' ? '已删除' : 'Deleted');
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
          <div className="bg-white/15 rounded-xl p-2 text-center">
            <p className="text-[10px] opacity-75">{lang === 'zh' ? '累计收款' : 'Total Contributions'}</p>
            <p className="text-sm font-bold">RM {totalCollected.toFixed(2)}</p>
          </div>
          <div className="bg-white/15 rounded-xl p-2 text-center">
            <p className="text-[10px] opacity-75">{lang === 'zh' ? '累计已付' : 'Total Paid Out'}</p>
            <p className="text-sm font-bold">RM {paidSeeMayTotal.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* This Month Summary */}
      <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4">
        <p className="text-xs font-bold text-purple-700 mb-3">{lang === 'zh' ? `${mStr} 本月摘要` : `${mStr} Summary`}</p>
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: lang === 'zh' ? '本月合计' : 'Month Total', val: monthTotal, color: 'text-purple-700' },
            { label: lang === 'zh' ? '已付' : 'Paid', val: monthPaid, color: 'text-blue-600' },
            { label: lang === 'zh' ? '待付' : 'Pending', val: monthPending, color: 'text-amber-600' },
          ].map(s => (
            <div key={s.label} className="text-center">
              <p className="text-[10px] text-muted-foreground">{s.label}</p>
              <p className={`text-sm font-extrabold ${s.color}`}>RM {s.val.toFixed(0)}</p>
            </div>
          ))}
        </div>
        <p className="text-[10px] text-purple-500 mt-2">
          {lang === 'zh'
            ? '* 余额 = 累计收款 − 已付（Paid）金额。标记Settled不重复扣除。'
            : '* Balance = Contributions − Paid items. Settling does not deduct again.'}
        </p>
      </div>

      {/* See May payments this month - read-only view */}
      {monthSeeMay.length > 0 && (
        <div>
          <p className="text-xs font-bold text-muted-foreground mb-2">{lang === 'zh' ? '本月 See May 账单' : 'See May Bills This Month'}</p>
          <div className="space-y-2">
            {monthSeeMay.map(p => (
              <div key={p.id} className={`bg-card rounded-xl border px-3 py-2.5 flex items-center justify-between ${p.is_settled ? 'opacity-60 border-emerald-200' : 'border-border'}`}>
                <div>
                  <p className="text-sm font-semibold">{p.bill_name}</p>
                  {p.payment_date && <p className="text-[10px] text-muted-foreground">{lang === 'zh' ? '付款: ' : 'Paid: '}{p.payment_date}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <p className="text-sm font-extrabold">RM {(p.amount || 0).toFixed(2)}</p>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-lg border ${
                    p.is_settled ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                    : p.status === 'paid' ? 'bg-blue-50 text-blue-600 border-blue-200'
                    : 'bg-amber-50 text-amber-600 border-amber-200'
                  }`}>
                    {p.is_settled ? (lang === 'zh' ? '已结' : 'Settled') : p.status === 'paid' ? (lang === 'zh' ? '已付' : 'Paid') : (lang === 'zh' ? '待付' : 'Pending')}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Contribution */}
      <button onClick={() => { setEditingContrib(null); setCollectForm(emptyCollect()); setShowCollectForm(v => !v); }}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border-2 border-dashed border-purple-300 text-purple-600 font-semibold text-sm hover:bg-purple-50 transition-colors">
        <Plus className="w-4 h-4" />{lang === 'zh' ? '记录收款（兄弟汇款）' : 'Record Sibling Contribution'}
      </button>

      {/* Contribution Form */}
      {showCollectForm && (
        <div className="bg-purple-50 border border-purple-200 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-purple-700">
              {editingContrib ? (lang === 'zh' ? '编辑收款记录' : 'Edit Contribution') : (lang === 'zh' ? '新增收款记录' : 'Add Contribution')}
            </p>
            <button onClick={() => { setShowCollectForm(false); setEditingContrib(null); }}><X className="w-4 h-4 text-muted-foreground" /></button>
          </div>
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
          <div>
            <label className="text-xs font-semibold text-muted-foreground mb-1 block">{lang === 'zh' ? '备注' : 'Notes'}</label>
            <input value={collectForm.notes} onChange={e => setCollectForm(p => ({ ...p, notes: e.target.value }))}
              className="w-full bg-white rounded-xl px-3 py-2 text-sm border border-purple-200 focus:outline-none focus:ring-1 focus:ring-purple-400" />
          </div>
          <Button onClick={handleSaveContrib} className="w-full h-10 rounded-xl font-bold bg-purple-600 hover:bg-purple-700 text-white">
            {lang === 'zh' ? '保存' : 'Save'}
          </Button>
        </div>
      )}

      {/* Contribution History */}
      {contributions.length > 0 && (
        <div>
          <p className="text-sm font-bold mb-2">{lang === 'zh' ? '收款记录' : 'Contribution History'}</p>
          <div className="space-y-1.5">
            {contributions.map(e => (
              <div key={e.id} className="flex items-center justify-between rounded-xl px-3 py-2 bg-purple-50 border border-purple-100">
                <div>
                  <p className="text-xs font-semibold">📥 {e.collected_from || (lang === 'zh' ? '收款' : 'Collection')}</p>
                  <p className="text-[10px] text-muted-foreground">{e.date} {e.notes ? `· ${e.notes}` : ''}</p>
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
    </div>
  );
}