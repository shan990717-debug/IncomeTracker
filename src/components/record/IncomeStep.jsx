import React from 'react';
import { useLanguage } from '@/lib/i18n';
import { Input } from '@/components/ui/input';
import { Car, Zap, Navigation, Heart, Gift, TrendingUp, Percent, RotateCcw, Users, DollarSign } from 'lucide-react';
import { motion } from 'framer-motion';

const incomeFields = [
  { key: 'income_grab',          label: 'Grab',            icon: Car,         color: 'bg-green-50 text-green-600' },
  { key: 'income_tips',          label: 'Tips',            icon: Heart,       color: 'bg-pink-50 text-pink-600' },
  { key: 'income_incentive',     label: 'Incentive',       icon: Gift,        color: 'bg-purple-50 text-purple-600' },
  { key: 'income_turbo5',        label: 'Turbo 5%',        icon: Percent,     color: 'bg-orange-50 text-orange-500' },
  { key: 'income_turbo_cashback',label: 'Turbo Cash Back', icon: RotateCcw,   color: 'bg-amber-50 text-amber-600' },
  { key: 'income_cdian',         label: 'C单',             icon: DollarSign,  color: 'bg-red-50 text-red-500' },
  { key: 'income_indrive',       label: 'In Drive',        icon: Navigation,  color: 'bg-blue-50 text-blue-600' },
  { key: 'income_aa',            label: 'AA',              icon: TrendingUp,  color: 'bg-cyan-50 text-cyan-600' },
  { key: 'income_bolt',          label: 'Bolt',            icon: Zap,         color: 'bg-emerald-50 text-emerald-600' },
  { key: 'income_3party',        label: '3 Party Comm',    icon: Users,       color: 'bg-indigo-50 text-indigo-600' },
];

export default function IncomeStep({ data, onChange }) {
  const { t } = useLanguage();

  const totalIncome = incomeFields.reduce((sum, f) => sum + (parseFloat(data[f.key]) || 0), 0);

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">{t('incomeSource')}</h2>
        <div className="bg-primary/10 rounded-full px-3 py-1">
          <span className="text-sm font-bold text-primary">RM {totalIncome.toFixed(2)}</span>
        </div>
      </div>

      <div className="space-y-2">
        {incomeFields.map((field, i) => {
          const Icon = field.icon;
          return (
            <motion.div
              key={field.key}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-center gap-3 bg-card rounded-2xl p-3 border border-border"
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${field.color}`}>
                <Icon className="w-5 h-5" />
              </div>
              <div className="flex-1 min-w-0">
                <label className="text-xs font-medium text-muted-foreground">{field.label}</label>
                <Input
                  type="number"
                  inputMode="decimal"
                  step="0.01"
                  placeholder="0.00"
                  value={data[field.key] || ''}
                  onChange={(e) => onChange(field.key, e.target.value)}
                  className="border-0 p-0 h-7 text-base font-semibold bg-transparent shadow-none focus-visible:ring-0"
                />
              </div>
              <span className="text-xs text-muted-foreground font-medium shrink-0">RM</span>
            </motion.div>
          );
        })}
      </div>
    </motion.div>
  );
}