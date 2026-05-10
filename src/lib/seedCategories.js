import { base44 } from '@/api/base44Client';

// Default household bills — amounts of 0 = manual input
const DEFAULT_HOUSEHOLD_BILLS = [
  { name: 'Digi Telco',                  category: 'telco',      default_amount: 0,      sort_order: 1,  is_active: true, is_shared_family: false },
  { name: 'Maxis Wi-fi（龙舅舅）',         category: 'telco',      default_amount: 99.65,  sort_order: 2,  is_active: true, is_shared_family: false },
  { name: 'Car Loan（Vios）',              category: 'loan',       default_amount: 921.00, sort_order: 3,  is_active: true, is_shared_family: false },
  { name: 'Credit Card Loan（Alliance）',  category: 'loan',       default_amount: 215.96, sort_order: 4,  is_active: true, is_shared_family: false },
  { name: 'Management Fees',              category: 'management', default_amount: 33.00,  sort_order: 5,  is_active: true, is_shared_family: false },
  { name: "Anson's Allowance",            category: 'allowance',  default_amount: 600.00, sort_order: 6,  is_active: true, is_shared_family: false },
  { name: 'Electricity Bill（23CR）',      category: 'utilities',  default_amount: 0,      sort_order: 7,  is_active: true, is_shared_family: false },
  { name: 'Water Bill（23CR）',            category: 'utilities',  default_amount: 0,      sort_order: 8,  is_active: true, is_shared_family: false },
];

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
  { key: 'expense_car',         label: 'Car Expenses', label_zh: '车辆费用', color: 'bg-rose-50 text-rose-600', deduction_type: 'daily_manual', sort_order: 6, is_default: true, is_active: true },
];

let seeded = false;

export async function seedDefaultCategories() {
  if (seeded) return;
  seeded = true;

  try {
    const [existingIncome, existingDeductions, existingBills] = await Promise.all([
      base44.entities.IncomeSource.list(),
      base44.entities.DeductionCategory.list(),
      base44.entities.HouseholdBill.list(),
    ]);

    const existingIncomeKeys = new Set(existingIncome.map(i => i.key));
    const toCreateIncome = DEFAULT_INCOME_SOURCES.filter(s => !existingIncomeKeys.has(s.key));
    if (toCreateIncome.length > 0) await base44.entities.IncomeSource.bulkCreate(toCreateIncome);

    const existingDeductionKeys = new Set(existingDeductions.map(d => d.key));
    const toCreateDeductions = DEFAULT_DEDUCTION_CATEGORIES.filter(d => !existingDeductionKeys.has(d.key));
    if (toCreateDeductions.length > 0) await base44.entities.DeductionCategory.bulkCreate(toCreateDeductions);

    // Seed household bills if none exist yet (first-time setup)
    if (existingBills.length === 0) {
      await base44.entities.HouseholdBill.bulkCreate(DEFAULT_HOUSEHOLD_BILLS);
    } else {
      // Deactivate removed bills (LG Water Purifier)
      const lgBill = existingBills.find(b => b.name && b.name.includes('LG Water Purifier'));
      if (lgBill && lgBill.is_active) {
        await base44.entities.HouseholdBill.update(lgBill.id, { is_active: false });
      }
      // Ensure fixed amounts are up to date for existing bills
      for (const def of DEFAULT_HOUSEHOLD_BILLS.filter(b => b.default_amount > 0)) {
        const existing = existingBills.find(b => b.name === def.name);
        if (existing && existing.default_amount !== def.default_amount) {
          await base44.entities.HouseholdBill.update(existing.id, { default_amount: def.default_amount });
        }
      }
    }
  } catch (e) {
    console.warn('Seed failed:', e);
  }
}