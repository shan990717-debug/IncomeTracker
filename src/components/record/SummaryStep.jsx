import React from 'react';
import { useLanguage } from '@/lib/i18n';
import { TrendingUp, TrendingDown, Wallet, Landmark, Banknote } from 'lucide-react';
import { motion } from 'framer-motion';

export default function SummaryStep({ data, totalIncome, totalExpense, actualIncome }) {
  const { t } = useLanguage();

  const incomeItems = [
    { key: 'income_grab',           label: 'Grab' },
    { key: 'income_tips',           label: 'Tips' },
    { key: 'income_incentive',      label: 'Incentive' },
    { key: 'income_turbo5',         label: 'Turbo 5%' },
    { key: 'income_turbo_cashback', label: 'Turbo Cash Back' },
    { key: 'income_cdian',          label: 'C单' },
    { key: 'income_indrive',        label: 'In Drive' },
    { key: 'income_aa',             label: 'AA' },
    { key: 'income_bolt',           label: 'Bolt' },
    { key: 'income_3party',         label: '3 Party Comm' },
  ].filter(item => parseFloat(data[item.key]) > 0);

  const expenseItems = [
    { key: 'expense_petrol', label: t('petrol') },
    { key: 'expense_toll', label: t('toll') },
    { key: 'expense_parking', label: t('parking') },
    { key: 'expense_food', label: t('foodDrink') },
    { key: 'expense_car_maintenance', label: t('carMaintenance') },
    { key: 'expense_others', label: t('othersExpense') },
  ].filter(item => parseFloat(data[item.key]) > 0);

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
      <h2 className="text-lg font-bold text-foreground">{t('summary')}</h2>

      {/* Net income card */}
      <div className="bg-gradient-to-br from-primary to-primary/80 rounded-2xl p-5 text-primary-foreground">
        <div className="flex items-center gap-2 mb-1">
          <Wallet className="w-4 h-4 opacity-75" />
          <span className="text-sm opacity-90">{t('actualIncome')}</span>
        </div>
        <p className="text-3xl font-extrabold">RM {actualIncome.toFixed(2)}</p>
      </div>

      {/* Income breakdown */}
      <div className="bg-card rounded-2xl p-4 border border-border">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">{t('totalEarnings')}: RM {totalIncome.toFixed(2)}</span>
        </div>
        <div className="space-y-2">
          {incomeItems.map(item => (
            <div key={item.key} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-medium">RM {parseFloat(data[item.key]).toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Expense breakdown */}
      <div className="bg-card rounded-2xl p-4 border border-border">
        <div className="flex items-center gap-2 mb-3">
          <TrendingDown className="w-4 h-4 text-destructive" />
          <span className="text-sm font-semibold">{t('totalExpenses')}: RM {totalExpense.toFixed(2)}</span>
        </div>
        <div className="space-y-2">
          {expenseItems.map(item => (
            <div key={item.key} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{item.label}</span>
              <span className="font-medium">- RM {parseFloat(data[item.key]).toFixed(2)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Storage */}
      <div className="bg-card rounded-2xl p-4 border border-border">
        <p className="text-sm font-semibold mb-3">{t('storageMethod')}</p>
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <Landmark className="w-4 h-4 text-blue-500" />
            <div>
              <p className="text-xs text-muted-foreground">{t('bank')}</p>
              <p className="text-sm font-bold">RM {(parseFloat(data.stored_bank) || 0).toFixed(2)}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Banknote className="w-4 h-4 text-amber-500" />
            <div>
              <p className="text-xs text-muted-foreground">{t('cash')}</p>
              <p className="text-sm font-bold">RM {(parseFloat(data.stored_cash) || 0).toFixed(2)}</p>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}