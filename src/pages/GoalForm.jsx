import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/i18n';
import { useQueryClient } from '@tanstack/react-query';
import { GOAL_CATEGORIES } from '@/lib/constants';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const TRAVEL_TARGET = 4000;

const emptyForm = () => ({
  name: '', category: 'tuition', target_amount: '', current_saved: '0',
  monthly_contribution: '', target_date: '', is_active: true, notes: '',
});

export default function GoalForm() {
  const { lang } = useLanguage();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const queryClient = useQueryClient();

  const editId = searchParams.get('id');
  const defaultCategory = searchParams.get('category') || 'tuition';

  const [form, setForm] = useState(() => {
    const f = emptyForm();
    f.category = defaultCategory;
    if (defaultCategory === 'travel') {
      f.name = 'Travel Fund';
      f.target_amount = String(TRAVEL_TARGET);
    }
    return f;
  });
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(!editId);

  useEffect(() => {
    if (editId) {
      base44.entities.Goal.list('-created_date', 50).then(all => {
        const goal = all.find(g => g.id === editId);
        if (goal) {
          setForm({
            name: goal.name, category: goal.category,
            target_amount: String(goal.target_amount),
            current_saved: String(goal.current_saved || 0),
            monthly_contribution: String(goal.monthly_contribution || ''),
            target_date: goal.target_date || '',
            is_active: goal.is_active !== false,
            notes: goal.notes || '',
          });
        }
        setLoaded(true);
      });
    }
  }, [editId]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  const handleSave = async () => {
    if (!form.name || !form.target_amount) return toast.error(lang === 'zh' ? '请填写必填项' : 'Fill required fields');
    setSaving(true);
    const record = {
      ...form,
      target_amount: parseFloat(form.target_amount) || 0,
      current_saved: parseFloat(form.current_saved) || 0,
      monthly_contribution: parseFloat(form.monthly_contribution) || 0,
    };
    if (editId) {
      await base44.entities.Goal.update(editId, record);
    } else {
      await base44.entities.Goal.create(record);
    }
    queryClient.invalidateQueries({ queryKey: ['goals'] });
    toast.success(lang === 'zh' ? '已保存' : 'Saved');
    navigate('/goals');
  };

  const handleDelete = async () => {
    if (!editId || !confirm(lang === 'zh' ? '确定删除？' : 'Delete goal?')) return;
    await base44.entities.Goal.delete(editId);
    queryClient.invalidateQueries({ queryKey: ['goals'] });
    toast.success(lang === 'zh' ? '已删除' : 'Deleted');
    navigate('/goals');
  };

  if (!loaded) return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="min-h-screen bg-background flex flex-col max-w-lg mx-auto">
      {/* Sticky Header */}
      <div className="sticky top-0 z-10 bg-background border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate('/goals')} className="p-2 rounded-xl hover:bg-secondary transition-colors">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-base font-bold flex-1">
          {editId ? (lang === 'zh' ? '编辑目标' : 'Edit Goal') : (lang === 'zh' ? '新增储蓄目标' : 'New Savings Goal')}
        </h1>
        {editId && (
          <button onClick={handleDelete} className="p-2 rounded-xl text-destructive hover:bg-destructive/10 transition-colors">
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Scrollable Form */}
      <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4 pb-32">
        <FormRow label={lang === 'zh' ? '目标名称 *' : 'Goal Name *'}>
          <input value={form.name} onChange={e => set('name', e.target.value)}
            placeholder={lang === 'zh' ? '例如：学费基金' : 'e.g. Tuition Fund'}
            className="w-full bg-secondary rounded-xl px-3 py-3 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary" />
        </FormRow>

        <FormRow label={lang === 'zh' ? '类别' : 'Category'}>
          <div className="grid grid-cols-3 gap-2">
            {GOAL_CATEGORIES.map(c => (
              <button key={c.key} onClick={() => set('category', c.key)}
                className={`py-2.5 rounded-xl text-xs font-semibold border transition-all ${form.category === c.key ? 'bg-purple-100 border-purple-400 text-purple-700' : 'bg-secondary border-transparent text-muted-foreground'}`}>
                {c.icon} {lang === 'zh' ? c.labelZh : c.label}
              </button>
            ))}
          </div>
        </FormRow>

        <div className="grid grid-cols-2 gap-3">
          <FormRow label={lang === 'zh' ? '目标金额 (RM) *' : 'Target (RM) *'}>
            <input type="number" inputMode="decimal" value={form.target_amount} onChange={e => set('target_amount', e.target.value)}
              placeholder="0.00" className="w-full bg-secondary rounded-xl px-3 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary" />
          </FormRow>
          <FormRow label={lang === 'zh' ? '已储蓄 (RM)' : 'Saved So Far (RM)'}>
            <input type="number" inputMode="decimal" value={form.current_saved} onChange={e => set('current_saved', e.target.value)}
              placeholder="0.00" className="w-full bg-secondary rounded-xl px-3 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary" />
          </FormRow>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FormRow label={lang === 'zh' ? '每月储蓄 (RM)' : 'Monthly Savings (RM)'}>
            <input type="number" inputMode="decimal" value={form.monthly_contribution} onChange={e => set('monthly_contribution', e.target.value)}
              placeholder="0.00" className="w-full bg-secondary rounded-xl px-3 py-3 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary" />
          </FormRow>
          <FormRow label={lang === 'zh' ? '目标日期' : 'Target Date'}>
            <input type="date" value={form.target_date} onChange={e => set('target_date', e.target.value)}
              className="w-full bg-secondary rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary" />
          </FormRow>
        </div>

        <FormRow label={lang === 'zh' ? '备注' : 'Notes'}>
          <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={3}
            className="w-full bg-secondary rounded-xl px-3 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary resize-none" />
        </FormRow>
      </div>

      {/* Sticky Bottom Save Button */}
      <div className="sticky bottom-0 bg-background border-t border-border px-4 py-4">
        <Button onClick={handleSave} disabled={saving} className="w-full h-12 rounded-2xl font-bold text-base bg-purple-600 hover:bg-purple-700 text-white">
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