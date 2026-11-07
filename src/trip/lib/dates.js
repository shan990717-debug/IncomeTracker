import { addDays, differenceInCalendarDays, format, parseISO } from 'date-fns';

export const iso = (d) => format(d, 'yyyy-MM-dd');
export const todayISO = () => iso(new Date());
export const parse = (s) => parseISO(s);

const WEEK = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
export const weekday = (s) => WEEK[parseISO(s).getDay()];
export const md = (s) => format(parseISO(s), 'M/d');

/** All dates of a trip, inclusive. */
export function tripDates(trip) {
  if (!trip?.startDate || !trip?.endDate) return [];
  const n = differenceInCalendarDays(parseISO(trip.endDate), parseISO(trip.startDate));
  return Array.from({ length: Math.max(0, n) + 1 }, (_, i) => iso(addDays(parseISO(trip.startDate), i)));
}

export const shiftDate = (s, days) => iso(addDays(parseISO(s), days));
export const daysBetween = (a, b) => differenceInCalendarDays(parseISO(b), parseISO(a));

export const toMinutes = (hhmm) => {
  if (!hhmm) return 24 * 60;
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + (m || 0);
};
export const fromMinutes = (n) => `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;

/** "出发前 12 天" style label for a due date relative to today. */
export function dueLabel(due) {
  if (!due) return '';
  const d = differenceInCalendarDays(parseISO(due), new Date());
  if (d < 0) return `已过 ${-d} 天`;
  if (d === 0) return '今天';
  if (d === 1) return '明天';
  return `${d} 天后`;
}
