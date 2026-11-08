import { buildTimeline, defaultStay, travel, toMin, toHHMM } from '../../server/schedule.js';
import { PLAN_DAY_DEFAULTS } from './store';
import { tripDates, md, weekday } from './dates';
import { hasCoords, km } from './geo';
import { bookingsForDay } from './bookings';
import { lookupLeg } from './transit';

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
 * A day's settings. Where the day starts / ends, in order of priority:
 *   1. set by hand for this day
 *   2. the bookings (arrival flight, hotel, departure flight)
 *   3. the latest earlier day's start (the hotel usually stays the same)
 * endPlace { none: true } = 不用回去; no end set = back to the start.
 */
export function daySettings(state, trip, day) {
  const days = state.planDays.filter((d) => d.tripId === trip.id);
  const own = days.find((d) => d.day === day);
  const s = { ...PLAN_DAY_DEFAULTS, ...(own || {}), day, tripId: trip.id };
  const bk = bookingsForDay(state, trip, day);

  let start = s.startPlace;
  let startSource = start ? 'manual' : '';
  if (!start && bk.start) { start = bk.start; startSource = 'booking'; }
  if (!start) {
    const prev = days.filter((d) => d.day < day && d.startPlace).sort((a, b) => b.day.localeCompare(a.day))[0];
    if (prev) { start = prev.startPlace; startSource = 'prev'; }
  }

  const noReturn = s.endPlace?.none;
  let end = noReturn ? null : s.endPlace;
  let endSource = end ? 'manual' : noReturn ? 'none' : '';
  if (!end && !noReturn && bk.end) { end = bk.end; endSource = 'booking'; }
  if (!end && !noReturn) { end = start; endSource = 'back'; }

  // Booking times only push the day later / earlier; they never widen it.
  const startTime = bk.startTime && bk.startTime > s.startTime ? bk.startTime : s.startTime;
  const endTime = bk.endTime && bk.endTime < s.endTime ? bk.endTime : s.endTime;
  // Flying home: be at the airport 3 h before take-off, so leave the hotel early enough to get there.
  let dayStart = startTime;
  let leaveBy = '';
  let toAirport = 0;
  if (bk.departure && end) {
    toAirport = lookupLeg(start, end)?.minutes ?? travel(start, end).minutes;
    leaveBy = toHHMM(Math.max(0, toMin(endTime) - toAirport));
    if (dayStart > leaveBy) dayStart = leaveBy;
  }
  const label = (p) => (p ? `${p.label ? `${p.label} · ` : ''}${p.name}` : '');
  return {
    ...s,
    startTime: dayStart, endTime, bookings: bk, leaveBy, toAirport,
    inherited: startSource === 'prev',
    start, startSource, startLabel: label(start),
    end, endSource,
    endLabel: noReturn ? '不用回去' : endSource === 'back' ? (start ? `回 ${start.name}` : '') : label(end),
  };
}

/**
 * The day split around its fixed slots (trains / flights). Each zone is a
 * stretch the user's stops fall into: before the first train, between, after.
 * A stop goes to the zone whose end of the ride it is closest to.
 */
export function zonesOf(state, trip, day) {
  let set = daySettings(state, trip, day);
  const fixed = set.bookings.fixed;
  const all = stopsOf(state, trip, day).map((s) => ({ ...s, stay: s.planStay || defaultStay(s), meal: s.planMeal || '' }));
  const events = all.filter((s) => fixedTime(s)).sort((a, b) => fixedTime(a).time.localeCompare(fixedTime(b).time));
  const stops = all.filter((s) => !fixedTime(s));
  // A plan earlier than the usual start (滑雪 08:00) makes the day start earlier.
  if (events[0]) {
    const { time, door } = fixedTime(events[0]);
    const need = toHHMM(Math.max(0, toMin(time) - (door ? 0 : 30)));
    if (need < set.startTime) set = { ...set, startTime: need };
  }
  const zones = [{ start: set.start, startTime: set.startTime, stops: [] }];
  fixed.forEach((f) => {
    const z = zones.at(-1);
    z.end = f.lat != null ? { name: f.name, lat: f.lat, lng: f.lng } : null;
    z.endTime = f.fixed;
    z.fixed = f;
    zones.push({ start: f.after, startTime: f.endTime || f.fixed, stops: [] });
  });
  Object.assign(zones.at(-1), { end: set.end, endTime: set.endTime });
  const anchor = (z, i) => (i === 0 ? fixed[0] && { lat: fixed[0].lat, lng: fixed[0].lng } : z.start);
  stops.forEach((s) => {
    let best = 0;
    if (fixed.length && hasCoords(s)) {
      let bestD = Infinity;
      zones.forEach((z, i) => { const d = km(anchor(z, i), s); if (d != null && d < bestD) { bestD = d; best = i; } });
    }
    zones[best].stops.push(s);
  });
  // Then split each stretch again around the user's own fixed-time plans (倒数 23:00, 滑雪 08:00–19:00).
  const out = [];
  zones.forEach((z, i) => {
    const mine = events.filter((e) => (i === 0 || fixedTime(e).time >= (z.startTime || '00:00')) && (i === zones.length - 1 || fixedTime(e).time < z.endTime));
    if (!mine.length) { out.push(z); return; }
    let cur = { start: z.start, startTime: z.startTime, stops: [] };
    const parts = [];
    mine.forEach((e) => {
      const { time, door } = fixedTime(e);
      const at = door ? set.start : hasCoords(e) ? e : null;
      const item = { ...e, fixed: time, ready: 0, kind: 'event', noLeg: door, endTime: toHHMM(toMin(time) + e.stay), after: door ? set.start : e };
      Object.assign(cur, { end: at, endTime: time, fixed: item });
      parts.push(cur);
      cur = { start: door ? set.start : e, startTime: item.endTime, stops: [] };
    });
    Object.assign(cur, { end: z.end, endTime: z.endTime, fixed: z.fixed });
    parts.push(cur);
    // A stop goes before / after an event by its place in the day's order.
    z.stops.forEach((s) => { parts[mine.filter((e) => (e.planOrder ?? 0) < (s.planOrder ?? 0)).length].stops.push(s); });
    out.push(...parts);
  });
  return { set, zones: out };
}

/** A stop with its own fixed time: planTime '=HH:MM', '+' = the time already includes getting there and back. */
export function fixedTime(s) {
  const m = /^=(\d{2}:\d{2})(\+)?$/.exec(s?.planTime || '');
  return m ? { time: m[1], door: !!m[2] } : null;
}
export const encodeFixed = (time, door) => (time ? `=${time}${door ? '+' : ''}` : '');

/** Times and legs for a day, in its current order (fixed trains / flights included). */
export function timelineOf(state, trip, day) {
  const { set, zones } = zonesOf(state, trip, day);
  const stops = zones.flatMap((z) => [...z.stops, ...(z.fixed ? [z.fixed] : [])]);
  const tl = buildTimeline({ start: set.start, end: set.end, startTime: set.startTime, lunch: set.lunch, dinner: set.dinner, stops, lookup: lookupLeg });
  const late = tl.stops.length > 0 && !!set.endTime && tl.endMin > toMin(set.endTime);
  return { ...tl, settings: set, zones, late };
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
