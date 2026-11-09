import { actions, getState, ofTrip, norm } from './store';
import { planDayAI, planTripAI, fetchMustList, readReference } from './ai';
import { daysOf, dayTitle, stopsOf, timelineOf, daySettings, encodeFixed, fixedTime } from './plan';
import { toMin } from '../../server/schedule.js';
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

/**
 * The same place collected from several posts (「63 SkyPicnic」「63 Sky Picnic」「星巴克 63 SkyPicnic」):
 * one name contains the other and they're close by (or in the same area) → keep one, the one planned / rated first.
 */
export function dedupe(list) {
  const out = [];
  const n = (x) => norm(x).replace(/[^\p{L}\p{N}]/gu, '');
  const same = (a, b) => {
    const pairs = [[n(a.title), n(b.title)], [n(a.nameLocal), n(b.nameLocal)]].filter(([x, y]) => x.length >= 3 && y.length >= 3);
    if (!pairs.some(([x, y]) => x.includes(y) || y.includes(x))) return false;
    const d = km(a, b);
    return d != null ? d < 0.3 : (a.area || a.region) === (b.area || b.region);
  };
  const score = (s) => (s.inPlan ? 2 : 0) + (s.rating ? 1 : 0) + (hasCoords(s) ? 1 : 0);
  [...list].sort((a, b) => score(b) - score(a)).forEach((s) => { if (!out.some((o) => same(o, s))) out.push(s); });
  return out;
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

export function buildTripInput(trip, { mode, pace, prefs, days: picked = [], refIds = null }) {
  const st = getState();
  const saves = ofTrip(st.saves, trip).filter((s) => s.verdict !== 'avoid');
  const all = daysOf(trip);
  // keep: days that already have stops stay as they are. pick: only the chosen days are planned.
  const locked = mode === 'keep' ? new Set(all.filter((d) => stopsOf(st, trip, d).some((x) => !fixedTime(x))))
    : mode === 'pick' ? new Set(all.filter((d) => !picked.includes(d))) : new Set();
  const skipped = [];
  const days = all.filter((d) => !locked.has(d)).map((d) => {
    const set = daySettings(st, trip, d);
    // No usable time (landing late at night, leaving for the airport at dawn): don't plan this day at all.
    if (toMin(set.endTime) - toMin(set.startTime) < 60) {
      skipped.push({ day: d, why: set.bookings.arrival ? `${set.bookings.arrival.number || '航班'} ${set.bookings.arrival.endTime} 才落地` : set.bookings.departure ? `${set.startTime} 就要去机场` : '这天没有空的时间' });
      return null;
    }
    const fixed = set.bookings.fixed;
    const from = cityNear(set.start, saves);
    const to = fixed.length ? cityNear(fixed.at(-1).after, saves) || cityNear(set.end, saves) : '';
    return {
      day: d, label: dayTitle(trip, d),
      city: to && to !== from ? `${from || '?'}→${to}` : from,
      base: set.bookings.sleepAt?.title || set.start?.name || '',
      hours: `${set.startTime}-${set.endTime}`,
      note: [set.bookings.arrival && '当天落地', set.bookings.departure && '当天回程', ...fixed.map((f) => `${f.title} ${f.fixed}`),
        // The user's fixed-time plans stay on their day; the AI plans around them.
        ...stopsOf(st, trip, d).filter((x) => fixedTime(x)).map((x) => `已有固定安排：${x.title} ${fixedTime(x).time}`)].filter(Boolean).join('；'),
    };
  }).filter(Boolean);
  const usable = dedupe(saves.filter((s) => !(s.inPlan && locked.has(s.planDay)) && !(s.inPlan && fixedTime(s))));
  const places = usable.map((s) => ({ id: s.id, title: s.title, city: s.region, area: s.area, kind: kind(s, CAT[s.category]), note: s.note }));
  // 必去推荐 not already in 攻略库, from every list this trip has.
  const have = new Set(saves.flatMap((s) => [norm(s.title), norm(s.nameLocal)]).filter(Boolean));
  const seen = new Set();
  const extras = [];
  // 参考攻略 first (someone already chose these), then 必去推荐.
  const refs = referencesOf(st, trip).filter((r) => !refIds || refIds.includes(r.city));
  refs.forEach((r) => (r.data.days || []).forEach((d) => (d.places || []).forEach((p) => {
    const k = `${p.city || ''}:${p.name}`;
    if (seen.has(k) || have.has(norm(p.name)) || (p.nameLocal && have.has(norm(p.nameLocal)))) return;
    seen.add(k);
    extras.push({ id: `ref:${k}`, title: p.name, city: p.city, area: p.area || d.theme, kind: CAT[p.category] || '', note: p.tip, place: p, fromRef: r.data.title });
  })));
  st.mustLists.filter((m) => m.tripId === trip.id && !m.city.startsWith('ref:')).forEach((m) => {
    const city = m.city.split('|')[0];
    (m.data?.places || []).forEach((p) => {
      const k = `${city}:${p.name}`;
      if (seen.has(k) || have.has(norm(p.name)) || (p.nameLocal && have.has(norm(p.nameLocal)))) return;
      seen.add(k);
      extras.push({ id: `must:${k}`, title: p.name, city, area: p.area, kind: kind(p, CAT[p.category]), note: p.tip, place: { ...p, city } });
    });
  });
  // A short outline of each 参考攻略 for the AI to learn the grouping and order from.
  const references = refs.map((r) => `《${r.data.title}》\n${(r.data.days || []).map((d, i) => `D${i + 1} ${d.theme}：${(d.places || []).map((p) => p.name).join(' → ')}`).join('\n')}`).join('\n\n');
  return { days, places, extras, pace, prefs, locked: [...locked], skipped, references };
}

export async function planTrip(trip, opts) {
  await ensureMustLists(trip, opts.prefs);
  const input = buildTripInput(trip, opts);
  if (!input.days.length) throw new Error(opts.mode === 'pick' ? '先选要排哪几天' : '每一天都已经排好了；要重排请选「全部重排」或「选几天」');
  const out = await planTripAI({ days: input.days, places: input.places, extras: input.extras.map(({ place, ...x }) => x), pace: input.pace, prefs: input.prefs, wishes: opts.wishes || '', references: input.references }); // eslint-disable-line no-unused-vars
  const eventByKey = new Map((out.events || []).map((e) => [e.key, e]));
  const extraById = new Map(input.extras.map((x) => [x.id, x]));
  const saveById = new Map(getState().saves.map((s) => [s.id, s]));
  return {
    summary: out.summary,
    picked: opts.mode === 'pick' ? opts.days : null,
    locked: input.locked,
    skipped: input.skipped,
    days: out.days.map((d) => ({
      ...d,
      stops: d.stops.map((x) => (x.event
        ? { id: x.id, event: true, title: eventByKey.get(x.id)?.title || '', area: eventByKey.get(x.id)?.place?.name || '', ev: eventByKey.get(x.id), on: true }
        : x.extra
        ? { id: x.id, extra: true, title: extraById.get(x.id)?.title || '', area: extraById.get(x.id)?.area || '', place: extraById.get(x.id)?.place, fromRef: extraById.get(x.id)?.fromRef || '', on: true }
        : { id: x.id, title: saveById.get(x.id)?.title || '', area: saveById.get(x.id)?.area || '', category: saveById.get(x.id)?.category })).filter((x) => x.title),
    })),
    todos: (out.todos || []).map((t) => ({ ...t, on: true })),
    unassigned: input.places.filter((p) => !out.days.some((d) => d.stops.some((x) => x.id === p.id))).length,
  };
}

/** Order one day's stops with AI (each stretch around a train / flight on its own). */
export async function orderDay(trip, day, theme = '') {
  const tl = timelineOf(getState(), trip, day);
  const set = tl.settings;
  if (!tl.zones.some((z) => z.stops.length)) return { aiUsed: true, summary: '' };
  const results = await Promise.all(tl.zones.map((z) => (z.stops.length < 2
    ? { stops: z.stops.map((s) => ({ id: s.id, order: 1, stay: s.stay, meal: s.meal, reason: '' })), summary: '', aiUsed: true }
    : planDayAI({ day, settings: { ...set, start: z.start, end: z.end, startTime: z.startTime, endTime: z.endTime }, stops: z.stops }))));
  // Number the whole day in order, the user's fixed-time plans included, so each stop stays on its side of them.
  let n = 0;
  actions.setDayStops(results.flatMap((r, i) => [
    ...[...r.stops].sort((a, b) => a.order - b.order).map((s) => ({ id: s.id, planOrder: ++n, planStay: s.stay, planMeal: s.meal, planReason: s.reason })),
    ...(tl.zones[i].fixed?.kind === 'event' ? [{ id: tl.zones[i].fixed.id, planOrder: ++n }] : []),
  ]));
  const summary = [theme && `📍 ${theme}`, ...results.map((r) => [r.summary, r.gapTip && `💡 ${r.gapTip}`].filter(Boolean).join('\n'))].filter(Boolean).join('\n');
  actions.updatePlanDay(trip.id, day, { summary, plannedAt: new Date().toISOString() });
  return { aiUsed: results.every((r) => r.aiUsed), summary: results.find((r) => !r.aiUsed)?.summary || '' };
}

/** Write the preview into the plan, then sort every changed day. onProgress(done, total). */
export async function applyTripPlan(trip, plan, mode, onProgress) {
  const st = getState();
  const changed = plan.days.filter((d) => d.stops.some((x) => !x.extra || x.on)).map((d) => d.day);
  if (mode === 'all' || mode === 'pick') {
    // Start over on the days being planned: their stops go back to 待安排 first (fixed-time plans stay).
    const redo = (d) => mode === 'all' || (plan.picked || []).includes(d);
    ofTrip(st.saves, trip).filter((s) => s.inPlan && s.planDay && redo(s.planDay) && !fixedTime(s)).forEach((s) => actions.addToPlan(s.id, ''));
  }
  const city = (day) => cityNear(daySettings(getState(), trip, day).start, ofTrip(getState().saves, trip)) || trip.regions[0] || '';
  plan.days.forEach((d) => d.stops.forEach((x) => {
    if (x.event) {
      // The user's own plan (倒数, 滑雪…): a card in 攻略库 with a fixed time on its day.
      const e = x.ev;
      if (!x.on || !e) return;
      const id = actions.addPlanEvent(trip.id, {
        title: e.title, category: e.category, note: e.note, region: city(d.day), area: e.place?.name || '',
        lat: e.place?.lat ?? null, lng: e.place?.lng ?? null, address: e.place?.address || '', geo: e.place?.geo || '', placeUrl: e.place?.placeUrl || '',
      }, d.day, { planTime: encodeFixed(e.start, e.includesTravel), planStay: e.stay });
      return id;
    }
    if (x.extra) {
      if (!x.on || !x.place) return;
      const p = x.place;
      actions.addSaves(trip.id, [{
        title: p.name, nameLocal: p.nameLocal, region: p.city, area: p.area, country: countryOf(p.city), category: p.category || 'place',
        subtype: p.subtype, note: p.tip, lat: p.lat, lng: p.lng, address: p.address, geo: p.geo, placeUrl: p.placeUrl,
        platform: x.fromRef ? '参考攻略' : 'AI 推荐', url: '', verdict: 'recommend', ai: true, unsure: false,
      }]);
      const saved = ofTrip(getState().saves, trip).find((s) => norm(s.title) === norm(p.name));
      if (saved) actions.addToPlan(saved.id, d.day);
    } else {
      actions.addToPlan(x.id, d.day);
    }
  }));
  const todos = (plan.todos || []).filter((t) => t.on);
  if (todos.length) actions.addTips(trip.id, todos.map((t) => ({ title: t.title, type: 'booking', points: t.points, offsetDays: t.offsetDays, isAction: true })));
  let done = 0;
  for (const day of changed) {
    onProgress?.(done, changed.length);
    try { await orderDay(trip, day, plan.days.find((d) => d.day === day)?.theme); } catch { /* keep the AI's grouping even if ordering failed */ }
    done += 1;
  }
  onProgress?.(done, changed.length);
  return changed.length;
}

export const referencesOf = (st, trip) => st.mustLists.filter((m) => m.tripId === trip.id && m.city.startsWith('ref:'));

/** Read a 参考攻略 and keep it for the trip (shared); its 须知 go into 须知. */
export async function addReference(trip, { text, images }) {
  const r = await readReference({ text, images, regions: trip.regions });
  if (!r.days?.length) throw new Error('没读到行程，换几张清楚一点的截图试试');
  actions.setMustList(trip.id, `ref:${Date.now().toString(36)}`, { kind: 'ref', ...r, addedAt: Date.now() });
  if (r.tips?.length) actions.addTips(trip.id, r.tips.map((t) => ({ ...t, sources: r.source?.url ? [r.source] : [] })));
  return r;
}
