import React, { useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Pencil, Trash2, Eye, EyeOff, GripVertical, X, ChevronDown, ChevronUp } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { seedDefaultCategories } from '@/lib/seedCategories';

const COLORS = [
  'bg-green-50 text-green-600', 'bg-pink-50 text-pink-600', 'bg-purple-50 text-purple-600',
  'bg-orange-50 text-orange-500', 'bg-amber-50 text-amber-600', 'bg-red-50 text-red-500',
  'bg-blue-50 text-blue-600', 'bg-cyan-50 text-cyan-600', 'bg-emerald-50 text-emerald-600',
  'bg-indigo-50 text-indigo-600', 'bg-teal-50 text-teal-600', 'bg-sky-50 text-sky-600',
];

export default function Settings() {
  const { lang, toggleLang } = useLanguage();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('income');
  const [editItem, setEditItem] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({});

  const [resetting, setResetting] = useState(false);

  const handleResetTestData = async () => {
    if (!confirm(lang === 'zh' ? '确定清除所有测试数据？此操作不可撤销。\n\n将清除：日常记录、账单付款、报销记录、See May记录、储蓄目标、月度结算。\n\n保留：账单模板、类别设置、默认金额。' : 'Clear all test data? This cannot be undone.\n\nWill delete: daily records, bill payments, claims, See May records, goals, settlements.\n\nKeeps: bill templates, categories, default amounts.')) return;
    setResetting(true);
    await Promise.all([
      base44.entities.DailyRecord.list().then(r => Promise.all(r.map(i => base44.entities.DailyRecord.delete(i.id)))),
      base44.entities.MonthlySettlement.list().then(r => Promise.all(r.map(i => base44.entities.MonthlySettlement.delete(i.id)))),
      base44.entities.BillPayment.list().then(r => Promise.all(r.map(i => base44.entities.BillPayment.delete(i.id)))),
      base44.entities.Claim.list().then(r => Promise.all(r.map(i => base44.entities.Claim.delete(i.id)))),
      base44.entities.SharedFamilyFund.list().then(r => Promise.all(r.map(i => base44.entities.SharedFamilyFund.delete(i.id)))),
      base44.entities.Goal.list().then(r => Promise.all(r.map(i => base44.entities.Goal.delete(i.id)))),
    ]);
    queryClient.invalidateQueries();
    setResetting(false);
    toast.success(lang === 'zh' ? '✅ 测试数据已清除' : '✅ Test data cleared');
  };

  const { data: incomeSources = [] } = useQuery({
    queryKey: ['incomeSources'],
    queryFn: async () => { await seedDefaultCategories(); return base44.entities.IncomeSource.list('sort_order', 50); },
  });
  const { data: deductionCategories = [] } = useQuery({
    queryKey: ['deductionCategories'],
    queryFn: async () => { await seedDefaultCategories(); return base44.entities.DeductionCategory.list('sort_order', 50); },
  });

  const TABS = [
    { key: 'income', label: lang === 'zh' ? '收入来源' : 'Income Sources' },
    { key: 'deductions', label: lang === 'zh' ? '扣除类别' : 'Deductions' },
  ];

  const openAdd = () => {
    setEditItem(null);
    setForm(activeTab === 'income'
      ? { label: '', label_zh: '', color: COLORS[0], is_active: true, notes: '' }
      : { label: '', label_zh: '', color: COLORS[5], deduction_type: 'daily_manual', fixed_amount: '', is_active: true, notes: '' }
    );
    setShowForm(true);
  };

  const openEdit = (item) => {
    setEditItem(item);
    setForm({ ...item, fixed_amount: item.fixed_amount != null ? String(item.fixed_amount) : '' });
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.label) return toast.error(lang === 'zh' ? '请输入名称' : 'Name required');
    const isIncome = activeTab === 'income';
    const entity = isIncome ? base44.entities.IncomeSource : base44.entities.DeductionCategory;
    const record = { ...form, fixed_amount: parseFloat(form.fixed_amount) || 0 };

    if (editItem) {
      await entity.update(editItem.id, record);
    } else {
      const existing = isIncome ? incomeSources : deductionCategories;
      const maxOrder = existing.reduce((m, i) => Math.max(m, i.sort_order || 0), 0);
      const key = isIncome
        ? `income_custom_${Date.now()}`
        : `expense_custom_${Date.now()}`;
      await entity.create({ ...record, key, sort_order: maxOrder + 1, is_default: false });
    }
    queryClient.invalidateQueries({ queryKey: ['incomeSources'] });
    queryClient.invalidateQueries({ queryKey: ['deductionCategories'] });
    setShowForm(false);
    toast.success(lang === 'zh' ? '已保存' : 'Saved');
  };

  const toggleActive = async (item, isIncome) => {
    const entity = isIncome ? base44.entities.IncomeSource : base44.entities.DeductionCategory;
    await entity.update(item.id, { is_active: !item.is_active });
    queryClient.invalidateQueries({ queryKey: [isIncome ? 'incomeSources' : 'deductionCategories'] });
    toast.success(item.is_active ? (lang === 'zh' ? '已隐藏' : 'Hidden') : (lang === 'zh' ? '已显示' : 'Shown'));
  };

  const handleDelete = async (item, isIncome) => {
    if (item.is_default) return toast.error(lang === 'zh' ? '默认类别不可删除' : 'Cannot delete default category');
    if (!confirm(lang === 'zh' ? '确定删除？' : 'Delete this?')) return;
    const entity = isIncome ? base44.entities.IncomeSource : base44.entities.DeductionCategory;
    await entity.delete(item.id);
    queryClient.invalidateQueries({ queryKey: [isIncome ? 'incomeSources' : 'deductionCategories'] });
    toast.success(lang === 'zh' ? '已删除' : 'Deleted');
  };

  const moveOrder = async (item, direction, list, isIncome) => {
    const sorted = [...list].sort((a, b) => (a.sort_order || 99) - (b.sort_order || 99));
    const idx = sorted.findIndex(i => i.id === item.id);
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const entity = isIncome ? base44.entities.IncomeSource : base44.entities.DeductionCategory;
    const a = sorted[idx], b = sorted[swapIdx];
    await Promise.all([
      entity.update(a.id, { sort_order: b.sort_order || swapIdx }),
      entity.update(b.id, { sort_order: a.sort_order || idx }),
    ]);
    queryClient.invalidateQueries({ queryKey: [isIncome ? 'incomeSources' : 'deductionCategories'] });
  };

  const isIncome = activeTab === 'income';
  const list = (isIncome ? incomeSources : deductionCategories).sort((a, b) => (a.sort_order || 99) - (b.sort_order || 99));

  return (
    <div className="px-4 pt-14 pb-6 space-y-4 max-w-lg mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold">{lang === 'zh' ? '设置' : 'Settings'}</h1>
          <p className="text-xs text-muted-foreground">{lang === 'zh' ? '管理收入来源和扣除类别' : 'Manage income sources and deduction categories'}</p>
        </div>
        <Button onClick={openAdd} size="sm" className="h-9 rounded-xl font-semibold">
          <Plus className="w-4 h-4 mr-1" />{lang === 'zh' ? '添加' : 'Add'}
        </Button>
      </div>

      {/* Language Switch */}
      <div className="bg-card rounded-2xl border border-border p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-bold">{lang === 'zh' ? '语言 / Language' : 'Language / 语言'}</p>
          <p className="text-xs text-muted-foreground">{lang === 'zh' ? '当前：中文' : 'Current: English'}</p>
        </div>
        <div className="flex gap-2">
          {[{code:'zh', label:'中文'}, {code:'en', label:'EN'}].map(l => (
            <button key={l.code} onClick={() => lang !== l.code && toggleLang()}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${lang === l.code ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-transparent text-muted-foreground'}`}>
              {l.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-secondary rounded-2xl p-1">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)}
            className={`flex-1 py-2 text-sm font-semibold rounded-xl transition-all ${activeTab === t.key ? 'bg-card shadow text-foreground' : 'text-muted-foreground'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* List */}
      <div className="space-y-2">
        {list.map((item, idx) => (
          <div key={item.id} className={`bg-card rounded-2xl border border-border p-3 flex items-center gap-3 ${!item.is_active ? 'opacity-50' : ''}`}>
            {/* Order controls */}
            <div className="flex flex-col gap-0.5">
              <button onClick={() => moveOrder(item, 'up', list, isIncome)} className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={idx === 0}>
                <ChevronUp className="w-3 h-3" />
              </button>
              <button onClick={() => moveOrder(item, 'down', list, isIncome)} className="p-0.5 text-muted-foreground hover:text-foreground disabled:opacity-30" disabled={idx === list.length - 1}>
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>

            {/* Badge */}
            <span className={`text-xs font-bold px-2 py-1 rounded-lg shrink-0 ${item.color || 'bg-secondary text-foreground'}`}>
              {lang === 'zh' && item.label_zh ? item.label_zh : item.label}
            </span>

            {/* Info */}
            <div className="flex-1 min-w-0">
              {!isIncome && item.deduction_type === 'monthly_fixed' && (
                <p className="text-[10px] text-muted-foreground">Fixed: RM{item.fixed_amount}/mo</p>
              )}
              {item.is_default && <span className="text-[10px] text-muted-foreground">Default</span>}
              {item.notes && <p className="text-[10px] text-muted-foreground truncate">{item.notes}</p>}
            </div>

            {/* Actions */}
            <div className="flex items-center gap-1">
              <button onClick={() => toggleActive(item, isIncome)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary transition-colors">
                {item.is_active ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
              </button>
              <button onClick={() => openEdit(item)} className="p-1.5 rounded-lg text-muted-foreground hover:bg-secondary transition-colors">
                <Pencil className="w-4 h-4" />
              </button>
              {!item.is_default && (
                <button onClick={() => handleDelete(item, isIncome)} className="p-1.5 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>
        ))}
        {list.length === 0 && (
          <p className="text-center text-muted-foreground text-sm py-8">{lang === 'zh' ? '暂无数据，请添加' : 'No items yet. Tap Add to create one.'}</p>
        )}
      </div>

      {/* Reset Test Data */}
      <div className="bg-destructive/5 border border-destructive/20 rounded-2xl p-4 space-y-3">
        <div>
          <p className="text-sm font-bold text-destructive">{lang === 'zh' ? '🗑️ 重置测试数据' : '🗑️ Reset Test Data'}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {lang === 'zh'
              ? '清除所有记录（日常、账单、报销、目标），保留类别和账单模板。'
              : 'Clears all records (daily, bills, claims, goals) but keeps categories and bill templates.'}
          </p>
        </div>
        <Button variant="outline" onClick={handleResetTestData} disabled={resetting}
          className="w-full h-10 rounded-xl font-semibold text-destructive border-destructive/30 hover:bg-destructive/10">
          {resetting ? (lang === 'zh' ? '清除中...' : 'Clearing...') : (lang === 'zh' ? '清除所有测试数据' : 'Clear All Test Data')}
        </Button>
      </div>

      {/* Info note */}
      <div className="bg-secondary rounded-2xl p-4 text-xs text-muted-foreground space-y-1">
        <p className="font-semibold">{lang === 'zh' ? '💡 说明' : '💡 Notes'}</p>
        <p>{lang === 'zh' ? '• 默认类别不可删除，但可隐藏' : '• Default categories cannot be deleted, but can be hidden'}</p>
        <p>{lang === 'zh' ? '• 隐藏的类别不会在今日记录中显示' : '• Hidden categories will not appear on the daily record screen'}</p>
        <p>{lang === 'zh' ? '• 新建的类别会自动显示在今日记录和统计中' : '• New categories automatically appear in daily records and totals'}</p>
        <p>{lang === 'zh' ? '• 使用上下箭头调整显示顺序' : '• Use arrows to reorder categories'}</p>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end" onClick={() => setShowForm(false)}>
          <div className="bg-background w-full max-w-lg mx-auto rounded-t-3xl p-5 space-y-4 max-h-[80vh] overflow-y-auto"
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold">
                {editItem ? (lang === 'zh' ? '编辑' : 'Edit') : (lang === 'zh' ? '添加' : 'Add')} {isIncome ? (lang === 'zh' ? '收入来源' : 'Income Source') : (lang === 'zh' ? '扣除类别' : 'Deduction')}
              </h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-muted-foreground" /></button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">{lang === 'zh' ? '名称 (EN)' : 'Name (EN)'} *</label>
                <input value={form.label || ''} onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
                  className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">{lang === 'zh' ? '名称 (中文)' : 'Name (中文 optional)'}</label>
                <input value={form.label_zh || ''} onChange={e => setForm(p => ({ ...p, label_zh: e.target.value }))}
                  className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>

              {/* Color picker */}
              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-2 block">{lang === 'zh' ? '标签颜色' : 'Badge Color'}</label>
                <div className="grid grid-cols-6 gap-2">
                  {COLORS.map(c => (
                    <button key={c} onClick={() => setForm(p => ({ ...p, color: c }))}
                      className={`h-8 rounded-lg text-xs font-bold border-2 transition-all ${c} ${form.color === c ? 'border-foreground scale-105' : 'border-transparent'}`}>
                      A
                    </button>
                  ))}
                </div>
              </div>

              {!isIncome && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">{lang === 'zh' ? '扣除类型' : 'Deduction Type'}</label>
                  <select value={form.deduction_type || 'daily_manual'} onChange={e => setForm(p => ({ ...p, deduction_type: e.target.value }))}
                    className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary">
                    <option value="daily_manual">{lang === 'zh' ? '每日手动输入' : 'Daily manual input'}</option>
                    <option value="monthly_fixed">{lang === 'zh' ? '每月固定扣除' : 'Monthly fixed deduction'}</option>
                    <option value="custom">{lang === 'zh' ? '自定义/偶发' : 'Custom / occasional'}</option>
                  </select>
                </div>
              )}

              {!isIncome && form.deduction_type === 'monthly_fixed' && (
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">{lang === 'zh' ? '固定月扣金额 (RM)' : 'Fixed Monthly Amount (RM)'}</label>
                  <input type="number" inputMode="decimal" value={form.fixed_amount || ''}
                    onChange={e => setForm(p => ({ ...p, fixed_amount: e.target.value }))}
                    className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm font-bold focus:outline-none focus:ring-1 focus:ring-primary" />
                </div>
              )}

              <div>
                <label className="text-xs font-semibold text-muted-foreground mb-1 block">{lang === 'zh' ? '备注' : 'Notes'}</label>
                <input value={form.notes || ''} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                  className="w-full bg-secondary rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">{lang === 'zh' ? '显示状态' : 'Visible'}</span>
                <button onClick={() => setForm(p => ({ ...p, is_active: !p.is_active }))}
                  className={`w-12 h-6 rounded-full transition-colors ${form.is_active ? 'bg-primary' : 'bg-muted'}`}>
                  <span className={`block w-5 h-5 rounded-full bg-white shadow transition-transform mx-0.5 ${form.is_active ? 'translate-x-6' : 'translate-x-0'}`} />
                </button>
              </div>
            </div>

            <Button onClick={handleSave} className="w-full h-11 rounded-xl font-bold bg-primary">
              {lang === 'zh' ? '保存' : 'Save'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}