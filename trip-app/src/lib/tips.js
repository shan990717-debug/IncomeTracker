import { shiftDate, md } from './dates';

/** 须知 types, in display order. */
export const TIP_TYPES = [
  { id: 'transport', label: '交通', emoji: '🚄' },
  { id: 'entry', label: '入境签证', emoji: '🛂' },
  { id: 'booking', label: '预订', emoji: '🎟️' },
  { id: 'connect', label: '上网 / App', emoji: '📶' },
  { id: 'money', label: '钱', emoji: '💳' },
  { id: 'avoid', label: '避雷提醒', emoji: '⚠️' },
  { id: 'other', label: '其他', emoji: '📌' },
];
export const tipType = (id) => TIP_TYPES.find((t) => t.id === id) || TIP_TYPES[TIP_TYPES.length - 1];

export const PASSPORTS = ['马来西亚', '新加坡', '中国', '香港', '澳门', '台湾', '日本', '韩国', '泰国', '印尼', '菲律宾', '越南', '美国', '英国', '澳大利亚', '加拿大'];

const near = (a, b) => a === b || a.includes(b) || b.includes(a) || a.replace(/岛$/, '') === b.replace(/岛$/, '');

/** Does this tip matter for this trip's cities? (Whole-country tips always do.) */
export function relevantToTrip(tip, trip) {
  const cities = tip.cities || [];
  if (!cities.length) return true;
  const inTrip = (c) => trip.regions.some((r) => near(r, c));
  return tip.needsAllCities ? cities.every(inTrip) : cities.some(inTrip);
}

/** The tip names passports and mine isn't one of them. */
export function notForMyPassport(tip, passport) {
  const list = tip.nationalities || [];
  return !!passport && list.length > 0 && !list.some((n) => near(n, passport));
}

export const me = (state) => state.user?.id || 'local';

export function isDone(tip, state) {
  return tip.personal ? tip.doneBy.includes(me(state)) : tip.doneBy.length > 0;
}

/** "出发前 30 天（11/29 前）" + whether it's overdue. */
export function whenLabel(tip, trip, today) {
  if (!tip.isAction || !Number.isFinite(tip.offsetDays)) return null;
  const d = tip.offsetDays;
  if (d >= 0 || !trip.startDate) return { text: d > 0 ? `到当地后 ${d} 天内` : '出发当天 / 到当地', late: false, date: '' };
  const due = shiftDate(trip.startDate, d);
  const late = today > due;
  const daysLate = late ? Math.round((new Date(today) - new Date(due)) / 86400000) : 0;
  return { text: `出发前 ${-d} 天（${md(due)} 前）${late ? ` · 已过 ${daysLate} 天` : ''}`, late, date: due };
}
