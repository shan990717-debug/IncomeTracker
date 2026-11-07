import { base44 } from '@/api/base44Client';
import { CATEGORIES, detectPlatform } from './parse';
import { UNSORTED, REGIONS } from './regions';

/*
 * AI reading of a shared post. The keyword parser in parse.js gives an instant
 * first guess; this replaces it with what the post is actually about:
 *   1. best-effort link preview (title / caption / cover) via public oEmbed,
 *   2. Base44's InvokeLLM with web search, so it can look the post or the
 *      place up and return real names (incl. Korean), area and category,
 *      one entry per place — a "top 5 cafés" video becomes 5 saves.
 * Any failure falls back silently to the keyword result.
 */

const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

/** Public oEmbed endpoints that browsers can call directly. Instagram/小红书 have none without keys. */
function oembedUrl(url) {
  if (/tiktok\.com/i.test(url)) return `https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`;
  if (/youtube\.com|youtu\.be/i.test(url)) return `https://noembed.com/embed?url=${encodeURIComponent(url)}`;
  return null;
}

export async function fetchPreview(url) {
  const api = url && oembedUrl(url);
  if (!api) return null;
  try {
    const res = await withTimeout(fetch(api), 4000);
    if (!res.ok) return null;
    const j = await res.json();
    if (j.error) return null;
    return { title: j.title || '', author: j.author_name || '', thumbnail: j.thumbnail_url || '' };
  } catch {
    return null; // CORS / blocked / offline → AI works from the pasted text alone
  }
}

const SCHEMA = {
  type: 'object',
  properties: {
    places: {
      type: 'array',
      description: 'Every distinct place, restaurant, shop or activity the post recommends. Empty if none.',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '简体中文名称，没有中文名就用原名' },
          name_local: { type: 'string', description: 'Name in the local language (Korean for Korea), as on Naver/Kakao Map. Empty if unknown.' },
          region: { type: 'string', description: 'City/region name in 简体中文' },
          area: { type: 'string', description: 'Neighbourhood/district in 简体中文, e.g. 弘大, 圣水, 海云台' },
          category: { type: 'string', enum: CATEGORIES.map((c) => c.id) },
          address: { type: 'string', description: 'Street address if found, else empty' },
          tip: { type: 'string', description: '一句话：推荐菜/亮点/注意事项（简体中文，30字内）' },
          confidence: { type: 'number', description: '0-1, how sure you are this place is real and correctly identified' },
        },
        required: ['name', 'region', 'category', 'confidence'],
      },
    },
  },
  required: ['places'],
};

function buildPrompt({ text, url, preview, regions }) {
  const known = REGIONS.map((r) => `${r.name}（商圈：${r.areas.map((a) => a.name).join('、') || '—'}）`).join('\n');
  return `你在帮用户把社交媒体上看到的旅行推荐整理成收藏清单。

用户这次旅行的地区：${regions.join('、')}
已知地区和商圈写法（region/area 请尽量用这些写法）：
${known}

用户贴上的分享内容：
"""
${text.slice(0, 2000)}
"""
${url ? `链接：${url}` : ''}
${preview?.title ? `链接预览标题/文案：${preview.title}${preview.author ? `（作者 ${preview.author}）` : ''}` : ''}

任务：
- 找出这则内容推荐的每一个具体地点（餐厅、咖啡厅、景点、店铺、体验活动）。一则影片介绍多家店就分别列出。
- 文案没写店名时，可以上网搜索这个链接或文案关键字来确认是哪家店；确认不了就不要编造，返回空数组或低 confidence。
- category：food=吃喝（含咖啡甜点）、place=景点打卡、experience=体验活动（韩服、汗蒸、小火车、课程…）、shopping=购物。
- region 必须是城市/地区名，例如 首尔、釜山、济州岛；area 是商圈，例如 圣水、海云台。
- 所有中文用简体。`;
}

/** Normalise model output into save drafts. */
function toDrafts(result, { url, platform, preview, tripRegions }) {
  const places = Array.isArray(result?.places) ? result.places : [];
  const cats = new Set(CATEGORIES.map((c) => c.id));
  return places
    .filter((p) => p?.name && (p.confidence ?? 1) >= 0.35)
    .map((p) => {
      const region = matchRegion(p.region, tripRegions);
      return {
        url,
        platform,
        thumbnail: preview?.thumbnail || '',
        title: p.name.trim().slice(0, 60),
        nameLocal: (p.name_local || '').trim(),
        region,
        area: (p.area || '').trim(),
        category: cats.has(p.category) ? p.category : 'place',
        address: (p.address || '').trim(),
        note: (p.tip || '').trim(),
        ai: true,
        aiConfidence: p.confidence ?? null,
      };
    });
}

/** Map the model's free-text region onto the trip's regions (济州 → 济州岛 etc.). */
function matchRegion(name, tripRegions) {
  const n = (name || '').trim();
  if (!n) return UNSORTED;
  const exact = tripRegions.find((r) => r === n);
  if (exact) return exact;
  const loose = tripRegions.find((r) => r.includes(n) || n.includes(r.replace(/岛$/, '')));
  if (loose) return loose;
  const known = REGIONS.find((r) => r.keywords.some((k) => n.toLowerCase().includes(k.toLowerCase())));
  return known?.name || n; // a city outside the trip is kept as-is; user can re-file it
}

/**
 * Read one shared snippet with AI. Resolves to an array of drafts (possibly
 * several places), or throws so the caller can keep the keyword result.
 */
export async function aiExtract({ text, url, tripRegions }) {
  const preview = await fetchPreview(url);
  const platform = detectPlatform(`${url} ${text}`);
  const result = await withTimeout(
    base44.integrations.Core.InvokeLLM({
      prompt: buildPrompt({ text, url, preview, regions: tripRegions }),
      add_context_from_internet: true,
      response_json_schema: SCHEMA,
    }),
    45000,
  );
  const parsed = typeof result === 'string' ? safeJSON(result) : result;
  return { drafts: toDrafts(parsed, { url, platform, preview, tripRegions }), preview };
}

function safeJSON(s) {
  try {
    return JSON.parse(s.replace(/^```(?:json)?|```$/g, '').trim());
  } catch {
    return null;
  }
}

