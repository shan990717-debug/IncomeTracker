import { base44 } from '@/api/base44Client';

const DEFAULT_INCOME_SOURCES = [
  { key: 'income_grab',          label: 'Grab',            label_zh: 'Grab',       color: 'bg-green-50 text-green-600',   sort_order: 1,  is_default: true, is_active: true },
  { key: 'income_tips',          label: 'Tips',            label_zh: '小费',        color: 'bg-pink-50 text-pink-600',     sort_order: 2,  is_default: true, is_active: true },
  { key: 'income_incentive',     label: 'Incentive',       label_zh: '激励',        color: 'bg-purple-50 text-purple-600', sort_order: 3,  is_default: true, is_active: true },
  { key: 'income_turbo5',        label: 'Turbo 5%',        label_zh: 'Turbo 5%',   color: 'bg-orange-50 text-orange-500', sort_order: 4,  is_default: true, is_active: true },
  { key: 'income_turbo_cashback',label: 'Turbo Cash Back', label_zh: 'Turbo 返现', color: 'bg-amber-50 text-amber-600',   sort_order: 5,  is_default: true, is_active: true },
  { key: 'income_cdian',         label: 'C单',              label_zh: 'C单',         color: 'bg-red-50 text-red-500',       sort_order: 6,  is_default: true, is_active: true },
  { key: 'income_indrive',       label: 'In Drive',        label_zh: 'In Drive',   color: 'bg-blue-50 text-blue-600',     sort_order: 7,  is_default: true, is_active: true },
  { key: 'income_aa',            label: 'AA',              label_zh: 'AA',         color: 'bg-cyan-50 text-cyan-600',     sort_order: 8,  is_default: true, is_active: true },
  { key: 'income_bolt',          label: 'Bolt',            label_zh: 'Bolt',       color: 'bg-emerald-50 text-emerald-600', sort_order: 9, is_default: true, is_active: true },
  { key: 'income_3party',        label: '3 Party Comm',    label_zh: '三方佣金',    color: 'bg-indigo-50 text-indigo-600', sort_order: 10, is_default: true, is_active: true },
];

const DEFAULT_DEDUCTION_CATEGORIES = [
  { key: 'expense_petrol',      label: 'Petrol',      label_zh: '油费',  color: 'bg-red-50 text-red-500',    deduction_type: 'daily_manual', sort_order: 1, is_default: true, is_active: true },
  { key: 'expense_shidan',      label: '射单',         label_zh: '射单',  color: 'bg-purple-50 text-purple-600', deduction_type: 'daily_manual', is_shidan: true, sort_order: 2, is_default: true, is_active: true },
  { key: 'expense_toll',        label: 'Toll',        label_zh: '过路费', color: 'bg-orange-50 text-orange-500', deduction_type: 'daily_manual', sort_order: 3, is_default: true, is_active: true },
  { key: 'expense_parking',     label: 'Parking',     label_zh: '停车费', color: 'bg-indigo-50 text-indigo-500', deduction_type: 'daily_manual', sort_order: 4, is_default: true, is_active: true },
  { key: 'expense_pa_insurance',label: 'PA Insurance',label_zh: 'PA保险', color: 'bg-sky-50 text-sky-600',     deduction_type: 'monthly_fixed', fixed_amount: 23.44, is_pa_insurance: true, sort_order: 5, is_default: true, is_active: true },
];

let seeded = false;

export async function seedDefaultCategories() {
  if (seeded) return;
  seeded = true;

  try {
    const [existingIncome, existingDeductions] = await Promise.all([
      base44.entities.IncomeSource.list(),
      base44.entities.DeductionCategory.list(),
    ]);

    const existingIncomeKeys = new Set(existingIncome.map(i => i.key));
    const toCreateIncome = DEFAULT_INCOME_SOURCES.filter(s => !existingIncomeKeys.has(s.key));
    if (toCreateIncome.length > 0) await base44.entities.IncomeSource.bulkCreate(toCreateIncome);

    const existingDeductionKeys = new Set(existingDeductions.map(d => d.key));
    const toCreateDeductions = DEFAULT_DEDUCTION_CATEGORIES.filter(d => !existingDeductionKeys.has(d.key));
    if (toCreateDeductions.length > 0) await base44.entities.DeductionCategory.bulkCreate(toCreateDeductions);
  } catch (e) {
    console.warn('Seed failed:', e);
  }
}