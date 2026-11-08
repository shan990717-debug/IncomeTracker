import { actions, getState, ofTrip, norm } from './store';
import { planDayAI, planTripAI, fetchMustList } from './ai';
import { daysOf, dayTitle, stopsOf, timelineOf, daySettings } from './plan';
import { km, hasCoords } from './geo';

/*
 * AI 帮我排整个旅行.
 *   1. buildTripInput: the days (city from the hotel, usable hours from the
 *      bookings), our places, and 必去推荐 to fill gaps
 *   2. /api/tripplan decides which place goes on which day → preview
 *   3. applyTripPlan writes it, then orderDay sorts each day (like 「AI 帮我排」)
 * Days already arranged by hand are kept unless 「全部重排」.
 */

export const PREFS = ['经典', '美食', '拍照打卡', '购物', '夜景', '下雨天', '慢慢逛'];
export const PACES = [['relaxed', '轻松', '一天 3–4 站'], ['normal', '普通', '一天 5–6 站'], ['packed', '紧凑', '一天 7–8 站']];
export const countryOf = (city) => (/首尔|釜山|济州|庆州|江陵|全州|仁川/.test(city) ? '韩国' : /东京|大阪|京都|北海道|札幌|福冈|冲绳|名古屋/.test(city) ? '日本' : '');
export const mustKey = (city, prefs = []) => (prefs.length ? `${city}|${[...prefs].sort().join(',')}` : city);

/** The city a point is in: the region of the nearest saved place within 40 km. */
function cityNear(point, saves) {
  if (!hasCoords(point)) return '';
  let best = null;
  let bestD = 40;
  saves.forEach((s) => { const d = km(point, s); if (s.region && d != null && d < bestD) { bestD = d; best = s.region; } });
  return best || '';
}

const kind = (s, cat) => [cat, s.subtype].filter(Boolean).join('/');
const CAT = { food: '美食', place: '景点', experience: '体验', shopping: '购物' };

/** Make sure every city of the trip has a 必去推荐 list (one AI call per city, shared). */
export async function ensureMustLists(trip, prefs) {
  const st = getState();
  const missing = trip.regions.filter((c) => !st.mustLists.some((m) => m.tripId === trip.id && (m.city === c || m.city.startsWith(`${c}|`))));
  await Promise.all(missing.map(async (c) => {
    try { actions.setMustList(trip.id, mustKey(c, prefs), await fetchMustList(c, countryOf(c), prefs)); } catch { /* plan without it */ }
  }));
}

export function buildTripInput(trip, { mode, pace, prefs }) {
  const st = getState();
  const saves = ofTrip(st.saves, trip).filter((s) => s.verdict !== 'avoid');
  const all = daysOf(trip);
  const locked = mode === 'keep' ? new Set(all.filter((d) => stopsOf(st, trip, d).length)) : new Set();
  const days = all.filter((d) => !locked.has(d)).map((d) => {
    const set = daySettings(st, trip, d);
    const fixed = set.bookings.fixed;
    const from = cityNear(set.start, saves);
    const to = fixed.length ? cityNear(fixed.at(-1).after, saves) || cityNear(set.end, saves) : '';
    return {
      day: d, label: dayTitle(trip, d),
      city: to && to !== from ? `${from || '?'}→${to}` : from,
      base: set.bookings.sleepAt?.title || set.start?.name || '',
      hours: `${set.startTime}-${set.endTime}`,
      note: [set.bookings.arrival && '当天落地', set.bookings.departure && '当天回程', ...fixed.map((f) => `${f.title} ${f.fixed}`)].filter(Boolean).join('；'),
    };
  });
  const usable = saves.filter((s) => !(s.inPlan && locked.has(s.planDay)));
  const places = usable.map((s) => ({ id: s.id, title: s.title, city: s.region, area: s.area, kind: kind(s, CAT[s.category]), note: s.note }));
  // 必去推荐 not already in 攻略库, from every list this trip has.
  const have = new Set(saves.flatMap((s) => [norm(s.title), norm(s.nameLocal)]).filter(Boolean));
  const seen = new Set();
  const extras = [];
  st.mustLists.filter((m) => m.tripId === trip.id).forEach((m) => {
    const city = m.city.split('|')[0];
    (m.data?.places || []).forEach((p) => {
      const k = `${city}:${p.name}`;
      if (seen.has(k) || have.has(norm(p.name)) || (p.nameLocal && have.has(norm(p.nameLocal)))) return;
      seen.add(k);
      extras.push({ id: `must:${k}`, title: p.name, city, area: p.area, kind: kind(p, CAT[p.category]), note: p.tip, place: { ...p, city } });
    });
  });
  return { days, places, extras, pace, prefs, locked: [...locked] };
}

export async function planTrip(trip, opts) {
  await ensureMustLists(trip, opts.prefs);
  const input = buildTripInput(trip, opts);
  if (!input.days.length) throw new Error('每一天都已经排好了；要重排请选「全部重排」');
  const out = await planTripAI({ days: input.days, places: input.places, extras: input.extras.map(({ place, ...x }) => x), pace: input.pace, prefs: input.prefs }); // eslint-disable-line no-unused-vars
  const extraById = new Map(input.extras.map((x) => [x.id, x]));
  const saveById = new Map(getState().saves.map((s) => [s.id, s]));
  return {
    summary: out.summary,
    locked: input.locked,
    days: out.days.map((d) => ({
      ...d,
      stops: d.stops.map((x) => (x.extra
        ? { id: x.id, extra: true, title: extraById.get(x.id)?.title || '', area: extraById.get(x.id)?.area || '', place: extraById.get(x.id)?.place, on: true }
        : { id: x.id, title: saveById.get(x.id)?.title || '', area: saveById.get(x.id)?.area || '', category: saveById.get(x.id)?.category })).filter((x) => x.title),
    })),
    unassigned: input.places.filter((p) => !out.days.some((d) => d.stops.some((x) => x.id === p.id))).length,
  };
}

/** Order one day's stops with AI (each stretch around a train / flight on its own). */
export async function orderDay(trip, day, theme = '') {
  const tl = timelineOf(getState(), trip, day);
  const set = tl.settings;
  const parts = tl.zones.filter((z) => z.stops.length);
  if (!parts.length) return { aiUsed: true, summary: '' };
  const results = await Promise.all(parts.map((z) => (z.stops.length < 2
    ? { stops: z.stops.map((s) => ({ id: s.id, order: 1, stay: s.stay, meal: s.meal, reason: '' })), summary: '', aiUsed: true }
    : planDayAI({ day, settings: { ...set, start: z.start, end: z.end, startTime: z.startTime, endTime: z.endTime }, stops: z.stops }))));
  let n = 0;
  actions.setDayStops(results.flatMap((r) => [...r.stops].sort((a, b) => a.order - b.order)
    .map((s) => ({ id: s.id, planOrder: ++n, planStay: s.stay, planMeal: s.meal, planReason: s.reason }))));
  const summary = [theme && `📍 ${theme}`, ...results.map((r) => [r.summary, r.gapTip && `💡 ${r.gapTip}`].filter(Boolean).join('\n'))].filter(Boolean).join('\n');
  actions.updatePlanDay(trip.id, day, { summary, plannedAt: new Date().toISOString() });
  return { aiUsed: results.every((r) => r.aiUsed), summary: results.find((r) => !r.aiUsed)?.summary || '' };
}

/** Write the preview into the plan, then sort every changed day. onProgress(done, total). */
export async function applyTripPlan(trip, plan, mode, onProgress) {
  const st = getState();
  const changed = plan.days.filter((d) => d.stops.some((x) => !x.extra || x.on)).map((d) => d.day);
  if (mode === 'all') {
    // Start over: everything planned on the trip's days goes back to 待安排 first.
    ofTrip(st.saves, trip).filter((s) => s.inPlan && s.planDay).forEach((s) => actions.addToPlan(s.id, ''));
  }
  plan.days.forEach((d) => d.stops.forEach((x) => {
    if (x.extra) {
      if (!x.on || !x.place) return;
      const p = x.place;
      actions.addSaves(trip.id, [{
        title: p.name, nameLocal: p.nameLocal, region: p.city, area: p.area, country: countryOf(p.city), category: p.category || 'place',
        subtype: p.subtype, note: p.tip, lat: p.lat, lng: p.lng, address: p.address, geo: p.geo, placeUrl: p.placeUrl,
        platform: 'AI 推荐', url: '', verdict: 'recommend', ai: true, unsure: false,
      }]);
      const saved = ofTrip(getState().saves, trip).find((s) => norm(s.title) === norm(p.name));
      if (saved) actions.addToPlan(saved.id, d.day);
    } else {
      actions.addToPlan(x.id, d.day);
    }
  }));
  let done = 0;
  for (const day of changed) {
    onProgress?.(done, changed.length);
    try { await orderDay(trip, day, plan.days.find((d) => d.day === day)?.theme); } catch { /* keep the AI's grouping even if ordering failed */ }
    done += 1;
  }
  onProgress?.(done, changed.length);
  return changed.length;
}
