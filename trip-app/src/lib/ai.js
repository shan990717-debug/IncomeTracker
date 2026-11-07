import { supabase } from './supabase';
import { CATEGORIES, detectPlatform, parseShare } from './parse';
import { UNSORTED, REGIONS } from './regions';
import { TASK_GROUPS } from './prep';

/*
 * Reads one shared post (link + caption, and/or screenshots) and splits it in two:
 *   places → 攻略库 (吃 / 去 / 玩 / 买)
 *   tasks  → 出发准备 (交通卡、入境、eSIM、提前预订…)
 * The model runs server-side in /api/extract (the API key never reaches the
 * browser). Any failure throws, and the caller keeps the keyword guess.
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

async function callExtract(body) {
  const token = supabase ? (await supabase.auth.getSession()).data.session?.access_token : null;
  const res = await withTimeout(fetch('/api/extract', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  }), 90000);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || `AI ${res.status}`);
  return res.json();
}

function matchRegion(name, tripRegions) {
  const n = (name || '').trim();
  if (!n) return UNSORTED;
  const hit = tripRegions.find((r) => r === n || r.includes(n) || n.includes(r.replace(/岛$/, '')));
  if (hit) return hit;
  return REGIONS.find((r) => r.keywords.some((k) => n.toLowerCase().includes(k.toLowerCase())))?.name || n;
}

/**
 * @returns {Promise<{ places: object[], tasks: object[] }>}
 *   places are save drafts; tasks carry `offset` (days vs departure) to turn into due dates.
 */
export async function aiExtract({ text = '', url = '', images = [], tripRegions }) {
  const [preview, b64] = await Promise.all([fetchPreview(url), Promise.all(images.slice(0, 4).map(toBase64Jpeg))]);
  const out = await callExtract({
    text: text.slice(0, 4000), url, previewTitle: preview?.title || '', regions: tripRegions,
    images: b64.map((data) => ({ media_type: 'image/jpeg', data })),
  });
  const platform = detectPlatform(`${url} ${text}`) || (images.length ? '截图' : '');
  const cats = new Set(CATEGORIES.map((c) => c.id));
  const groups = new Set(TASK_GROUPS.map((g) => g.id));

  const places = (Array.isArray(out?.places) ? out.places : [])
    .filter((p) => p?.name && (p.confidence ?? 1) >= 0.35)
    .map((p) => ({
      url,
      platform,
      thumbnail: preview?.thumbnail || '',
      title: p.name.trim().slice(0, 60),
      nameLocal: (p.name_local || '').trim(),
      region: matchRegion(p.region, tripRegions),
      area: (p.area || '').trim(),
      category: cats.has(p.category) ? p.category : 'place',
      address: (p.address || '').trim(),
      note: (p.tip || '').trim(),
      ai: true,
      unsure: (p.confidence ?? 1) < 0.6,
    }));

  const tasks = (Array.isArray(out?.tasks) ? out.tasks : [])
    .filter((t) => t?.title)
    .map((t) => ({
      title: t.title.trim().slice(0, 60),
      group: groups.has(t.group) ? t.group : 'other',
      offset: Number(t.offset_days),
      note: (t.note || '').trim(),
      sourceUrl: url,
      sourceTitle: (preview?.title || (text ? parseShare(text, tripRegions).title : '') || (images.length ? '截图' : '')).slice(0, 40),
    }));

  return { places, tasks };
}
