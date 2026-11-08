import { hasCoords } from './geo';

/*
 * Real public-transport times in Korea from ODsay (lab.odsay.com), used
 * instead of the straight-line estimate when a key is set (VITE_ODSAY_KEY,
 * a "Web" key limited to this site's address). Results are cached on the
 * phone for 30 days, so each leg is asked once.
 *
 *   lookupLeg(a, b) → { minutes, route: ['2号线', '3号线'…], fare } | null   (sync, cache only)
 *   fetchLegs([[a, b]…]) → asks ODsay for the ones not cached yet
 */

const KEY = import.meta.env.VITE_ODSAY_KEY || '';
export const transitEnabled = !!KEY;
const CACHE = 'tripaa_odsay_v1';
const DAY = 864e5;
let cache = null;
const load = () => {
  if (cache) return cache;
  try { cache = JSON.parse(localStorage.getItem(CACHE) || '{}'); } catch { cache = {}; }
  return cache;
};
const persist = () => { try { localStorage.setItem(CACHE, JSON.stringify(cache)); } catch { /* full: keep in memory */ } };
const r4 = (x) => Math.round(x * 1e4) / 1e4;
const keyOf = (a, b) => `${r4(a.lat)},${r4(a.lng)}>${r4(b.lat)},${r4(b.lng)}`;
const inKorea = (p) => p.lat > 33 && p.lat < 38.7 && p.lng > 124.5 && p.lng < 131;

export function lookupLeg(a, b) {
  if (!KEY || !hasCoords(a) || !hasCoords(b)) return null;
  const hit = load()[keyOf(a, b)];
  return hit && hit.v && Date.now() - hit.t < 30 * DAY ? hit.v : null;
}

/** Turn one ODsay path into what the timeline shows. */
function summarise(path) {
  const route = [];
  (path.subPath || []).forEach((sp) => {
    if (sp.trafficType === 1) route.push((sp.lane?.[0]?.name || '地铁').replace(/^(수도권|부산|대구|광주|대전)\s*/, '').replace(/(\d+)호선/, '$1号线'));
    if (sp.trafficType === 2) route.push(`公交 ${sp.lane?.[0]?.busNo || ''}`.trim());
  });
  return { minutes: path.info.totalTime, route, fare: path.info.payment || null };
}

const inflight = new Map();
async function ask(a, b) {
  const k = keyOf(a, b);
  if (inflight.has(k)) return inflight.get(k);
  const p = (async () => {
    const url = `https://api.odsay.com/v1/api/searchPubTransPathT?SX=${a.lng}&SY=${a.lat}&EX=${b.lng}&EY=${b.lat}&apiKey=${encodeURIComponent(KEY)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    const j = await res.json();
    // Too close for transit (≈700 m) or no route: remember that, the estimate stays.
    const best = j?.result?.path?.slice().sort((x, y) => x.info.totalTime - y.info.totalTime)[0];
    load()[k] = { t: Date.now(), v: best ? summarise(best) : null };
    persist();
  })().catch(() => { /* offline / quota: try again next time */ }).finally(() => inflight.delete(k));
  inflight.set(k, p);
  return p;
}

/** Fetch the legs we don't have yet (a few at a time). Resolves when done. */
export async function fetchLegs(pairs) {
  if (!KEY) return 0;
  const todo = pairs.filter(([a, b]) => hasCoords(a) && hasCoords(b) && inKorea(a) && inKorea(b) && !(keyOf(a, b) in load()));
  for (let i = 0; i < todo.length; i += 3) await Promise.all(todo.slice(i, i + 3).map(([a, b]) => ask(a, b)));
  return todo.length;
}
