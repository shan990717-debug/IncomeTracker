import React from 'react';
import { useLanguage } from '@/lib/i18n';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { Link } from 'react-router-dom';
import { calcMonthlyTotals, calcHealthStatus, monthStr } from '@/lib/finance';
import { HEALTH_STATUS } from '@/lib/constants';
import ProgressBar from '@/components/ui/ProgressBar';
import { Car, TrendingUp, Landmark, Banknote, ChevronRight, Target, AlertCircle } from 'lucide-react';
import { motion } from 'framer-motion';

const TODAY = format(new Date(), 'yyyy-MM-dd');

export default function Dashboard() {
  const { lang } = useLanguage();
  const thisMonth = monthStr();

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['dailyRecords'],
    queryFn: () => base44.entities.DailyRecord.list('-date', 60),
  });
  const { data: settlements = [] } = useQuery({
    queryKey: ['settlements'],
    queryFn: () => base44.entities.MonthlySettlement.list('-month', 12),
  });
  const { data: targets = [] } = useQuery({
    queryKey: ['incomeTargets'],
    queryFn: () => base44.entities.IncomeTarget.list(),
  });
  const { data: claims = [] } = useQuery({
    queryKey: ['claims'],
    queryFn: () => base44.entities.Claim.list('-date_paid', 50),
  });

  const todayRecord = records.find(r => r.date === TODAY);
  const monthStart = format(startOfMonth(new Date()), 'yyyy-MM-dd');
  const monthEnd = format(endOfMonth(new Date()), 'yyyy-MM-dd');
  const monthRecords = records.filter(r => r.date >= monthStart && r.date <= monthEnd);
  const totals = calcMonthlyTotals(monthRecords);
  const settlement = settlements.find(s => s.month === thisMonth);
  const target = targets[0];
  const comfortable = target?.comfortable || 5000;
  const pendingClaims = claims.filter(c => c.claim_status === 'to_be_claimed');
  const pendingTotal = pendingClaims.reduce((s, c) => s + (c.amount || 0), 0);

  const buffer = settlement?.cashflow_buffer ?? (totals.actualIncome - (settlement?.personal_spending || 0));
  const healthKey = calcHealthStatus({ actual_income: totals.actualIncome, cashflow_buffer: buffer, emergency_savings: settlement?.emergency_savings, car_repair_fund: settlement?.car_repair_fund, travel_savings: settlement?.travel_savings }, target);
  const hs = HEALTH_STATUS[healthKey];

  if (isLoading) return <div className="flex items-center justify-center h-screen"><div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" /></div>;

  return (
    <div className="px-4 pt-12 pb-6 space-y-4 max-w-lg mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-primary flex items-center justify-center shadow-md shadow-primary/30">
          <Car className="w-5 h-5 text-primary-foreground" />
        </div>
        <div>
          <h1 className="text-base font-extrabold leading-tight">{lang === 'zh' ? '司机收入追踪' : 'Driver Income Tracker'}</h1>
          <p className="text-xs text-muted-foreground">{format(new Date(), 'EEEE, d MMM yyyy')}</p>
        </div>
      </motion.div>

      {/* Today card */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Link to="/today">
          <div className="bg-gradient-to-br from-primary to-primary/80 rounded-3xl p-5 text-primary-foreground shadow-xl shadow-primary/20">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs opacity-80 font-medium">{lang === 'zh' ? '今日实际收入' : "Today's Net Income"}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full ${todayRecord ? 'bg-white/20' : 'bg-white/10'} font-medium`}>
                {todayRecord ? (lang === 'zh' ? '✓ 已记录' : '✓ Recorded') : (lang === 'zh' ? '+ 点击记录' : '+ Tap to record')}
              </span>
            </div>
            <p className="text-5xl font-black tracking-tight">RM {(todayRecord?.actual_income || 0).toFixed(2)}</p>
            <div className="flex gap-3 mt-3">
              <div className="flex-1 bg-white/15 rounded-2xl p-2.5 text-center">
                <p className="text-[10px] opacity-75">{lang === 'zh' ? '总收入' : 'Gross'}</p>
                <p className="text-sm font-bold">RM {(todayRecord?.total_income || 0).toFixed(0)}</p>
              </div>
              <div className="flex-1 bg-white/15 rounded-2xl p-2.5 text-center">
                <p className="text-[10px] opacity-75">{lang === 'zh' ? '支出' : 'Expense'}</p>
                <p className="text-sm font-bold">RM {(todayRecord?.total_expense || 0).toFixed(0)}</p>
              </div>
              <div className="flex-1 bg-white/15 rounded-2xl p-2.5 text-center">
                <p className="text-[10px] opacity-75">{lang === 'zh' ? '银行' : 'Bank'}</p>
                <p className="text-sm font-bold">RM {(todayRecord?.stored_bank || 0).toFixed(0)}</p>
              </div>
            </div>
          </div>
        </Link>
      </motion.div>

      {/* Monthly overview */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
        <Link to="/review">
          <div className="bg-card rounded-3xl border border-border p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="text-xs text-muted-foreground">{lang === 'zh' ? `${format(new Date(), 'M月')}月度净收入` : `${format(new Date(), 'MMMM')} Net Income`}</p>
                <p className="text-3xl font-black text-foreground">RM {totals.actualIncome.toFixed(2)}</p>
              </div>
              <div className={`px-3 py-1.5 rounded-2xl border ${hs.bg} ${hs.border}`}>
                <p className={`text-xs font-bold ${hs.color}`}>{lang === 'zh' ? hs.labelZh : hs.label}</p>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-xs text-muted-foreground mb-1.5">
                <span>{lang === 'zh' ? '进度' : 'vs Comfortable'}</span>
                <span className="font-medium">{Math.min(100, (totals.actualIncome / comfortable) * 100).toFixed(0)}% of RM{comfortable.toLocaleString()}</span>
              </div>
              <ProgressBar value={totals.actualIncome} max={comfortable} barClass="bg-primary" />
            </div>
          </div>
        </Link>
      </motion.div>

      {/* Bank / Cash + Working days */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="grid grid-cols-3 gap-2">
        <div className="col-span-1 bg-blue-50 rounded-2xl border border-blue-100 p-3 text-center">
          <Landmark className="w-4 h-4 text-blue-500 mx-auto mb-1" />
          <p className="text-[10px] text-blue-500 font-medium">{lang === 'zh' ? '银行' : 'Bank'}</p>
          <p className="text-sm font-extrabold text-blue-700">RM {totals.bankTotal.toFixed(0)}</p>
        </div>
        <div className="col-span-1 bg-amber-50 rounded-2xl border border-amber-100 p-3 text-center">
          <Banknote className="w-4 h-4 text-amber-500 mx-auto mb-1" />
          <p className="text-[10px] text-amber-600 font-medium">{lang === 'zh' ? '现金' : 'Cash'}</p>
          <p className="text-sm font-extrabold text-amber-700">RM {totals.cashTotal.toFixed(0)}</p>
        </div>
        <div className="col-span-1 bg-card rounded-2xl border border-border p-3 text-center">
          <TrendingUp className="w-4 h-4 text-primary mx-auto mb-1" />
          <p className="text-[10px] text-muted-foreground font-medium">{lang === 'zh' ? '工作天' : 'Days'}</p>
          <p className="text-sm font-extrabold">{monthRecords.length}</p>
        </div>
      </motion.div>

      {/* Pending claims alert */}
      {pendingClaims.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
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

      {/* Quick links */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <div className="grid grid-cols-2 gap-3">
          <Link to="/settlement">
            <div className="bg-card rounded-2xl border border-border p-4 hover:border-primary/30 transition-colors">
              <p className="text-sm font-bold mb-0.5">{lang === 'zh' ? '月度结算' : 'Settlement'}</p>
              <p className="text-xs text-muted-foreground">{settlement?.status === 'finalized' ? (lang === 'zh' ? '✓ 已完成' : '✓ Finalized') : (lang === 'zh' ? '草稿中' : 'Draft')}</p>
            </div>
          </Link>
          <Link to="/goals">
            <div className="bg-card rounded-2xl border border-border p-4 hover:border-purple-300 transition-colors">
              <Target className="w-4 h-4 text-purple-500 mb-1" />
              <p className="text-sm font-bold mb-0.5">{lang === 'zh' ? '目标规划' : 'Goals'}</p>
              <p className="text-xs text-muted-foreground">{lang === 'zh' ? '查看储蓄目标' : 'View savings goals'}</p>
            </div>
          </Link>
        </div>
      </motion.div>

      {/* Recent records */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-bold">{lang === 'zh' ? '最近记录' : 'Recent Records'}</p>
          <Link to="/calendar" className="text-xs text-primary font-medium">{lang === 'zh' ? '查看全部' : 'View all'}</Link>
        </div>
        {records.slice(0, 5).map(r => (
          <Link key={r.id} to={`/today?date=${r.date}&edit=${r.id}`}>
            <div className="flex items-center justify-between bg-card rounded-2xl border border-border px-4 py-3 hover:border-primary/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center">
                  <span className="text-xs font-extrabold text-primary">{format(new Date(r.date), 'd')}</span>
                </div>
                <div>
                  <p className="text-xs font-semibold">{format(new Date(r.date), 'EEE, d MMM')}</p>
                  <p className="text-[10px] text-muted-foreground">+RM{(r.total_income||0).toFixed(0)} / -RM{(r.total_expense||0).toFixed(0)}</p>
                </div>
              </div>
              <p className="text-sm font-extrabold text-primary">RM {(r.actual_income||0).toFixed(2)}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}