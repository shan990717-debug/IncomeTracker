import { INCOME_FIELDS, ALL_EXPENSE_KEYS, INCOME_THRESHOLDS } from './constants';

export function calcDailyTotals(record) {
  const totalIncome = INCOME_FIELDS.reduce((s, f) => s + (parseFloat(record[f.key]) || 0), 0);
  const totalExpense = ALL_EXPENSE_KEYS.reduce((s, k) => s + (parseFloat(record[k]) || 0), 0);
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

export function calcHealthStatus(actual_income) {
  const t = INCOME_THRESHOLDS;
  if (actual_income < t.normal_breakeven)  return 'danger';
  if (actual_income < t.minimum_safe)      return 'breakeven';
  if (actual_income < t.special_breakeven) return 'minsafe';
  if (actual_income < t.comfortable)       return 'tight';
  if (actual_income < t.growth)            return 'comfortable';
  return 'growing';
}

export function calcHealthReasons(actual_income, lang) {
  const t = INCOME_THRESHOLDS;
  const reasons = [];
  if (actual_income < t.normal_breakeven) {
    reasons.push(lang === 'zh' ? `收入低于正常月收支平衡点 RM${t.normal_breakeven.toLocaleString()}` : `Below normal month break-even RM${t.normal_breakeven.toLocaleString()}`);
  } else if (actual_income < t.minimum_safe) {
    const gap = t.minimum_safe - actual_income;
    reasons.push(lang === 'zh' ? `距最低安全目标还差 RM${gap.toLocaleString()}` : `RM${gap.toLocaleString()} below Minimum Safety Target`);
  } else if (actual_income < t.special_breakeven) {
    const gap = t.special_breakeven - actual_income;
    reasons.push(lang === 'zh' ? `距特殊月收支平衡点还差 RM${gap.toLocaleString()}` : `RM${gap.toLocaleString()} below Special Month Break-even`);
  } else if (actual_income < t.comfortable) {
    const gap = t.comfortable - actual_income;
    reasons.push(lang === 'zh' ? `距舒适安全目标还差 RM${gap.toLocaleString()}` : `RM${gap.toLocaleString()} below Comfortable Safety Target`);
  }
  return reasons;
}

export function monthStr(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

export function formatRM(val) {
  return `RM ${parseFloat(val || 0).toFixed(2)}`;
}

// Format any date string (yyyy-MM-dd) or Date object to DD/MM/YYYY
export function fmtDate(dateStrOrObj) {
  if (!dateStrOrObj) return '—';
  try {
    // If it's already a string like yyyy-MM-dd, parse manually to avoid timezone issues
    if (typeof dateStrOrObj === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateStrOrObj)) {
      const [y, m, d] = dateStrOrObj.split('-');
      return `${d}/${m}/${y}`;
    }
    const d = new Date(dateStrOrObj);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yyyy = d.getFullYear();
    return `${dd}/${mm}/${yyyy}`;
  } catch {
    return String(dateStrOrObj);
  }
}