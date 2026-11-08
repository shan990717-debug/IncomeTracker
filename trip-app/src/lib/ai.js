import { supabase } from './supabase';
import { CATEGORIES, detectPlatform } from './parse';
import { UNSORTED, REGIONS } from './regions';

/*
 * Reads one shared post (link + caption, and/or screenshots) and returns the
 * places it recommends, each with category, 种类, city/area and coordinates.
 * The AI and map lookups run server-side in /api/extract (keys never reach
 * the browser). Any failure throws, and the caller keeps the keyword guess.
 */

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

/** Public oEmbed for a title/cover where browsers may call it directly. IG/小红书 have none. */
function oembedUrl(url) {
  if (/tiktok\.com/i.test(url)) return `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
  if (/youtube\.com|youtu\.be/i.test(url)) return `https://noembed.com/embed?url=${encodeURIComponent(url)}`;
  return null;
}

async function fetchPreview(url) {
  const api = url && oembedUrl(url);
  if (!api) return null;
  try {
    const res = await withTimeout(fetch(api), 4000);
    if (!res.ok) return null;
    const j = await res.json();
    return j.error ? null : { title: j.title || '', thumbnail: j.thumbnail_url || '' };
  } catch {
    return null;
  }
}

/** Shrink a screenshot: long side 1600px JPEG keeps text legible and the request small. */
async function toBase64Jpeg(file) {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
  const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(bmp.width * scale), height: Math.round(bmp.height * scale) });
  canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL('image/jpeg', 0.82).split(',')[1];
}

async function authHeader() {
  const token = supabase ? (await supabase.auth.getSession()).data.session?.access_token : null;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function post(path, body, ms = 90000) {
  const res = await withTimeout(fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeader()) },
    body: JSON.stringify(body),
  }), ms);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `出错了（${res.status}）`);
  return res.json();
}

const callExtract = (body) => post('/api/extract', body);

function matchRegion(name, tripRegions) {
  const n = (name || '').trim();
  if (!n) return UNSORTED;
  const hit = tripRegions.find((r) => r === n || r.includes(n) || n.includes(r.replace(/岛$/, '')));
  if (hit) return hit;
  return REGIONS.find((r) => r.keywords.some((k) => n.toLowerCase().includes(k.toLowerCase())))?.name || n;
}

/** @returns {Promise<{ places: object[], tips: object[], post: object|null }>} drafts + what the link gave us */
export async function aiExtract({ text = '', url = '', images = [], tripRegions }) {
  const [preview, b64] = await Promise.all([fetchPreview(url), Promise.all(images.slice(0, 4).map(toBase64Jpeg))]);
  const out = await callExtract({
    text: text.slice(0, 4000), url, regions: tripRegions,
    images: b64.map((data) => ({ media_type: 'image/jpeg', data })),
  });
  const platform = detectPlatform(`${url} ${text}`) || (images.length ? '截图' : '');
  const cats = new Set(CATEGORIES.map((c) => c.id));

  const places = (Array.isArray(out?.places) ? out.places : [])
    .filter((p) => p?.name && (p.confidence ?? 1) >= 0.35)
    .map((p) => ({
      url,
      platform,
      thumbnail: out.post?.cover || preview?.thumbnail || '',
      title: p.name.trim().slice(0, 60),
      nameLocal: (p.name_local || '').trim(),
      country: p.country || '',
      region: matchRegion(p.city, tripRegions),
      area: (p.area || '').trim(),
      category: cats.has(p.category) ? p.category : 'place',
      subtype: p.subtype || '',
      address: (p.address || '').trim(),
      note: (p.tip || '').trim(),
      lat: Number.isFinite(p.lat) ? p.lat : null,
      lng: Number.isFinite(p.lng) ? p.lng : null,
      geo: p.geo || '',
      placeUrl: p.place_url || '',
      verdict: p.verdict === 'avoid' ? 'avoid' : 'recommend',
      verdictReason: p.verdict_reason || '',
      ai: true,
      unsure: (p.confidence ?? 1) < 0.6,
    }));

  // Every 须知 remembers which post it came from.
  const source = url ? [{ url, key: out?.post?.postKey || '', platform, title: (out?.post?.title || text.split('\n')[0] || '').replace(/https?:\S+/g, '').trim().slice(0, 40) }] : [];
  const tips = (Array.isArray(out?.tips) ? out.tips : []).map((t) => ({
    title: t.title,
    type: t.type,
    points: t.points || [],
    country: t.country || '',
    cities: (t.cities || []).map((c) => matchRegion(c, tripRegions)),
    needsAllCities: !!t.needs_all_cities,
    nationalities: t.nationalities || [],
    isAction: t.is_action !== false,
    personal: !!t.personal,
    offsetDays: Number.isFinite(t.offset_days) ? t.offset_days : null,
    offsetFromPost: !!t.offset_from_post,
    sources: source,
  }));

  // post: whether the server could open the link and read the full post (shown in 收集).
  return { places, tips, post: out?.post || null };
}

/** Which post a share link points to (follows 小红书 short links). No AI is used. */
export async function resolvePost(url) {
  const { postKey } = await post('/api/extract', { resolveOnly: true, url }, 9000);
  return postKey || '';
}

/** Find a saved place on Kakao / OpenStreetMap (e.g. after fixing its name). */
export async function locatePlace(save, query = '') {
  const { place } = await post('/api/locate', {
    mode: 'place', name: save.title, nameLocal: save.nameLocal, query, area: save.area, region: save.region, country: save.country,
  }, 30000);
  return place;
}

/** Search points to measure distance from (hotel, station…). */
export async function searchPoints(query, korea) {
  const { results } = await post('/api/locate', { mode: 'search', query, korea }, 30000);
  return results || [];
}

/** Ask /api/plan to order one day's stops. Returns { stops:[{id,order,stay,meal,reason}], legs, summary, gapTip, aiUsed }. */
export async function planDayAI({ day, settings, stops }) {
  const pt = (p) => (p ? { name: p.name, lat: p.lat, lng: p.lng } : null);
  return post('/api/plan', {
    day,
    start: pt(settings.start),
    end: pt(settings.end),
    startTime: settings.startTime,
    endTime: settings.endTime,
    lunch: settings.lunch,
    dinner: settings.dinner,
    stops: stops.map((s) => ({
      id: s.id, title: s.nameLocal ? `${s.title}（${s.nameLocal}）` : s.title, category: s.category, subtype: s.subtype,
      area: s.area || s.region, note: s.note, lat: s.lat, lng: s.lng,
    })),
  }, 70000);
}
