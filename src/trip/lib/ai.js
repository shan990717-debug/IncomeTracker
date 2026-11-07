import { base44 } from '@/api/base44Client';
import { CATEGORIES, detectPlatform, parseShare } from './parse';
import { UNSORTED, REGIONS } from './regions';
import { TASK_GROUPS } from './prep';

/*
 * Reads one shared post (link + caption, and/or screenshots) and splits it in two:
 *   places → 攻略库 (吃 / 去 / 玩 / 买)
 *   tasks  → 出发准备 (交通卡、入境、eSIM、提前预订…)
 * Text-only posts use web search so the model can look the post/place up;
 * screenshots are read as images (小红书 puts most of the info in the pictures).
 * Any failure throws, and the caller keeps the instant keyword guess.
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

/** Shrink a screenshot before upload: long side 1600px JPEG keeps text legible and uploads fast. */
async function shrink(file) {
  try {
    const bmp = await createImageBitmap(file);
    const scale = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const canvas = Object.assign(document.createElement('canvas'), { width: Math.round(bmp.width * scale), height: Math.round(bmp.height * scale) });
    canvas.getContext('2d').drawImage(bmp, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise((r) => canvas.toBlob(r, 'image/jpeg', 0.85));
    return blob ? new File([blob], 'shot.jpg', { type: 'image/jpeg' }) : file;
  } catch {
    return file;
  }
}

async function upload(files) {
  const urls = [];
  for (const f of files.slice(0, 6)) {
    const { file_url } = await base44.integrations.Core.UploadFile({ file: await shrink(f) });
    urls.push(file_url);
  }
  return urls;
}

const SCHEMA = {
  type: 'object',
  properties: {
    places: {
      type: 'array',
      description: 'Every distinct restaurant, café, sight, shop or activity the post recommends.',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string', description: '简体中文名称；没有中文名就用原名' },
          name_local: { type: 'string', description: 'Name in Korean (or local language) as on Naver/Kakao Map; empty if unknown' },
          region: { type: 'string', description: '城市，简体中文，例如 首尔 / 釜山 / 济州岛' },
          area: { type: 'string', description: '商圈，简体中文，例如 弘大 / 圣水 / 海云台' },
          category: { type: 'string', enum: CATEGORIES.map((c) => c.id) },
          address: { type: 'string' },
          tip: { type: 'string', description: '一句话重点：推荐菜/亮点/营业时间/注意（简体中文，30字内）' },
          confidence: { type: 'number', description: '0-1' },
        },
        required: ['name', 'region', 'category', 'confidence'],
      },
    },
    tasks: {
      type: 'array',
      description: 'Things to prepare or book BEFORE/at the start of the trip mentioned in the post (transport cards, entry forms, eSIM, advance bookings, apps, money). Not sightseeing.',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: '要做的事，动词开头，简体中文，例如「买 WOWPASS 卡」「提前订天空胶囊小火车」' },
          group: { type: 'string', enum: TASK_GROUPS.map((g) => g.id) },
          offset_days: { type: 'number', description: 'When to do it relative to departure: -30 = 30 days before, -3 = 3 days before, 0 = on arrival/departure day' },
          note: { type: 'string', description: '帖子里的具体建议，例如价格、在哪买、注意事项（简体中文，60字内）' },
        },
        required: ['title', 'group', 'offset_days'],
      },
    },
  },
  required: ['places', 'tasks'],
};

function buildPrompt({ text, url, preview, regions, hasImages }) {
  const known = REGIONS.map((r) => `${r.name}（${r.areas.map((a) => a.name).join('、') || '—'}）`).join('；');
  return `你在帮一群朋友把 Instagram / 小红书 上收藏的旅行攻略整理好。
旅行地区：${regions.join('、')}
地区与商圈的标准写法：${known}

${hasImages ? '附件是帖子的截图，请仔细读图片里的文字。' : ''}
${text ? `帖子文字：\n"""\n${text.slice(0, 2500)}\n"""` : ''}
${url ? `链接：${url}` : ''}
${preview?.title ? `链接标题：${preview.title}` : ''}

请把内容拆成两类：
1. places：帖子推荐的每一个具体地点（餐厅、咖啡厅、景点、店铺、体验）。一篇介绍多家就分别列出。
   category：food=吃喝（含咖啡甜点），place=景点打卡，experience=体验活动（韩服、汗蒸、小火车、课程等），shopping=购物。
   ${hasImages ? '' : '文字没写店名时可以上网搜索链接或关键字确认；'}确认不了就不要编造。
2. tasks：帖子提到的「出发前或刚到时要准备/预订的事」，例如交通卡、入境卡/K-ETA、eSIM、提前订票订位、换钱、要下载的 App。
   单纯的景点介绍不要放进 tasks。没有就返回空数组。
所有中文用简体。`;
}

function matchRegion(name, tripRegions) {
  const n = (name || '').trim();
  if (!n) return UNSORTED;
  const hit = tripRegions.find((r) => r === n || r.includes(n) || n.includes(r.replace(/岛$/, '')));
  if (hit) return hit;
  return REGIONS.find((r) => r.keywords.some((k) => n.toLowerCase().includes(k.toLowerCase())))?.name || n;
}

function safeJSON(s) {
  try {
    return JSON.parse(String(s).replace(/^```(?:json)?|```$/g, '').trim());
  } catch {
    return null;
  }
}

/**
 * @returns {Promise<{ places: object[], tasks: object[] }>}
 *   places are save drafts; tasks carry `offset` (days vs departure) to turn into due dates.
 */
export async function aiExtract({ text = '', url = '', images = [], tripRegions }) {
  const [preview, fileUrls] = await Promise.all([fetchPreview(url), images.length ? upload(images) : []]);
  const res = await withTimeout(
    base44.integrations.Core.InvokeLLM({
      prompt: buildPrompt({ text, url, preview, regions: tripRegions, hasImages: fileUrls.length > 0 }),
      // The API can't combine web search with attachments; screenshots carry the info anyway.
      ...(fileUrls.length ? { file_urls: fileUrls } : { add_context_from_internet: true }),
      response_json_schema: SCHEMA,
    }),
    60000,
  );
  const out = typeof res === 'string' ? safeJSON(res) : res;
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
