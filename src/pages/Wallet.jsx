import React, { useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { calcMonthlyTotals, monthStr } from '@/lib/finance';
import { GOAL_CATEGORIES, CLAIM_CATEGORIES } from '@/lib/constants';
import ProgressBar from '@/components/ui/ProgressBar';
import { Plus, X, ChevronRight, Landmark, Banknote, Shield, Wrench, Plane, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';

const TODAY = format(new Date(), 'yyyy-MM-dd');
const THIS_MONTH = monthStr();

const emptyClaimForm = () => ({
  title: '', amount: '', date_paid: TODAY, paid_from: 'cash',
  category: 'other', expected_claim_month: THIS_MONTH,
  claim_status: 'to_be_claimed', notes: '',
});

export default function Wallet() {
  const { lang } = useLanguage();
  const queryClient = useQueryClient();
  const [showClaimForm, setShowClaimForm] = useState(false);
  const [editClaim, setEditClaim] = useState(null);
  const [claimForm, setClaimForm] = useState(emptyClaimForm());
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [editGoal, setEditGoal] = useState(null);
  const [goalForm, setGoalForm] = useState({ name: '', category: 'other', target_amount: '', current_saved: '0', monthly_contribution: '', target_date: '', notes: '' });
  const [saving, setSaving] = useState(false);
  const [showAllClaims, setShowAllClaims] = useState(false);

  const { data: allRecords = [] } = useQuery({ queryKey: ['dailyRecords'], queryFn: () => base44.entities.DailyRecord.list('-date', 400) });
  const { data: settlements = [] } = useQuery({ queryKey: ['settlements'], queryFn: () => base44.entities.MonthlySettlement.list('-month', 12) });
  const { data: claims = [] } = useQuery({ queryKey: ['claims'], queryFn: () => base44.entities.Claim.list('-date_paid', 100) });
  const { data: goals = [] } = useQuery({ queryKey: ['goals'], queryFn: () => base44.entities.Goal.list('-created_date', 50) });

  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');
  const monthRecords = allRecords.filter(r => r.date >= monthStart && r.date <= monthEnd);
  const totals = calcMonthlyTotals(monthRecords);
  const settlement = settlements.find(s => s.month === THIS_MONTH);

  const buffer = settlement?.cashflow_buffer ?? 0;
  const carFund = settlement?.car_repair_fund ?? 0;
  const emergency = settlement?.emergency_savings ?? 0;
  const travel = settlement?.travel_savings ?? 0;

  const pendingClaims = claims.filter(c => c.claim_status === 'to_be_claimed');
  const pendingTotal = pendingClaims.reduce((s, c) => s + (c.amount || 0), 0);

  // Claim handlers
  const setClaim = (k, v) => setClaimForm(p => ({ ...p, [k]: v }));
  const openAddClaim = () => { setClaimForm(emptyClaimForm()); setEditClaim(null); setShowClaimForm(true); };
  const openEditClaim = (c) => {
    setClaimForm({ title: c.title, amount: String(c.amount), date_paid: c.date_paid, paid_from: c.paid_from, category: c.category, expected_claim_month: c.expected_claim_month || THIS_MONTH, claim_status: c.claim_status, notes: c.notes || '' });
    setEditClaim(c); setShowClaimForm(true);
  };
  const handleSaveClaim = async () => {
    if (!claimForm.title || !claimForm.amount) return toast.error('Fill required fields');
    setSaving(true);
    const rec = { ...claimForm, amount: parseFloat(claimForm.amount) || 0 };
    if (editClaim) { await base44.entities.Claim.update(editClaim.id, rec); }
    else { await base44.entities.Claim.create(rec); }
    queryClient.invalidateQueries({ queryKey: ['claims'] });
    setSaving(false); setShowClaimForm(false);
    toast.success(lang === 'zh' ? '已保存' : 'Saved');
  };
  const handleDeleteClaim = async (id) => {
    if (!confirm(lang === 'zh' ? '确定删除？' : 'Delete?')) return;
    await base44.entities.Claim.delete(id);
    queryClient.invalidateQueries({ queryKey: ['claims'] });
    setShowClaimForm(false);
  };

  // Goal handlers
  const setGoal = (k, v) => setGoalForm(p => ({ ...p, [k]: v }));
  const openAddGoal = () => { setGoalForm({ name: '', category: 'other', target_amount: '', current_saved: '0', monthly_contribution: '', target_date: '', notes: '' }); setEditGoal(null); setShowGoalForm(true); };
  const openEditGoal = (g) => {
    setGoalForm({ name: g.name, category: g.category, target_amount: String(g.target_amount), current_saved: String(g.current_saved || 0), monthly_contribution: String(g.monthly_contribution || ''), target_date: g.target_date || '', notes: g.notes || '' });
    setEditGoal(g); setShowGoalForm(true);
  };
  const handleSaveGoal = async () => {
    if (!goalForm.name || !goalForm.target_amount) return toast.error('Fill required fields');
    setSaving(true);
    const rec = { ...goalForm, target_amount: parseFloat(goalForm.target_amount) || 0, current_saved: parseFloat(goalForm.current_saved) || 0, monthly_contribution: parseFloat(goalForm.monthly_contribution) || 0, is_active: true };
    if (editGoal) { await base44.entities.Goal.update(editGoal.id, rec); }
    else { await base44.entities.Goal.create(rec); }
    queryClient.invalidateQueries({ queryKey: ['goals'] });
    setSaving(false); setShowGoalForm(false);
    toast.success(lang === 'zh' ? '已保存' : 'Saved');
  };
  const handleDeleteGoal = async (id) => {
    if (!confirm(lang === 'zh' ? '确定删除？' : 'Delete?')) return;
    await base44.entities.Goal.delete(id);
    queryClient.invalidateQueries({ queryKey: ['goals'] });
    setShowGoalForm(false);
  };

  return (
    <div className="px-4 pt-12 pb-8 space-y-5 max-w-lg mx-auto">
      <h1 className="text-xl font-extrabold">{lang === 'zh' ? '我的钱包' : 'Wallet'}</h1>

      {/* Main wallets */}
      <div className="grid grid-cols-2 gap-3">
        <WalletCard icon={<Landmark className="w-5 h-5 text-blue-500" />} label={lang === 'zh' ? '银行' : 'Bank'} amount={totals.bankTotal} thisMonth={totals.bankTotal} bg="bg-blue-50 border-blue-100" textColor="text-blue-700" />
        <WalletCard icon={<Banknote className="w-5 h-5 text-amber-500" />} label={lang === 'zh' ? '现金' : 'Cash'} amount={totals.cashTotal} thisMonth={totals.cashTotal} bg="bg-amber-50 border-amber-100" textColor="text-amber-700" />
      </div>

      {/* Buffer & funds */}
      <div className="space-y-2">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">{lang === 'zh' ? '储备金' : 'Reserve Funds'}</p>
        <FundCard icon={<Shield className="w-4 h-4 text-primary" />} label={lang === 'zh' ? '现金流缓冲' : 'Cash Flow Buffer'}
          sublabel={lang === 'zh' ? '留给下月的资金' : 'Kept for next month'} amount={buffer}
          color={buffer < 0 ? 'text-destructive' : buffer < 300 ? 'text-amber-600' : 'text-primary'}
          bg={buffer < 0 ? 'bg-destructive/5 border-destructive/20' : 'bg-primary/5 border-primary/20'} />
        <FundCard icon={<Wrench className="w-4 h-4 text-amber-600" />} label={lang === 'zh' ? '车辆维修基金' : 'Car Repair Fund'}
          sublabel={lang === 'zh' ? '本月新增' : 'Added this month'} amount={carFund}
          color="text-amber-700" bg="bg-amber-50 border-amber-100" />
        <FundCard icon={<Shield className="w-4 h-4 text-red-500" />} label={lang === 'zh' ? '应急储蓄' : 'Emergency Savings'}
          sublabel={lang === 'zh' ? '本月新增' : 'Added this month'} amount={emergency}
          color="text-red-700" bg="bg-red-50 border-red-100" />
        <FundCard icon={<Plane className="w-4 h-4 text-teal-500" />} label={lang === 'zh' ? '旅行储蓄' : 'Travel Savings'}
          sublabel={lang === 'zh' ? '本月新增' : 'Added this month'} amount={travel}
          color="text-teal-700" bg="bg-teal-50 border-teal-100" />
      </div>

      {/* Claims section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{lang === 'zh' ? '报销记录' : 'Claims'}</p>
          <button onClick={openAddClaim} className="flex items-center gap-1 text-xs text-primary font-semibold">
            <Plus className="w-3 h-3" />{lang === 'zh' ? '添加' : 'Add'}
          </button>
        </div>

        <div className="bg-card rounded-2xl border border-border p-4">
          <div className="flex justify-between items-center">
            <div>
              <p className="text-xs text-muted-foreground">{lang === 'zh' ? '待报销金额' : 'Pending Claims'}</p>
              <p className="text-2xl font-extrabold text-amber-600">RM {pendingTotal.toFixed(2)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{pendingClaims.length} {lang === 'zh' ? '笔待报销' : 'items pending'}</p>
            </div>
            {pendingClaims.length > 0 && (
              <button onClick={() => setShowAllClaims(v => !v)} className="text-xs text-primary font-medium flex items-center gap-0.5">
                {lang === 'zh' ? '查看' : 'View'} {showAllClaims ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </button>
            )}
          </div>
          <AnimatePresence>
            {showAllClaims && (
              <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                <div className="mt-3 pt-3 border-t border-border space-y-2">
                  {claims.slice(0, 8).map(c => (
                    <button key={c.id} onClick={() => openEditClaim(c)} className="w-full flex items-center justify-between text-left py-1">
                      <div>
                        <p className="text-sm font-medium">{c.title}</p>
                        <p className="text-xs text-muted-foreground">{c.date_paid} · {c.claim_status}</p>
                      </div>
                      <span className={`text-sm font-bold ${c.claim_status === 'claimed' ? 'text-primary' : 'text-amber-600'}`}>
                        RM {(c.amount || 0).toFixed(2)}
                      </span>
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Goals section */}
      <div className="space-y-2">
        <div className="flex items-center justify-between px-1">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{lang === 'zh' ? '储蓄目标' : 'Savings Goals'}</p>
          <button onClick={openAddGoal} className="flex items-center gap-1 text-xs text-purple-600 font-semibold">
            <Plus className="w-3 h-3" />{lang === 'zh' ? '新目标' : 'Add'}
          </button>
        </div>
        {goals.length === 0 && (
          <div className="bg-card rounded-2xl border border-border p-4 text-center">
            <p className="text-sm text-muted-foreground">{lang === 'zh' ? '还没有储蓄目标' : 'No savings goals yet'}</p>
            <button onClick={openAddGoal} className="text-xs text-purple-600 font-semibold mt-1">{lang === 'zh' ? '+ 添加第一个目标' : '+ Add your first goal'}</button>
          </div>
        )}
        {goals.map(g => {
          const cat = GOAL_CATEGORIES.find(c => c.key === g.category) || GOAL_CATEGORIES.at(-1);
          const pct = g.target_amount > 0 ? Math.min(100, ((g.current_saved || 0) / g.target_amount) * 100) : 0;
          return (
            <button key={g.id} onClick={() => openEditGoal(g)} className="w-full bg-card rounded-2xl border border-border p-4 text-left">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{cat.icon}</span>
                  <div>
                    <p className="text-sm font-bold">{g.name}</p>
                    <p className="text-xs text-muted-foreground">{pct.toFixed(0)}% {lang === 'zh' ? '完成' : 'complete'}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-base font-extrabold text-purple-600">RM {(g.current_saved || 0).toFixed(0)}</p>
                  <p className="text-xs text-muted-foreground">/ RM {(g.target_amount || 0).toFixed(0)}</p>
                </div>
              </div>
              <ProgressBar value={g.current_saved || 0} max={g.target_amount || 1} barClass="bg-purple-500" />
            </button>
          );
        })}
      </div>

      {/* Claim Form Drawer */}
      <AnimatePresence>
        {showClaimForm && (
          <FormDrawer title={editClaim ? (lang === 'zh' ? '编辑报销' : 'Edit Claim') : (lang === 'zh' ? '添加报销' : 'Add Claim')} onClose={() => setShowClaimForm(false)}>
            <FormField label={lang === 'zh' ? '标题 *' : 'Title *'}><input value={claimForm.title} onChange={e => setClaim('title', e.target.value)} placeholder={lang === 'zh' ? '报销名称' : 'Claim title'} className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary" /></FormField>
            <FormField label={lang === 'zh' ? '金额 (RM) *' : 'Amount (RM) *'}><input type="number" inputMode="decimal" value={claimForm.amount} onChange={e => setClaim('amount', e.target.value)} placeholder="0.00" className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-primary" /></FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label={lang === 'zh' ? '日期' : 'Date'}><input type="date" value={claimForm.date_paid} onChange={e => setClaim('date_paid', e.target.value)} className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" /></FormField>
              <FormField label={lang === 'zh' ? '来源' : 'From'}><select value={claimForm.paid_from} onChange={e => setClaim('paid_from', e.target.value)} className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"><option value="bank">{lang === 'zh' ? '银行' : 'Bank'}</option><option value="cash">{lang === 'zh' ? '现金' : 'Cash'}</option></select></FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label={lang === 'zh' ? '类别' : 'Category'}><select value={claimForm.category} onChange={e => setClaim('category', e.target.value)} className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary">{CLAIM_CATEGORIES.map(c => <option key={c.key} value={c.key}>{lang === 'zh' ? c.labelZh : c.label}</option>)}</select></FormField>
              <FormField label={lang === 'zh' ? '状态' : 'Status'}><select value={claimForm.claim_status} onChange={e => setClaim('claim_status', e.target.value)} className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"><option value="to_be_claimed">{lang === 'zh' ? '待报销' : 'Pending'}</option><option value="claimed">{lang === 'zh' ? '已报销' : 'Claimed'}</option><option value="not_claimable">{lang === 'zh' ? '不可报销' : 'Not Claimable'}</option></select></FormField>
            </div>
            <div className="flex gap-3 pt-1">
              {editClaim && <Button variant="outline" onClick={() => handleDeleteClaim(editClaim.id)} className="h-11 rounded-xl text-destructive border-destructive/30">{lang === 'zh' ? '删除' : 'Delete'}</Button>}
              <Button onClick={handleSaveClaim} disabled={saving} className="flex-1 h-11 rounded-xl font-bold bg-primary">{saving ? '...' : (lang === 'zh' ? '保存' : 'Save')}</Button>
            </div>
          </FormDrawer>
        )}
      </AnimatePresence>

      {/* Goal Form Drawer */}
      <AnimatePresence>
        {showGoalForm && (
          <FormDrawer title={editGoal ? (lang === 'zh' ? '编辑目标' : 'Edit Goal') : (lang === 'zh' ? '新增目标' : 'New Goal')} onClose={() => setShowGoalForm(false)}>
            <FormField label={lang === 'zh' ? '目标名称 *' : 'Goal Name *'}><input value={goalForm.name} onChange={e => setGoal('name', e.target.value)} placeholder={lang === 'zh' ? '例如：旅行基金' : 'e.g. Travel Fund'} className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary" /></FormField>
            <FormField label={lang === 'zh' ? '类别' : 'Category'}>
              <div className="grid grid-cols-3 gap-1.5">
                {GOAL_CATEGORIES.map(c => <button key={c.key} onClick={() => setGoal('category', c.key)} className={`py-1.5 rounded-xl text-xs font-semibold border transition-all ${goalForm.category === c.key ? 'bg-purple-100 border-purple-400 text-purple-700' : 'bg-secondary border-transparent text-muted-foreground'}`}>{c.icon} {lang === 'zh' ? c.labelZh : c.label}</button>)}
              </div>
            </FormField>
            <div className="grid grid-cols-2 gap-3">
              <FormField label={lang === 'zh' ? '目标金额 *' : 'Target (RM) *'}><input type="number" inputMode="decimal" value={goalForm.target_amount} onChange={e => setGoal('target_amount', e.target.value)} placeholder="0.00" className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-primary" /></FormField>
              <FormField label={lang === 'zh' ? '已储蓄 (RM)' : 'Saved (RM)'}><input type="number" inputMode="decimal" value={goalForm.current_saved} onChange={e => setGoal('current_saved', e.target.value)} placeholder="0.00" className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-primary" /></FormField>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <FormField label={lang === 'zh' ? '月存 (RM)' : 'Monthly (RM)'}><input type="number" inputMode="decimal" value={goalForm.monthly_contribution} onChange={e => setGoal('monthly_contribution', e.target.value)} placeholder="0.00" className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-primary" /></FormField>
              <FormField label={lang === 'zh' ? '目标日期' : 'Target Date'}><input type="date" value={goalForm.target_date} onChange={e => setGoal('target_date', e.target.value)} className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" /></FormField>
            </div>
            <div className="flex gap-3 pt-1">
              {editGoal && <Button variant="outline" onClick={() => handleDeleteGoal(editGoal.id)} className="h-11 rounded-xl text-destructive border-destructive/30">{lang === 'zh' ? '删除' : 'Delete'}</Button>}
              <Button onClick={handleSaveGoal} disabled={saving} className="flex-1 h-11 rounded-xl font-bold bg-purple-600 hover:bg-purple-700 text-white">{saving ? '...' : (lang === 'zh' ? '保存目标' : 'Save Goal')}</Button>
            </div>
          </FormDrawer>
        )}
      </AnimatePresence>
    </div>
  );
}

function WalletCard({ icon, label, amount, thisMonth, bg, textColor }) {
  return (
    <div className={`rounded-2xl border p-4 ${bg}`}>
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs font-medium text-muted-foreground">{label}</span></div>
      <p className={`text-2xl font-extrabold ${textColor}`}>RM {(amount || 0).toFixed(2)}</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">{label === 'Bank' || label === '银行' ? 'This month' : 'This month'}</p>
    </div>
  );
}

function FundCard({ icon, label, sublabel, amount, color, bg }) {
  return (
    <div className={`rounded-2xl border p-4 flex items-center justify-between ${bg}`}>
      <div className="flex items-center gap-3">
        {icon}
        <div>
          <p className="text-sm font-semibold">{label}</p>
          <p className="text-xs text-muted-foreground">{sublabel}</p>
        </div>
      </div>
      <p className={`text-xl font-extrabold ${color}`}>RM {(amount || 0).toFixed(2)}</p>
    </div>
  );
}

function FormDrawer({ title, onClose, children }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={onClose}>
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="bg-background w-full max-w-lg mx-auto rounded-t-3xl p-5 space-y-4 max-h-[85vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold">{title}</h2>
          <button onClick={onClose}><X className="w-5 h-5 text-muted-foreground" /></button>
        </div>
        {children}
      </motion.div>
    </motion.div>
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