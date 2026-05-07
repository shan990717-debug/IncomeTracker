import React from 'react';
import { useLanguage } from '@/lib/i18n';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { GOAL_CATEGORIES } from '@/lib/constants';
import { Plus, Target } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ProgressBar from '@/components/ui/ProgressBar';
import { motion } from 'framer-motion';
import { differenceInMonths } from 'date-fns';
import { useNavigate } from 'react-router-dom';

// Default funds shown prominently
const DEFAULT_FUND_KEYS = ['tuition', 'travel', 'emergency'];
const TRAVEL_TARGET = 4000;

export default function Goals() {
  const { lang } = useLanguage();
  const navigate = useNavigate();

  const { data: goals = [] } = useQuery({
    queryKey: ['goals'],
    queryFn: () => base44.entities.Goal.list('-created_date', 50),
  });

  const openAdd = (category = 'tuition') => {
    navigate(`/goals/new?category=${category}`);
  };

  const openEdit = (g) => {
    navigate(`/goals/edit?id=${g.id}`);
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