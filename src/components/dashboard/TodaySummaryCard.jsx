import React from 'react';
import { useLanguage } from '@/lib/i18n';
import { TrendingUp, TrendingDown, Wallet } from 'lucide-react';
import { motion } from 'framer-motion';

export default function TodaySummaryCard({ record }) {
  const { t } = useLanguage();

  const totalIncome = record?.total_income || 0;
  const totalExpense = record?.total_expense || 0;
  const actualIncome = record?.actual_income || 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-gradient-to-br from-primary to-primary/80 rounded-3xl p-6 text-primary-foreground shadow-xl shadow-primary/20"
    >
      <div className="flex items-center justify-between mb-1">
        <p className="text-sm font-medium opacity-90">{t('todaySummary')}</p>
        <Wallet className="w-5 h-5 opacity-75" />
      </div>

      <p className="text-4xl font-extrabold tracking-tight mb-4">
        RM {actualIncome.toFixed(2)}
      </p>

      <div className="flex gap-4">
        <div className="flex-1 bg-white/15 rounded-2xl p-3 backdrop-blur-sm">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingUp className="w-3.5 h-3.5 opacity-80" />
            <span className="text-xs opacity-80">{t('totalEarnings')}</span>
          </div>
          <p className="text-lg font-bold">RM {totalIncome.toFixed(2)}</p>
        </div>
        <div className="flex-1 bg-white/15 rounded-2xl p-3 backdrop-blur-sm">
          <div className="flex items-center gap-1.5 mb-1">
            <TrendingDown className="w-3.5 h-3.5 opacity-80" />
            <span className="text-xs opacity-80">{t('totalExpenses')}</span>
          </div>
          <p className="text-lg font-bold">RM {totalExpense.toFixed(2)}</p>
        </div>
      </div>
    </motion.div>
  );
}