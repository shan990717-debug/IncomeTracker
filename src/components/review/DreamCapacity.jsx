import React, { useState } from 'react';
import { Sparkles, Plus, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import ProgressBar from '@/components/ui/ProgressBar';

const REMAINING_PCT = 0.65;

const DREAM_CATEGORIES = [
  { key: 'retirement', label: 'Retirement Fund', labelZh: '退休基金', emoji: '🏦' },
  { key: 'house',      label: 'House',            labelZh: '房子',     emoji: '🏠' },
  { key: 'car',        label: 'New Car',           labelZh: '新车',     emoji: '🚗' },
  { key: 'phone',      label: 'Phone',             labelZh: '手机',     emoji: '📱' },
  { key: 'appliance',  label: 'Home Appliances',   labelZh: '家电',     emoji: '🏡' },
  { key: 'other',      label: 'Other Goal',        labelZh: '其他目标', emoji: '⭐' },
];

const PRIORITY = [
  { key: 'high',   label: 'High',   labelZh: '高优先', color: 'bg-red-100 text-red-600 border-red-200' },
  { key: 'medium', label: 'Medium', labelZh: '中优先', color: 'bg-amber-100 text-amber-600 border-amber-200' },
  { key: 'low',    label: 'Low',    labelZh: '低优先', color: 'bg-blue-100 text-blue-600 border-blue-200' },
];

const emptyDream = () => ({
  id: Date.now(),
  category: 'house',
  label: '',
  target: '',
  months: '',
  monthly: '',
  priority: 'medium',
});

export default function DreamCapacity({ actualIncome, familyEssential, familyClaims, tuitionFund, travelFund, emergencyFund, carFund, bufferAlloc, workingDays, personalPct, lang }) {
  const [dreams, setDreams] = useState([]);
  const [collapsed, setCollapsed] = useState(false);

  const remainingPct = 1 - (personalPct || 35) / 100;
  const remainingAmt = +(actualIncome * remainingPct).toFixed(2);

  const allocatedFunds = familyEssential + familyClaims + tuitionFund + travelFund + emergencyFund + carFund + bufferAlloc;
  const dreamCapacity = +(remainingAmt - allocatedFunds).toFixed(2);
  const safeInstallmentLimit = +(Math.max(0, dreamCapacity) * 0.3).toFixed(2);

  const totalDreamMonthly = dreams.reduce((s, d) => s + (parseFloat(d.monthly) || (d.target && d.months ? parseFloat(d.target) / parseFloat(d.months) : 0)), 0);
  const canAfford = dreamCapacity > 0 && totalDreamMonthly <= dreamCapacity;
  const shortfall = totalDreamMonthly - dreamCapacity;
  const extraIncomeNeeded = shortfall > 0 ? +(shortfall / remainingPct).toFixed(2) : 0;
  const extraDailyNeeded = extraIncomeNeeded > 0 && workingDays > 0 ? +(extraIncomeNeeded / workingDays).toFixed(2) : 0;

  const addDream = () => setDreams(d => [...d, emptyDream()]);
  const removeDream = (id) => setDreams(d => d.filter(x => x.id !== id));
  const updateDream = (id, key, val) => setDreams(d => d.map(x => x.id === id ? { ...x, [key]: val } : x));

  return (
    <div className="bg-card rounded-2xl border border-border overflow-hidden">
      {/* Header */}
      <button onClick={() => setCollapsed(v => !v)} className="w-full flex items-center justify-between px-4 py-3 bg-gradient-to-r from-purple-600 to-purple-500 text-white">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4" />
          <span className="text-sm font-bold">{lang === 'zh' ? '梦想容量计算器' : 'Dream Capacity Calculator'}</span>
        </div>
        {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
      </button>

      {!collapsed && (
        <div className="p-4 space-y-4">
          {/* Capacity overview */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{lang === 'zh' ? `剩余分配金额 (${(remainingPct * 100).toFixed(0)}%)` : `Remaining Allocation (${(remainingPct * 100).toFixed(0)}%)`}</span>
              <span className="font-bold">RM {remainingAmt.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">{lang === 'zh' ? '已分配基金（家庭+储蓄）' : 'Allocated Funds (family + savings)'}</span>
              <span className="font-bold text-muted-foreground">- RM {allocatedFunds.toFixed(2)}</span>
            </div>
            <div className={`flex justify-between text-sm font-bold pt-1 border-t border-border ${dreamCapacity < 0 ? 'text-destructive' : 'text-purple-600'}`}>
              <span>{lang === 'zh' ? '可用梦想容量' : 'Available Dream Capacity'}</span>
              <span>RM {dreamCapacity.toFixed(2)}</span>
            </div>
          </div>

          {/* Status message */}
          {dreamCapacity <= 0 ? (
            <div className="bg-destructive/10 border border-destructive/30 rounded-xl p-3 text-xs text-destructive">
              ⚠️ {lang === 'zh'
                ? '本月没有足够的现金流用于新梦想或分期付款。请先提高收入或减少其他分配。'
                : 'You do not have enough cash flow for new dreams or installments this month.'}
            </div>
          ) : (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 space-y-1">
              <div className="flex justify-between text-xs">
                <span className="text-purple-700 font-semibold">{lang === 'zh' ? '安全分期上限 (30%)' : 'Safe Installment Limit (30%)'}</span>
                <span className="text-purple-700 font-extrabold">RM {safeInstallmentLimit.toFixed(2)}</span>
              </div>
              <p className="text-[10px] text-purple-500">
                {lang === 'zh'
                  ? `你可以安全分配约 RM${safeInstallmentLimit.toFixed(2)} 用于分期付款或新目标。`
                  : `You can safely allocate around RM${safeInstallmentLimit.toFixed(2)} to installments or new goals.`}
              </p>
              <ProgressBar value={safeInstallmentLimit} max={dreamCapacity} barClass="bg-purple-400" />
            </div>
          )}

          {/* Dream list */}
          {dreams.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs font-bold text-muted-foreground">{lang === 'zh' ? '梦想测试' : 'Dream Simulator'}</p>
              {dreams.map(d => {
                const monthly = parseFloat(d.monthly) || (d.target && d.months ? +(parseFloat(d.target) / parseFloat(d.months)).toFixed(2) : 0);
                const cat = DREAM_CATEGORIES.find(c => c.key === d.category);
                const pri = PRIORITY.find(p => p.key === d.priority);
                const dreamShortfall = monthly - dreamCapacity;
                const dreamExtra = dreamShortfall > 0 ? +(dreamShortfall / remainingPct).toFixed(2) : 0;
                const dreamExtraDaily = dreamExtra > 0 && workingDays > 0 ? +(dreamExtra / workingDays).toFixed(2) : 0;
                const dreamCanAfford = dreamCapacity > 0 && monthly <= dreamCapacity;

                return (
                  <div key={d.id} className="bg-secondary/50 rounded-xl p-3 space-y-2.5">
                    {/* Row 1: Category + Priority + Remove */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="flex gap-1 flex-wrap flex-1">
                        {DREAM_CATEGORIES.map(c => (
                          <button key={c.key} onClick={() => updateDream(d.id, 'category', c.key)}
                            className={`px-2 py-1 rounded-lg text-xs font-semibold border transition-all select-none ${d.category === c.key ? 'bg-purple-100 border-purple-400 text-purple-700' : 'bg-card border-transparent text-muted-foreground'}`}>
                            {c.emoji}
                          </button>
                        ))}
                      </div>
                      <div className="flex gap-1">
                        {PRIORITY.map(p => (
                          <button key={p.key} onClick={() => updateDream(d.id, 'priority', p.key)}
                            className={`px-2 py-1 rounded-lg text-xs font-semibold border transition-all select-none ${d.priority === p.key ? p.color : 'bg-card border-transparent text-muted-foreground'}`}>
                            {lang === 'zh' ? p.labelZh : p.label}
                          </button>
                        ))}
                      </div>
                      <button onClick={() => removeDream(d.id)} className="p-1 text-muted-foreground hover:text-destructive transition-colors select-none">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Row 2: Label */}
                    <input value={d.label} onChange={e => updateDream(d.id, 'label', e.target.value)}
                      placeholder={lang === 'zh' ? '梦想名称（可选）' : 'Dream name (optional)'}
                      className="w-full bg-card rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-1 focus:ring-purple-400" />

                    {/* Row 3: Target + Months → auto monthly, OR direct monthly */}
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-muted-foreground block mb-0.5">{lang === 'zh' ? '目标金额' : 'Target (RM)'}</label>
                        <input type="number" inputMode="decimal" value={d.target} onChange={e => updateDream(d.id, 'target', e.target.value)}
                          placeholder="0" className="w-full bg-card rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-purple-400" />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground block mb-0.5">{lang === 'zh' ? '完成月数' : 'Months'}</label>
                        <input type="number" inputMode="numeric" value={d.months} onChange={e => updateDream(d.id, 'months', e.target.value)}
                          placeholder="0" className="w-full bg-card rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-purple-400" />
                      </div>
                      <div>
                        <label className="text-[10px] text-muted-foreground block mb-0.5">{lang === 'zh' ? '月供/月存' : 'Monthly (RM)'}</label>
                        <input type="number" inputMode="decimal" value={d.monthly} onChange={e => updateDream(d.id, 'monthly', e.target.value)}
                          placeholder={d.target && d.months ? String(+(parseFloat(d.target)/parseFloat(d.months)).toFixed(0)) : '0'}
                          className="w-full bg-card rounded-lg px-2 py-1.5 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-purple-400" />
                      </div>
                    </div>

                    {/* Result */}
                    {monthly > 0 && (
                      <div className={`rounded-xl p-3 text-xs space-y-1 ${dreamCanAfford ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}>
                        <div className="flex items-center justify-between font-bold">
                          <span className={dreamCanAfford ? 'text-green-700' : 'text-red-700'}>
                            {cat?.emoji} {dreamCanAfford ? (lang === 'zh' ? '✅ 现在可负担' : '✅ Can afford now') : (lang === 'zh' ? '❌ 需要更多收入' : '❌ Need more income')}
                          </span>
                          <span className={dreamCanAfford ? 'text-green-600' : 'text-red-600'}>RM {monthly.toFixed(2)}/mo</span>
                        </div>
                        {!dreamCanAfford && dreamExtra > 0 && (
                          <div className="space-y-0.5 pt-1 border-t border-red-200">
                            <p className="text-red-600">{lang === 'zh' ? `需额外月收入: RM${dreamExtra.toFixed(2)}` : `Extra monthly income needed: RM${dreamExtra.toFixed(2)}`}</p>
                            <p className="text-red-600">{lang === 'zh' ? `每工作日需多赚: RM${dreamExtraDaily.toFixed(2)}` : `Extra per working day: RM${dreamExtraDaily.toFixed(2)}`}</p>
                            <p className="text-[10px] text-red-400 italic">
                              {lang === 'zh'
                                ? `每月多赚 RM${dreamExtra.toFixed(2)} 实际收入（= RM${monthly.toFixed(2)} ÷ ${(remainingPct * 100).toFixed(0)}%），才能安全负担此梦想。`
                                : `To safely afford RM${monthly.toFixed(2)}/month, you need RM${dreamExtra.toFixed(2)} more actual income/month (RM${monthly.toFixed(2)} ÷ ${(remainingPct * 100).toFixed(0)}%), or RM${dreamExtraDaily.toFixed(2)} more per working day.`}
                            </p>
                          </div>
                        )}
                        {dreamCanAfford && (
                          <p className="text-green-600">{lang === 'zh' ? `当前梦想容量剩余: RM${(dreamCapacity - monthly).toFixed(2)}` : `Remaining dream capacity after this: RM${(dreamCapacity - monthly).toFixed(2)}`}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Add dream button */}
          <button onClick={addDream}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border-2 border-dashed border-purple-300 text-purple-600 hover:bg-purple-50 transition-colors text-sm font-semibold">
            <Plus className="w-4 h-4" />
            {lang === 'zh' ? '测试新梦想' : 'Test a New Dream'}
          </button>

          {/* Total summary when multiple dreams */}
          {dreams.length > 1 && totalDreamMonthly > 0 && (
            <div className={`rounded-xl p-3 text-xs space-y-1 ${canAfford ? 'bg-purple-50 border border-purple-200' : 'bg-red-50 border border-red-200'}`}>
              <p className="font-bold text-sm">{lang === 'zh' ? '所有梦想合计' : 'All Dreams Combined'}</p>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{lang === 'zh' ? '总月供/月存' : 'Total Monthly'}</span>
                <span className="font-bold">RM {totalDreamMonthly.toFixed(2)}</span>
              </div>
              {!canAfford && (
                <>
                  <div className="flex justify-between text-destructive font-semibold">
                    <span>{lang === 'zh' ? '需额外月收入' : 'Extra income needed'}</span>
                    <span>RM {extraIncomeNeeded.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between text-destructive font-semibold">
                    <span>{lang === 'zh' ? '每工作日需多赚' : 'Extra per working day'}</span>
                    <span>RM {extraDailyNeeded.toFixed(2)}</span>
                  </div>
                </>
              )}
              {canAfford && (
                <p className="text-purple-600 font-semibold">
                  {lang === 'zh' ? `✅ 你可以负担所有梦想！剩余容量 RM${(dreamCapacity - totalDreamMonthly).toFixed(2)}` : `✅ You can afford all dreams! Remaining: RM${(dreamCapacity - totalDreamMonthly).toFixed(2)}`}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}