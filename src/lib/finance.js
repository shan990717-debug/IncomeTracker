import { INCOME_FIELDS, EXPENSE_FIELDS } from './constants';

// Expense keys without food (food is NOT an operating cost)
const OPERATING_EXPENSE_KEYS = ['expense_petrol', 'expense_toll', 'expense_parking', 'expense_car_small', 'expense_others'];

export function calcDailyTotals(record) {
  const totalIncome = INCOME_FIELDS.reduce((s, f) => s + (parseFloat(record[f.key]) || 0), 0);
  const totalExpense = OPERATING_EXPENSE_KEYS.reduce((s, k) => s + (parseFloat(record[k]) || 0), 0);
  const actualIncome = totalIncome - totalExpense;
  return { totalIncome, totalExpense, actualIncome };
}

export function calcMonthlyTotals(records) {
  return records.reduce((acc, r) => {
    acc.grossIncome += r.total_income || 0;
    acc.totalExpense += r.total_expense || 0;
    acc.actualIncome += r.actual_income || 0;
    acc.bankTotal += r.stored_bank || 0;
    acc.cashTotal += r.stored_cash || 0;
    return acc;
  }, { grossIncome: 0, totalExpense: 0, actualIncome: 0, bankTotal: 0, cashTotal: 0 });
}

export function calcHealthStatus(settlement, targets) {
  const { actual_income, cashflow_buffer, emergency_savings, car_repair_fund, travel_savings } = settlement;
  const comfortable = targets?.comfortable || 5000;

  if (cashflow_buffer < 0 || actual_income < (targets?.minimum_survival || 3500) * 0.8) return 'danger';
  if (cashflow_buffer < 300 || actual_income < (targets?.minimum_survival || 3500)) return 'tight';
  if (actual_income >= comfortable && cashflow_buffer >= 500 && (emergency_savings || 0) > 0 && (travel_savings || 0) > 0) return 'flexible';
  if (actual_income >= (targets?.comfortable || 5000) * 0.85 && cashflow_buffer >= 400) return 'growing';
  return 'stable';
}

export function calcHealthReasons(settlement, targets, lang) {
  const reasons = [];
  const { actual_income, cashflow_buffer, car_repair_fund, emergency_savings } = settlement;
  const comfortable = targets?.comfortable || 5000;
  const minimum = targets?.minimum_survival || 3500;

  if (cashflow_buffer < 0) {
    reasons.push(lang === 'zh' ? '现金流缓冲为负数' : 'Cash Flow Buffer is negative');
  } else if (cashflow_buffer < 300) {
    reasons.push(lang === 'zh' ? `现金流缓冲仅 RM${cashflow_buffer.toFixed(0)}，偏低` : `Cash Flow Buffer is only RM${cashflow_buffer.toFixed(0)}, too low`);
  }
  if (actual_income < minimum) {
    reasons.push(lang === 'zh' ? `收入低于最低生存目标 RM${minimum}` : `Income below Minimum Survival Target RM${minimum}`);
  }
  if ((car_repair_fund || 0) < 200) {
    reasons.push(lang === 'zh' ? '车辆维修基金余额不足' : 'Car Repair Fund is below target');
  }
  if (actual_income < comfortable) {
    const gap = comfortable - actual_income;
    reasons.push(lang === 'zh' ? `距舒适目标还差 RM${gap.toFixed(0)}` : `RM${gap.toFixed(0)} away from Comfortable Target`);
  }
  if (!(emergency_savings > 0)) {
    reasons.push(lang === 'zh' ? '本月无应急储蓄' : 'No Emergency Savings contributed this month');
  }
  return reasons;
}

export function monthStr(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function formatRM(val) {
  return `RM ${parseFloat(val || 0).toFixed(2)}`;
}