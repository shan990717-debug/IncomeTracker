/*
 * Day-plan arithmetic shared by the app (re-timing after a manual reorder) and
 * /api/plan (after AI picks the order). Pure functions, no imports.
 *
 * Travel time is estimated from straight-line distance until a real routing
 * API (ODsay / Kakao) is plugged in:
 *   ≤ 1.2 km → walking: km × 1.3 (streets aren't straight) at 4.5 km/h
 *   farther  → transit: 10 min (walk to station, wait) + km × 1.3 × 2.2 min
 */

const has = (p) => p && Number.isFinite(p.lat) && Number.isFinite(p.lng);

export function km(a, b) {
  if (!has(a) || !has(b)) return null;
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** { km, minutes, mode: 'walk' | 'transit' | 'unknown' } */
export function travel(a, b) {
  const d = km(a, b);
  if (d == null) return { km: null, minutes: 20, mode: 'unknown' };
  if (d <= 1.2) return { km: d, minutes: Math.max(2, Math.round((d * 1.3 * 60) / 4.5)), mode: 'walk' };
  return { km: d, minutes: Math.round(10 + d * 1.3 * 2.2), mode: 'transit' };
}

export const toMin = (hhmm) => {
  const [h, m] = String(hhmm || '').split(':').map(Number);
  return Number.isFinite(h) ? h * 60 + (m || 0) : null;
};
export const toHHMM = (n) => `${String(Math.floor(n / 60) % 24).padStart(2, '0')}:${String(Math.round(n % 60)).padStart(2, '0')}`;
const windowOf = (s) => { const [a, b] = String(s || '').split('-'); return [toMin(a), toMin(b)]; };

/** Typical time spent at a stop, by kind. */
export function defaultStay(stop) {
  const sub = stop.subtype || '';
  if (/咖啡|甜点/.test(sub)) return 40;
  if (/街区市场|市场/.test(sub)) return 90;
  if (/乐园/.test(sub)) return 240;
  if (/博物馆|展览/.test(sub)) return 90;
  return { food: 60, place: 60, experience: 90, shopping: 60 }[stop.category] || 60;
}

/**
 * Walk the ordered stops from the start time and stamp arrival times.
 * A lunch/dinner stop reached before its meal window waits for the window.
 * Returns { stops: [{ ...stop, time }], legs, endTime, walkMin, transitMin }.
 */
export function buildTimeline({ start, end, startTime = '10:00', lunch, dinner, stops }) {
  const [lunchStart] = windowOf(lunch);
  const [dinnerStart] = windowOf(dinner);
  let t = toMin(startTime) ?? 600;
  let prev = start;
  const legs = [];
  const out = [];
  let walkMin = 0;
  let transitMin = 0;
  const addLeg = (from, to, fromId, toId) => {
    const tr = travel(from, to);
    legs.push({ from: fromId, to: toId, km: tr.km == null ? null : Math.round(tr.km * 10) / 10, minutes: tr.minutes, mode: tr.mode });
    if (tr.mode === 'walk') walkMin += tr.minutes; else transitMin += tr.minutes;
    return tr.minutes;
  };
  stops.forEach((s, i) => {
    t += addLeg(prev, s, i === 0 ? 'start' : stops[i - 1].id, s.id);
    if (s.fixed) {
      // A train / flight: be there `ready` minutes early, then ride until it arrives at `after`.
      const at = toMin(s.fixed);
      const due = at - (s.ready || 0);
      const late = t > due;
      if (t < at) t = at;
      out.push({ ...s, time: s.fixed, late });
      t = Math.max(t, at) + (s.stay || 0);
      prev = s.after || s;
      return;
    }
    if (s.meal === 'lunch' && lunchStart != null && t < lunchStart) t = lunchStart;
    if (s.meal === 'dinner' && dinnerStart != null && t < dinnerStart) t = dinnerStart;
    out.push({ ...s, time: toHHMM(t) });
    t += s.stay || defaultStay(s);
    prev = s;
  });
  if (end && (has(end) || end.name)) t += addLeg(prev, end, stops.at(-1)?.id || 'start', 'end');
  return { stops: out, legs, endTime: toHHMM(t), endMin: t, walkMin, transitMin };
}

/** Fallback order when AI isn't available: always go to the nearest unvisited stop. */
export function nearestOrder(start, stops) {
  const left = stops.map((s) => ({ ...s })); // don't touch the caller's objects
  const order = [];
  let cur = start;
  while (left.length) {
    let best = 0;
    let bestD = Infinity;
    left.forEach((s, i) => { const d = km(cur, s); const v = d == null ? 999 : d; if (v < bestD) { bestD = v; best = i; } });
    cur = left.splice(best, 1)[0];
    order.push(cur);
  }
  // Put the first two food stops at lunch and dinner.
  const food = order.filter((s) => s.category === 'food' && !/咖啡|甜点/.test(s.subtype || ''));
  if (food[0]) food[0].meal = 'lunch';
  if (food[1]) food[1].meal = 'dinner';
  return order;
}
