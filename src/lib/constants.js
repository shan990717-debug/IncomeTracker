export const INCOME_FIELDS = [
  { key: 'income_grab',          label: 'Grab',            color: 'bg-green-50 text-green-600' },
  { key: 'income_tips',          label: 'Tips',            color: 'bg-pink-50 text-pink-600' },
  { key: 'income_incentive',     label: 'Incentive',       color: 'bg-purple-50 text-purple-600' },
  { key: 'income_turbo5',        label: 'Turbo 5%',        color: 'bg-orange-50 text-orange-500' },
  { key: 'income_turbo_cashback',label: 'Turbo Cash Back', color: 'bg-amber-50 text-amber-600' },
  { key: 'income_cdian',         label: 'C单',             color: 'bg-red-50 text-red-500' },
  { key: 'income_indrive',       label: 'In Drive',        color: 'bg-blue-50 text-blue-600' },
  { key: 'income_aa',            label: 'AA',              color: 'bg-cyan-50 text-cyan-600' },
  { key: 'income_bolt',          label: 'Bolt',            color: 'bg-emerald-50 text-emerald-600' },
  { key: 'income_3party',        label: '3 Party Comm',    color: 'bg-indigo-50 text-indigo-600' },
];

// Daily manual expense fields (shown in expense section)
// Grab Loan removed — fully paid off
export const EXPENSE_FIELDS = [
  { key: 'expense_petrol',  label: 'Petrol',   color: 'bg-red-50 text-red-500' },
  { key: 'expense_shidan',  label: '射单',     color: 'bg-purple-50 text-purple-600' },
  { key: 'expense_toll',    label: 'Toll',     color: 'bg-orange-50 text-orange-500' },
  { key: 'expense_parking', label: 'Parking',  color: 'bg-indigo-50 text-indigo-500' },
];

// PA Insurance: RM23.44/month fixed. Shown in monthly summary only (not daily input).
export const PA_INSURANCE_MONTHLY = 23.44;

// Keys used in daily formula
export const ALL_EXPENSE_KEYS = [
  'expense_petrol', 'expense_shidan', 'expense_toll', 'expense_parking', 'expense_pa_insurance',
];

// Default personal spending percentage (editable in Settlement screen)
export const DEFAULT_PERSONAL_SPENDING_PCT = 35;

export const HEALTH_STATUS = {
  danger:   { label: 'Danger',   labelZh: '危险',   color: 'text-red-600',    bg: 'bg-red-50',    border: 'border-red-200' },
  tight:    { label: 'Tight',    labelZh: '偏紧',   color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  stable:   { label: 'Stable',   labelZh: '稳定',   color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  growing:  { label: 'Growing',  labelZh: '成长中', color: 'text-primary',    bg: 'bg-primary/10',border: 'border-primary/30' },
  flexible: { label: 'Flexible', labelZh: '充裕',   color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' },
};

export const GOAL_CATEGORIES = [
  { key: 'tuition',   label: 'Tuition Fund',  labelZh: '学费',   icon: '🎓' },
  { key: 'travel',    label: 'Travel Fund',   labelZh: '旅游',   icon: '✈️' },
  { key: 'emergency', label: 'Emergency Fund',labelZh: '应急',   icon: '🛡️' },
  { key: 'car',       label: 'Car Reserve',   labelZh: '车辆储备', icon: '🚗' },
  { key: 'gadget',    label: 'Gadget / Phone',labelZh: '电子产品', icon: '📱' },
  { key: 'house',     label: 'House',         labelZh: '房子',   icon: '🏠' },
  { key: 'other',     label: 'Other',         labelZh: '其他',   icon: '⭐' },
];

export const CLAIM_CATEGORIES = [
  { key: 'family',    label: 'Family',    labelZh: '家庭' },
  { key: 'medical',   label: 'Medical',   labelZh: '医疗' },
  { key: 'vehicle',   label: 'Vehicle',   labelZh: '车辆' },
  { key: 'food',      label: 'Food',      labelZh: '饮食' },
  { key: 'utilities', label: 'Utilities', labelZh: '水电' },
  { key: 'other',     label: 'Other',     labelZh: '其他' },
];

export const CAR_REPAIR_CATEGORIES = [
  { key: 'aircon',   label: 'Aircon Repair', labelZh: '冷气维修' },
  { key: 'tyre',     label: 'Tyre',          labelZh: '轮胎' },
  { key: 'engine',   label: 'Engine',        labelZh: '引擎' },
  { key: 'accident', label: 'Accident',      labelZh: '事故' },
  { key: 'service',  label: 'Major Service', labelZh: '大保养' },
  { key: 'other',    label: 'Other Repair',  labelZh: '其他维修' },
];