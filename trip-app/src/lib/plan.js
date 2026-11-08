import { buildTimeline, defaultStay, travel } from '../../server/schedule.js';
import { PLAN_DAY_DEFAULTS } from './store';
import { tripDates, md, weekday } from './dates';
import { hasCoords } from './geo';

/*
 * 行程 helpers. A place is on the plan when save.inPlan is true; planDay ''
 * means 待安排. Times are always recomputed from the order, stay and meal, so
 * a manual reorder and an AI plan share one source of truth.
 */

export const UNPLANNED = '';

export const daysOf = (trip) => tripDates(trip);
export const dayTitle = (trip, day) => {
  const i = daysOf(trip).indexOf(day);
  return `${i >= 0 ? `第 ${i + 1} 天 · ` : ''}${md(day)} ${weekday(day)}`;
};

export const planned = (state, trip) => state.saves.filter((s) => s.tripId === trip.id && s.inPlan);
export const stopsOf = (state, trip, day) => planned(state, trip)
  .filter((s) => (s.planDay || '') === day)
  .sort((a, b) => (a.planOrder ?? 999) - (b.planOrder ?? 999) || a.createdAt - b.createdAt);

/**
 * A day's settings. If a day has no start point yet, use the latest earlier
 * day's (the hotel usually stays the same). end === null → back to start.
 */
export function daySettings(state, trip, day) {
  const days = state.planDays.filter((d) => d.tripId === trip.id);
  const own = days.find((d) => d.day === day);
  const s = { ...PLAN_DAY_DEFAULTS, ...(own || {}), day, tripId: trip.id };
  let inherited = false;
  if (!s.startPlace) {
    const prev = days.filter((d) => d.day < day && d.startPlace).sort((a, b) => b.day.localeCompare(a.day))[0];
    if (prev) { s.startPlace = prev.startPlace; inherited = true; }
  }
  const noReturn = s.endPlace?.none;
  return {
    ...s,
    inherited,
    start: s.startPlace,
    end: noReturn ? null : s.endPlace || s.startPlace,
    endLabel: noReturn ? '不用回去' : s.endPlace ? s.endPlace.name : s.startPlace ? `回 ${s.startPlace.name}` : '',
  };
}

/** Times and legs for a day, in its current order. */
export function timelineOf(state, trip, day) {
  const set = daySettings(state, trip, day);
  const stops = stopsOf(state, trip, day).map((s) => ({ ...s, stay: s.planStay || defaultStay(s), meal: s.planMeal || '' }));
  const tl = buildTimeline({ start: set.start, end: set.end, startTime: set.startTime, lunch: set.lunch, dinner: set.dinner, stops });
  const late = tl.stops.length && set.endTime && tl.endTime > set.endTime && tl.endTime >= set.startTime;
  return { ...tl, settings: set, late };
}

export { defaultStay, travel };

/* ---------- route links ---------- */

const pName = (p) => p.nameLocal || p.title || p.name || '';

/** Directions from a → b in Naver / Kakao / Google. Returns {} for points without coordinates. */
export function routeLinks(a, b, mode) {
  if (!hasCoords(a) || !hasCoords(b)) {
    const dest = encodeURIComponent(pName(b));
    return { google: `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=${mode === 'walk' ? 'walking' : 'transit'}` };
  }
  const e = encodeURIComponent;
  const walk = mode === 'walk';
  return {
    naver: `nmap://route/${walk ? 'walk' : 'public'}?slat=${a.lat}&slng=${a.lng}&sname=${e(pName(a))}&dlat=${b.lat}&dlng=${b.lng}&dname=${e(pName(b))}&appname=tripaa-go.vercel.app`,
    kakao: `https://map.kakao.com/link/from/${e(pName(a))},${a.lat},${a.lng}/to/${e(pName(b))},${b.lat},${b.lng}`,
    google: `https://www.google.com/maps/dir/?api=1&origin=${a.lat},${a.lng}&destination=${b.lat},${b.lng}&travelmode=${walk ? 'walking' : 'transit'}`,
  };
}

export const MEAL_LABEL = { lunch: '🍱 午餐', dinner: '🍽 晚餐' };
export const fmtMin = (n) => (n >= 60 ? `${Math.floor(n / 60)} 小时${n % 60 ? ` ${n % 60} 分` : ''}` : `${n} 分`);
