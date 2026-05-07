import React, { useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { GOAL_CATEGORIES } from '@/lib/constants';
import { Plus, X, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ProgressBar from '@/components/ui/ProgressBar';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { differenceInMonths } from 'date-fns';

// Default funds shown prominently
const DEFAULT_FUND_KEYS = ['tuition', 'travel', 'emergency'];
const TRAVEL_TARGET = 4000;

const emptyForm = () => ({
  name: '', category: 'tuition', target_amount: '', current_saved: '0',
  monthly_contribution: '', target_date: '', is_active: true, notes: '',
});

export default function Goals() {
  const { lang } = useLanguage();
  const queryClient = useQueryClient();
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  const { data: goals = [] } = useQuery({
    queryKey: ['goals'],
    queryFn: () => base44.entities.Goal.list('-created_date', 50),
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const openAdd = (category = 'tuition') => {
    const defaults = category === 'travel' ? { ...emptyForm(), category: 'travel', name: lang === 'zh' ? '旅游基金' : 'Travel Fund', target_amount: String(TRAVEL_TARGET) } : { ...emptyForm(), category };
    setForm(defaults);
    setEditItem(null);
    setShowForm(true);
  };

  const openEdit = (g) => {
    setForm({ name: g.name, category: g.category, target_amount: String(g.target_amount), current_saved: String(g.current_saved || 0), monthly_contribution: String(g.monthly_contribution || ''), target_date: g.target_date || '', is_active: g.is_active !== false, notes: g.notes || '' });
    setEditItem(g);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.target_amount) return toast.error(lang === 'zh' ? '请填写必填项' : 'Fill required fields');
    setSaving(true);
    const record = { ...form, target_amount: parseFloat(form.target_amount) || 0, current_saved: parseFloat(form.current_saved) || 0, monthly_contribution: parseFloat(form.monthly_contribution) || 0 };
    if (editItem) { await base44.entities.Goal.update(editItem.id, record); }
    else { await base44.entities.Goal.create(record); }
    queryClient.invalidateQueries({ queryKey: ['goals'] });
    setSaving(false);
    setShowForm(false);
    toast.success(lang === 'zh' ? '已保存' : 'Saved');
  };

  const handleDelete = async (id) => {
    if (!confirm(lang === 'zh' ? '确定删除？' : 'Delete goal?')) return;
    await base44.entities.Goal.delete(id);
    queryClient.invalidateQueries({ queryKey: ['goals'] });
    toast.success(lang === 'zh' ? '已删除' : 'Deleted');
    setShowForm(false);
  };

  // Separate default funds from custom goals
  const defaultGoals = DEFAULT_FUND_KEYS.map(k => goals.find(g => g.category === k && g.is_active !== false)).filter(Boolean);
  const customGoals = goals.filter(g => !DEFAULT_FUND_KEYS.includes(g.category) && g.is_active !== false);
  const missingDefaults = DEFAULT_FUND_KEYS.filter(k => !goals.find(g => g.category === k && g.is_active !== false));

  const totalSaved = goals.filter(g => g.is_active !== false).reduce((s, g) => s + (g.current_saved || 0), 0);
  const totalTarget = goals.filter(g => g.is_active !== false).reduce((s, g) => s + (g.target_amount || 0), 0);

  return (
    <div className="px-4 pt-14 pb-6 space-y-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-extrabold">{lang === 'zh' ? '储蓄目标' : 'Savings Goals'}</h1>
        <Button onClick={() => openAdd()} size="sm" className="h-9 rounded-xl font-semibold bg-primary">
          <Plus className="w-4 h-4 mr-1" />{lang === 'zh' ? '添加' : 'Add'}
        </Button>
      </div>

      {/* Overview */}
      <div className="bg-gradient-to-br from-purple-600 to-purple-700 rounded-2xl p-5 text-white">
        <div className="flex items-center gap-2 mb-1"><Target className="w-4 h-4 opacity-75" /><p className="text-xs opacity-75">{lang === 'zh' ? '总储蓄进度' : 'Total Savings Progress'}</p></div>
        <p className="text-3xl font-extrabold">RM {totalSaved.toFixed(2)}</p>
        <p className="text-xs opacity-75 mt-0.5">{lang === 'zh' ? `目标: RM${totalTarget.toFixed(0)}` : `of RM${totalTarget.toFixed(0)} target`}</p>
        <div className="mt-3 h-2 bg-white/20 rounded-full overflow-hidden">
          <div className="h-full bg-white rounded-full transition-all" style={{ width: `${totalTarget > 0 ? Math.min(100, (totalSaved / totalTarget) * 100) : 0}%` }} />
        </div>
      </div>

      {/* Savings Funds label */}
      <p className="text-sm font-bold text-muted-foreground">{lang === 'zh' ? '储蓄基金' : 'Savings Funds'}</p>

      {/* Default fund goals */}
      {defaultGoals.map(g => <GoalCard key={g.id} goal={g} lang={lang} onEdit={() => openEdit(g)} />)}

      {/* Placeholder for missing default funds */}
      {missingDefaults.map(k => {
        const cat = GOAL_CATEGORIES.find(c => c.key === k);
        return (
          <button key={k} onClick={() => openAdd(k)}
            className="w-full bg-card border border-dashed border-border rounded-2xl p-4 flex items-center gap-3 text-left hover:border-primary/40 transition-colors">
            <span className="text-2xl">{cat?.icon}</span>
            <div>
              <p className="text-sm font-semibold text-muted-foreground">{lang === 'zh' ? cat?.labelZh : cat?.label}</p>
              <p className="text-xs text-muted-foreground">{lang === 'zh' ? '点击设置目标' : 'Tap to set up'}{k === 'travel' ? ` (RM${TRAVEL_TARGET} target)` : ''}</p>
            </div>
            <Plus className="w-4 h-4 text-muted-foreground ml-auto" />
          </button>
        );
      })}

      {/* Custom goals */}
      {customGoals.length > 0 && (
        <>
          <p className="text-sm font-bold text-muted-foreground">{lang === 'zh' ? '其他目标' : 'Other Goals'}</p>
          {customGoals.map(g => <GoalCard key={g.id} goal={g} lang={lang} onEdit={() => openEdit(g)} />)}
        </>
      )}

      {/* Form Drawer */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setShowForm(false)}>
            <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="bg-background w-full max-w-lg mx-auto rounded-t-3xl flex flex-col max-h-[90vh]"
              onClick={e => e.stopPropagation()}>

              {/* Sticky Header */}
              <div className="flex items-center justify-between px-5 pt-5 pb-3 border-b border-border shrink-0">
                <h2 className="text-base font-bold">{editItem ? (lang === 'zh' ? '编辑目标' : 'Edit Goal') : (lang === 'zh' ? '新增目标' : 'New Goal')}</h2>
                <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
              </div>

              {/* Scrollable Body */}
              <div className="overflow-y-auto flex-1 px-5 py-4 space-y-3">
                <FormField label={lang === 'zh' ? '目标名称 *' : 'Goal Name *'}>
                  <input value={form.name} onChange={e => set('name', e.target.value)} placeholder={lang === 'zh' ? '例如：学费基金' : 'e.g. Tuition Fund'} className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary" />
                </FormField>
                <FormField label={lang === 'zh' ? '类别' : 'Category'}>
                  <div className="grid grid-cols-3 gap-2">
                    {GOAL_CATEGORIES.map(c => (
                      <button key={c.key} onClick={() => set('category', c.key)}
                        className={`py-2 rounded-xl text-xs font-semibold border transition-all ${form.category === c.key ? 'bg-purple-100 border-purple-400 text-purple-700' : 'bg-secondary border-transparent text-muted-foreground'}`}>
                        {c.icon} {lang === 'zh' ? c.labelZh : c.label}
                      </button>
                    ))}
                  </div>
                </FormField>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label={lang === 'zh' ? '目标金额 (RM) *' : 'Target (RM) *'}>
                    <input type="number" inputMode="decimal" value={form.target_amount} onChange={e => set('target_amount', e.target.value)} placeholder="0.00" className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-primary" />
                  </FormField>
                  <FormField label={lang === 'zh' ? '已储蓄 (RM)' : 'Saved (RM)'}>
                    <input type="number" inputMode="decimal" value={form.current_saved} onChange={e => set('current_saved', e.target.value)} placeholder="0.00" className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-primary" />
                  </FormField>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <FormField label={lang === 'zh' ? '月存 (RM)' : 'Monthly (RM)'}>
                    <input type="number" inputMode="decimal" value={form.monthly_contribution} onChange={e => set('monthly_contribution', e.target.value)} placeholder="0.00" className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-primary" />
                  </FormField>
                  <FormField label={lang === 'zh' ? '目标日期' : 'Target Date'}>
                    <input type="date" value={form.target_date} onChange={e => set('target_date', e.target.value)} className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
                  </FormField>
                </div>
                <FormField label={lang === 'zh' ? '备注' : 'Notes'}>
                  <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-none" />
                </FormField>
              </div>

              {/* Sticky Footer */}
              <div className="flex gap-3 px-5 py-4 border-t border-border shrink-0">
                {editItem && (
                  <Button variant="outline" onClick={() => handleDelete(editItem.id)} className="h-11 rounded-xl text-destructive border-destructive/30 hover:bg-destructive/10">
                    {lang === 'zh' ? '删除' : 'Delete'}
                  </Button>
                )}
                <Button onClick={handleSave} disabled={saving} className="flex-1 h-11 rounded-xl font-bold bg-purple-600 hover:bg-purple-700 text-white">
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

function GoalCard({ goal, lang, onEdit }) {
  const cat = GOAL_CATEGORIES.find(c => c.key === goal.category) || GOAL_CATEGORIES.at(-1);
  const pct = goal.target_amount > 0 ? Math.min(100, ((goal.current_saved || 0) / goal.target_amount) * 100) : 0;
  const remaining = (goal.target_amount || 0) - (goal.current_saved || 0);
  const monthly = goal.monthly_contribution || 0;
  const monthsNeeded = monthly > 0 && remaining > 0 ? Math.ceil(remaining / monthly) : null;
  const targetDate = goal.target_date ? new Date(goal.target_date) : null;
  const monthsLeft = targetDate ? differenceInMonths(targetDate, new Date()) : null;
  const requiredMonthly = monthsLeft > 0 ? (remaining / monthsLeft).toFixed(2) : null;

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="bg-card rounded-2xl border border-border p-4 space-y-3 cursor-pointer" onClick={onEdit}>
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{cat.icon}</span>
          <div>
            <p className="text-sm font-bold">{goal.name}</p>
            <p className="text-xs text-muted-foreground">{lang === 'zh' ? cat.labelZh : cat.label}</p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-base font-extrabold text-purple-600">RM {(goal.current_saved || 0).toFixed(0)}</p>
          <p className="text-xs text-muted-foreground">/ RM {(goal.target_amount || 0).toFixed(0)}</p>
        </div>
      </div>
      <div>
        <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
          <span>{pct.toFixed(0)}% {lang === 'zh' ? '完成' : 'complete'}</span>
          <span>{lang === 'zh' ? `还需 RM${remaining.toFixed(0)}` : `RM${remaining.toFixed(0)} to go`}</span>
        </div>
        <ProgressBar value={goal.current_saved || 0} max={goal.target_amount || 1} barClass="bg-purple-500" />
      </div>
      {(monthsNeeded || requiredMonthly) && (
        <div className="bg-purple-50 rounded-xl p-3 text-xs text-purple-700 space-y-0.5">
          {monthsNeeded && <p>📅 {lang === 'zh' ? `按月存 RM${monthly}，需 ${monthsNeeded} 个月` : `Saving RM${monthly}/mo → ${monthsNeeded} months`}</p>}
          {requiredMonthly && targetDate && <p>🎯 {lang === 'zh' ? `达标每月需存 RM${requiredMonthly}` : `Need RM${requiredMonthly}/mo to hit target date`}</p>}
        </div>
      )}
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