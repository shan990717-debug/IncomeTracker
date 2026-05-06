import React from 'react';
import ProgressBar from '@/components/ui/ProgressBar';
import { AlertTriangle, CheckCircle2, TrendingUp } from 'lucide-react';

const NORMAL_FAMILY = 6300;
const SPECIAL_FAMILY = 9200;
const REMAINING_PCT = 0.65;

const DANGER_THRESHOLD = +(NORMAL_FAMILY / REMAINING_PCT).toFixed(0);   // 9,692 ≈ 9,700
const TIGHT_THRESHOLD  = +(SPECIAL_FAMILY / REMAINING_PCT).toFixed(0);  // 14,154 ≈ 14,200

export function calcThresholdHealth(actualIncome, familyEssential, familyClaims, savingsTotal, buffer) {
  const familyTotal = familyEssential + familyClaims;
  const remainingAmt = actualIncome * REMAINING_PCT;
  const savingsCapacity = remainingAmt - familyTotal - savingsTotal - buffer;

  if (actualIncome < DANGER_THRESHOLD) return 'danger';
  if (actualIncome < TIGHT_THRESHOLD) return 'tight';
  if (savingsCapacity >= 1000) return 'flexible';
  if (savingsCapacity >= 0 && savingsTotal >= 1000) return 'comfortable';
  return 'stable';
}

const STATUS = {
  danger:     { label: 'Danger',     labelZh: '危险',   emoji: '🔴', bg: 'bg-red-50',    border: 'border-red-200',    text: 'text-red-600',    desc: `Income below RM${DANGER_THRESHOLD.toLocaleString()} — cannot safely cover normal family expenses.`, descZh: `收入低于 RM${DANGER_THRESHOLD.toLocaleString()}，无法安全覆盖家庭基本支出。` },
  tight:      { label: 'Tight',      labelZh: '偏紧',   emoji: '🟠', bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-600', desc: `Income covers normal months but not special expenses (need RM${TIGHT_THRESHOLD.toLocaleString()} for special months).`, descZh: `可覆盖普通月份，但特殊月份仍不足（需 RM${TIGHT_THRESHOLD.toLocaleString()}）。` },
  stable:     { label: 'Stable',     labelZh: '稳定',   emoji: '🔵', bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-600',   desc: 'Income covers special months, but savings capacity is still limited.', descZh: '收入可覆盖特殊月份，但储蓄空间仍然有限。' },
  comfortable:{ label: 'Comfortable',labelZh: '舒适',   emoji: '🟢', bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-600',  desc: 'Income covers family expenses + at least RM1,000 monthly savings.', descZh: '收入覆盖家庭支出，且每月至少存 RM1,000。' },
  flexible:   { label: 'Flexible',   labelZh: '充裕',   emoji: '💜', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-600', desc: 'Excellent! You have dream capacity available this month.', descZh: '出色！本月有余力实现新梦想。' },
};

export default function FinancialThreshold({ actualIncome, lang }) {
  const status = actualIncome < DANGER_THRESHOLD ? 'danger'
    : actualIncome < TIGHT_THRESHOLD ? 'tight'
    : 'stable';

  // For threshold-only display, we use income level tiers
  const s = STATUS[status];

  return (
    <div className={`rounded-2xl border p-4 space-y-3 ${s.bg} ${s.border}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground font-medium">{lang === 'zh' ? '收入门槛状态' : 'Income Threshold'}</p>
          <p className={`text-xl font-extrabold ${s.text}`}>{lang === 'zh' ? s.labelZh : s.label}</p>
        </div>
        <span className="text-3xl">{s.emoji}</span>
      </div>
      <p className="text-xs text-muted-foreground">{lang === 'zh' ? s.descZh : s.desc}</p>

      {/* Threshold bars */}
      <div className="space-y-2.5">
        <ThresholdBar label={lang === 'zh' ? `危险线 RM${DANGER_THRESHOLD.toLocaleString()}` : `Danger line RM${DANGER_THRESHOLD.toLocaleString()}`} actual={actualIncome} max={TIGHT_THRESHOLD * 1.2} threshold={DANGER_THRESHOLD} barClass="bg-red-400" lang={lang} />
        <ThresholdBar label={lang === 'zh' ? `特殊月安全线 RM${TIGHT_THRESHOLD.toLocaleString()}` : `Special month safety RM${TIGHT_THRESHOLD.toLocaleString()}`} actual={actualIncome} max={TIGHT_THRESHOLD * 1.2} threshold={TIGHT_THRESHOLD} barClass="bg-orange-400" lang={lang} />
      </div>

      {/* Formula note */}
      <div className="bg-white/60 rounded-xl p-3 text-[10px] text-muted-foreground space-y-0.5">
        <p className="font-semibold text-xs">{lang === 'zh' ? '📐 门槛计算公式' : '📐 Threshold Formula'}</p>
        <p>{lang === 'zh' ? `普通月 RM${NORMAL_FAMILY.toLocaleString()} ÷ 65% = 危险线 RM${DANGER_THRESHOLD.toLocaleString()}` : `Normal month RM${NORMAL_FAMILY.toLocaleString()} ÷ 65% = Danger line RM${DANGER_THRESHOLD.toLocaleString()}`}</p>
        <p>{lang === 'zh' ? `特殊月 RM${SPECIAL_FAMILY.toLocaleString()} ÷ 65% = 安全线 RM${TIGHT_THRESHOLD.toLocaleString()}` : `Special month RM${SPECIAL_FAMILY.toLocaleString()} ÷ 65% = Safety line RM${TIGHT_THRESHOLD.toLocaleString()}`}</p>
        <p>{lang === 'zh' ? '剩余分配比例 = 100% - 个人消费% (默认65%)' : 'Remaining allocation % = 100% - personal spending % (default 65%)'}</p>
      </div>
    </div>
  );
}

function ThresholdBar({ label, actual, max, threshold, barClass, lang }) {
  const hit = actual >= threshold;
  return (
    <div>
      <div className="flex justify-between text-xs mb-1">
        <span className="text-muted-foreground">{label}</span>
        {hit
          ? <span className="text-green-600 font-semibold flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3" />{lang === 'zh' ? '达到' : 'Met'}</span>
          : <span className="text-destructive font-semibold flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" />{lang === 'zh' ? `差 RM${(threshold - actual).toFixed(0)}` : `-RM${(threshold - actual).toFixed(0)}`}</span>
        }
      </div>
      <div className="relative h-2 bg-white/50 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barClass}`} style={{ width: `${Math.min(100, (actual / max) * 100)}%` }} />
        <div className="absolute top-0 h-full border-r-2 border-foreground/30" style={{ left: `${Math.min(100, (threshold / max) * 100)}%` }} />
      </div>
    </div>
  );
}