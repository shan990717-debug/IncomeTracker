import React, { useState } from 'react';
import { useLanguage } from '@/lib/i18n';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth, getDaysInMonth } from 'date-fns';
import { Link } from 'react-router-dom';
import { calcMonthlyTotals, monthStr } from '@/lib/finance';
import { Car, ChevronRight, AlertCircle, TrendingUp, CalendarDays, Zap, Receipt } from 'lucide-react';
import { motion } from 'framer-motion';

const TODAY = format(new Date(), 'yyyy-MM-dd');
const TODAY_DAY = new Date().getDate();
const DAYS_IN_MONTH = getDaysInMonth(new Date());
const REMAINING_DAYS = DAYS_IN_MONTH - TODAY_DAY;

const TARGET_MODES = [
  { key: 'minimum_survival', label: 'Survival',    labelZh: '最低目标', field: 'minimum_survival', emoji: '🟠' },
  { key: 'comfortable',      label: 'Comfortable', labelZh: '舒适目标', field: 'comfortable',      emoji: '🟢' },
  { key: 'dream',            label: 'Dream',       labelZh: '梦想目标', field: 'dream',            emoji: '💜' },
];

function getGreeting(lang) {
  const h = new Date().getHours();
  if (lang === 'zh') {
    if (h < 12) return '早上好！';
    if (h < 18) return '下午好！';
    return '晚上好！';
  }
  if (h < 12) return 'Good morning!';
  if (h < 18) return 'Good afternoon!';
  return 'Good evening!';
}

export default function Dashboard() {
  const { lang } = useLanguage();
  const [targetMode, setTargetMode] = useState('comfortable');
  const thisMonth = monthStr();

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['dailyRecords'],
    queryFn: () => base44.entities.DailyRecord.list('-date', 60),
  });
  const { data: targets = [] } = useQuery({
    queryKey: ['incomeTargets'],
    queryFn: () => base44.entities.IncomeTarget.list(),
  });
  const { data: claims = [] } = useQuery({
    queryKey: ['claims'],
    queryFn: () => base44.entities.Claim.list('-date_paid', 50),
  });
  const { data: billPayments = [] } = useQuery({
    queryKey: ['billPayments', thisMonth],
    queryFn: () => base44.entities.BillPayment.filter({ month: thisMonth }),
  });

  const target = targets[0];
  const todayRecord = records.find(r => r.date === TODAY);
  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');
  const monthRecords = records.filter(r => r.date >= monthStart && r.date <= monthEnd);
  const totals = calcMonthlyTotals(monthRecords);

  const pendingClaims = claims.filter(c => c.claim_status === 'to_be_claimed');
  const billsTotal = billPayments.filter(p => p.section !== 'shared_family').reduce((s, p) => s + (p.amount || 0), 0);
  const pendingBills = billPayments.filter(p => p.section !== 'shared_family' && (p.status === 'pending' || p.status === 'overdue')).length;
  const pendingTotal = pendingClaims.reduce((s, c) => s + (c.amount || 0), 0);

  const modeConfig = TARGET_MODES.find(m => m.key === targetMode);
  const currentTarget = target?.[modeConfig.field] || (targetMode === 'minimum_survival' ? 3500 : targetMode === 'comfortable' ? 5000 : 7000);

  const gap = currentTarget - totals.actualIncome;
  const pct = Math.min(100, currentTarget > 0 ? (totals.actualIncome / currentTarget) * 100 : 0);
  const achieved = gap <= 0;

  const avgDaily = monthRecords.length > 0 ? totals.actualIncome / monthRecords.length : 0;
  const dailyNeeded = !achieved && REMAINING_DAYS > 0 ? gap / REMAINING_DAYS : 0;

  // Status label
  let statusLabel, statusLabelZh, statusColor, statusBg;
  if (achieved) {
    statusLabel = 'Target Achieved! 🎉'; statusLabelZh = '目标已达成！🎉';
    statusColor = 'text-emerald-700'; statusBg = 'bg-emerald-50 border-emerald-200';
  } else if (pct >= 75) {
    statusLabel = 'On Track'; statusLabelZh = '进度良好';
    statusColor = 'text-primary'; statusBg = 'bg-primary/5 border-primary/20';
  } else if (pct >= 50) {
    statusLabel = 'Slightly Behind'; statusLabelZh = '略微落后';
    statusColor = 'text-amber-600'; statusBg = 'bg-amber-50 border-amber-200';
  } else {
    statusLabel = 'Behind Target'; statusLabelZh = '落后目标';
    statusColor = 'text-red-600'; statusBg = 'bg-red-50 border-red-200';
  }

  if (isLoading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="px-4 pt-12 pb-24 space-y-5 max-w-lg mx-auto">

      {/* ── HEADER ── */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground">{getGreeting(lang)}</p>
          <h1 className="text-lg font-extrabold leading-tight">{format(new Date(), 'MMMM yyyy')}</h1>
        </div>
        <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center shadow-md shadow-primary/30">
          <Car className="w-5 h-5 text-primary-foreground" />
        </div>
      </motion.div>

      {/* ── MAIN OVERVIEW CARD ── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <div className="bg-gradient-to-br from-primary via-primary to-primary/85 rounded-3xl p-6 text-primary-foreground shadow-xl shadow-primary/25 space-y-5">

          {/* Income + Target mode switcher */}
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs opacity-75 font-medium mb-1">{lang === 'zh' ? '本月实际收入' : 'Monthly Actual Income'}</p>
              <p className="text-4xl font-black tracking-tight">RM {totals.actualIncome.toFixed(0)}</p>
            </div>
            <div className="flex flex-col gap-1 items-end">
              {TARGET_MODES.map(m => (
                <button key={m.key} onClick={() => setTargetMode(m.key)}
                  className={`text-[10px] font-bold px-2.5 py-1 rounded-lg transition-all border ${
                    targetMode === m.key
                      ? 'bg-white text-primary border-white'
                      : 'bg-white/15 text-white/80 border-white/20 hover:bg-white/25'
                  }`}>
                  {m.emoji} {lang === 'zh' ? m.labelZh : m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-xs opacity-80">
              <span>{lang === 'zh' ? `目标: RM ${currentTarget.toLocaleString()}` : `Target: RM ${currentTarget.toLocaleString()}`}</span>
              <span className="font-bold">{pct.toFixed(0)}%</span>
            </div>
            <div className="h-3 bg-white/20 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, ease: 'easeOut' }}
                className={`h-full rounded-full ${achieved ? 'bg-emerald-300' : pct >= 75 ? 'bg-white' : pct >= 50 ? 'bg-yellow-300' : 'bg-orange-300'}`}
              />
            </div>
          </div>

          {/* Status + Gap */}
          <div className="flex items-center justify-between">
            <div className="bg-white/15 rounded-2xl px-3 py-2">
              <p className="text-[10px] opacity-75">{lang === 'zh' ? '状态' : 'Status'}</p>
              <p className="text-sm font-bold">{lang === 'zh' ? statusLabelZh : statusLabel}</p>
            </div>
            <div className="text-right">
              {achieved ? (
                <>
                  <p className="text-[10px] opacity-75">{lang === 'zh' ? '已超出目标' : 'Exceeded by'}</p>
                  <p className="text-lg font-extrabold text-emerald-300">+RM {Math.abs(gap).toFixed(0)}</p>
                </>
              ) : (
                <>
                  <p className="text-[10px] opacity-75">{lang === 'zh' ? '距目标还差' : 'Still needed'}</p>
                  <p className="text-lg font-extrabold text-yellow-200">RM {gap.toFixed(0)}</p>
                </>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* ── INSIGHT LINE ── */}
      {!achieved && dailyNeeded > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3">
            <Zap className="w-4 h-4 text-amber-500 mt-0.5 shrink-0" />
            <p className="text-xs text-amber-700 leading-relaxed">
              {lang === 'zh'
                ? `接下来 ${REMAINING_DAYS} 天，每天至少需要净赚 RM ${dailyNeeded.toFixed(0)} 才能达成目标。`
                : `You need to earn at least RM ${dailyNeeded.toFixed(0)}/day for the next ${REMAINING_DAYS} day${REMAINING_DAYS !== 1 ? 's' : ''} to hit your target.`}
            </p>
          </div>
        </motion.div>
      )}
      {achieved && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
          <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-4 py-3">
            <span className="text-lg">🎉</span>
            <p className="text-xs text-emerald-700 font-semibold">
              {lang === 'zh' ? `本月目标已完成！已超出 RM ${Math.abs(gap).toFixed(0)}。` : `Monthly target achieved! You're RM ${Math.abs(gap).toFixed(0)} ahead.`}
            </p>
          </div>
        </motion.div>
      )}

      {/* ── SECONDARY STATS ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="grid grid-cols-3 gap-3">
        <Link to="/today" className="block">
          <div className="bg-card border border-border rounded-2xl p-3 text-center hover:border-primary/30 transition-colors">
            <p className="text-[10px] text-muted-foreground font-medium mb-1">{lang === 'zh' ? '今日收入' : "Today"}</p>
            <p className="text-base font-extrabold text-primary">RM {(todayRecord?.actual_income || 0).toFixed(0)}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{todayRecord ? (lang === 'zh' ? '✓ 已记录' : '✓ recorded') : (lang === 'zh' ? '未记录' : 'not logged')}</p>
          </div>
        </Link>
        <div className="bg-card border border-border rounded-2xl p-3 text-center">
          <CalendarDays className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
          <p className="text-[10px] text-muted-foreground font-medium mb-0.5">{lang === 'zh' ? '工作天' : 'Work Days'}</p>
          <p className="text-base font-extrabold">{monthRecords.length}</p>
        </div>
        <div className="bg-card border border-border rounded-2xl p-3 text-center">
          <TrendingUp className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
          <p className="text-[10px] text-muted-foreground font-medium mb-0.5">{lang === 'zh' ? '日均' : 'Daily Avg'}</p>
          <p className="text-base font-extrabold">RM {avgDaily.toFixed(0)}</p>
        </div>
      </motion.div>

      {/* ── PENDING CLAIMS ALERT ── */}
      {pendingClaims.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Link to="/claims">
            <div className="flex items-center gap-3 bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-amber-800">{lang === 'zh' ? '待报销提醒' : 'Pending Claims'}</p>
                <p className="text-xs text-amber-600">{pendingClaims.length} {lang === 'zh' ? `笔，共 RM${pendingTotal.toFixed(2)}` : `items · RM${pendingTotal.toFixed(2)}`}</p>
              </div>
              <ChevronRight className="w-4 h-4 text-amber-400" />
            </div>
          </Link>
        </motion.div>
      )}

      {/* ── BILLS SHORTCUT ── */}
      {(billsTotal > 0 || billPayments.length > 0) && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.28 }}>
          <Link to="/bills">
            <div className="flex items-center gap-3 bg-card border border-border rounded-2xl p-4 hover:border-primary/30 transition-colors">
              <div className="w-9 h-9 rounded-xl bg-blue-50 flex items-center justify-center">
                <Receipt className="w-4 h-4 text-blue-600" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold">{lang === 'zh' ? '本月家庭账单' : 'Family Bills This Month'}</p>
                <p className="text-xs text-muted-foreground">
                  {pendingBills > 0
                    ? (lang === 'zh' ? `${pendingBills} 笔待付` : `${pendingBills} pending`)
                    : (lang === 'zh' ? '全部已结清' : 'All settled')}
                </p>
              </div>
              <div className="text-right">
                <p className="text-base font-extrabold">RM {billsTotal.toFixed(0)}</p>
                <ChevronRight className="w-4 h-4 text-muted-foreground ml-auto" />
              </div>
            </div>
          </Link>
        </motion.div>
      )}

      {/* ── RECENT RECORDS ── */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm font-bold">{lang === 'zh' ? '最近记录' : 'Recent Records'}</p>
          <Link to="/calendar" className="text-xs text-primary font-semibold">{lang === 'zh' ? '查看全部' : 'View all'}</Link>
        </div>
        <div className="space-y-2">
          {records.slice(0, 4).map(r => (
            <Link key={r.id} to={`/today?date=${r.date}&edit=${r.id}`}>
              <div className="flex items-center justify-between bg-card rounded-2xl border border-border px-4 py-3 hover:border-primary/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                    <span className="text-xs font-extrabold text-primary">{format(new Date(r.date), 'd')}</span>
                  </div>
                  <div>
                    <p className="text-xs font-semibold">{format(new Date(r.date), 'EEE, d MMM')}</p>
                    <p className="text-[10px] text-muted-foreground">+RM{(r.total_income || 0).toFixed(0)} − RM{(r.total_expense || 0).toFixed(0)}</p>
                  </div>
                </div>
                <p className="text-sm font-extrabold text-primary">RM {(r.actual_income || 0).toFixed(2)}</p>
              </div>
            </Link>
          ))}
          {records.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-muted-foreground">{lang === 'zh' ? '本月暂无记录' : 'No records this month yet'}</p>
              <Link to="/today" className="text-xs text-primary font-semibold mt-1 block">{lang === 'zh' ? '+ 添加今日记录' : '+ Add today\'s record'}</Link>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}