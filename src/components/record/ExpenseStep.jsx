import React from 'react';
import { useLanguage } from '@/lib/i18n';
import { Input } from '@/components/ui/input';
import { Fuel, CircleDot, ParkingSquare, UtensilsCrossed, Wrench, MoreHorizontal } from 'lucide-react';
import { motion } from 'framer-motion';

const expenseFields = [
  { key: 'expense_petrol', labelKey: 'petrol', icon: Fuel, color: 'bg-red-50 text-red-500' },
  { key: 'expense_toll', labelKey: 'toll', icon: CircleDot, color: 'bg-orange-50 text-orange-500' },
  { key: 'expense_parking', labelKey: 'parking', icon: ParkingSquare, color: 'bg-indigo-50 text-indigo-500' },
  { key: 'expense_food', labelKey: 'foodDrink', icon: UtensilsCrossed, color: 'bg-yellow-50 text-yellow-600' },
  { key: 'expense_car_maintenance', labelKey: 'carMaintenance', icon: Wrench, color: 'bg-slate-100 text-slate-600' },
  { key: 'expense_others', labelKey: 'othersExpense', icon: MoreHorizontal, color: 'bg-gray-50 text-gray-500' },
];

export default function ExpenseStep({ data, onChange }) {
  const { t } = useLanguage();

  const totalExpense = expenseFields.reduce((sum, f) => sum + (parseFloat(data[f.key]) || 0), 0);

  return (
    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-foreground">{t('expenses')}</h2>
        <div className="bg-destructive/10 rounded-full px-3 py-1">
          <span className="text-sm font-bold text-destructive">- RM {totalExpense.toFixed(2)}</span>
        </div>
      </div>

      <div className="space-y-2">
        {expenseFields.map((field, i) => {
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
                <label className="text-xs font-medium text-muted-foreground">{t(field.labelKey)}</label>
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