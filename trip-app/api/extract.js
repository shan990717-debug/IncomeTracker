import { locate, subtypeFromKakao } from '../server/places.js';
import { signedIn, readJson } from '../server/http.js';

/*
 * POST /api/extract — read one social-media post (caption/link and/or
 * screenshots) and return the places it recommends, each with category,
 * 种类, city/area and — when it can be found — real coordinates.
 *
 * 1. Gemini (free tier, key in GEMINI_API_KEY) reads the text/screenshots and
 *    returns JSON constrained by a schema.
 * 2. Each place is looked up on Kakao (Korea) or OpenStreetMap (elsewhere).
 */

const GEMINI = process.env.GEMINI_BASE_URL || 'https://generativelanguage.googleapis.com';
// Tried in order; set GEMINI_MODEL in Vercel to put a specific model first.
// Flash-Lite answers in ~1 s on the free tier; the full Flash models are often
// "overloaded" (503) or slow there, so they're only the fallback.
const MODELS = [...new Set([process.env.GEMINI_MODEL, 'gemini-flash-lite-latest', 'gemini-3.8-flash', 'gemini-flash-latest'].filter(Boolean))];
const PER_MODEL_MS = 20000;

const MAX_IMAGES = 4;
const MAX_IMAGE_B64 = 2_000_000;

export const SUBTYPES = {
  food: ['烤肉', '火锅', '炸鸡', '海鲜', '韩式家常', '面食', '日料', '西餐', '小吃', '咖啡甜点', '酒馆', '其他'],
  place: ['景点', '古迹', '自然风景', '夜景', '博物馆展览', '街区市场', '拍照打卡', '其他'],
  experience: ['体验', '汗蒸SPA', '乐园', '演出', '课程DIY', '其他'],
  shopping: ['美妆', '服饰', '商场百货', '市场', '文创书店', '伴手礼', '其他'],
};

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    places: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING', description: '简体中文名称；没有中文名就用原名' },
          name_local: { type: 'STRING', description: '当地语言的店名（韩国就用韩文），要和 Naver/Kakao/Google 地图上的名字一样；不知道就留空' },
          country: { type: 'STRING', description: '国家，简体中文，例如 韩国、日本' },
          city: { type: 'STRING', description: '城市，简体中文，例如 首尔、釜山、济州岛、东京' },
          area: { type: 'STRING', description: '商圈或区，简体中文，例如 弘大、圣水、海云台；不知道就留空' },
          category: { type: 'STRING', enum: ['food', 'place', 'experience', 'shopping'] },
          subtype: { type: 'STRING', description: '种类，从提示里给的清单选一个' },
          address: { type: 'STRING', description: '帖子里有写的地址；没有就留空' },
          tip: { type: 'STRING', description: '一句话重点：推荐什么、营业时间、要不要排队（简体中文，30字内）' },
          search_query: { type: 'STRING', description: '拿去地图搜索最容易找到这家店的关键字，用当地语言，例如「연남동 하하 식당」' },
          confidence: { type: 'NUMBER', description: '0-1，有多确定这家店认对了' },
        },
        required: ['name', 'city', 'category', 'subtype', 'confidence'],
      },
    },
  },
  required: ['places'],
};

function buildPrompt({ text, url, regions, imageCount }) {
  const lists = Object.entries(SUBTYPES).map(([k, v]) => `${k}: ${v.join('、')}`).join('\n');
  return `你在帮朋友整理从 Instagram / 小红书 收藏的旅行攻略，把帖子里推荐的地点一个一个找出来。
这次旅行去：${regions.join('、') || '（未指定）'}

${imageCount ? `附上 ${imageCount} 张帖子截图，请仔细读图片里的文字（店名、地址常常写在图片上）。\n` : ''}${text ? `帖子文字：\n"""\n${text}\n"""\n` : ''}${url ? `链接：${url}\n` : ''}
规则：
- 每一个具体的地点都列出来：餐厅、咖啡厅、景点、店铺、体验活动。一篇介绍好几家就分别列。
- category：food=吃喝（含咖啡甜点、酒馆），place=景点，experience=体验活动，shopping=购物。
- subtype 从下面的清单选一个最接近的：
${lists}
- 店名一定要是帖子里真的出现的。看不出店名就不要编，返回空的 places。
- 「小红书」「Instagram」这类平台名称不是店名。
- 所有中文用简体。`;
}

function validate(body) {
  const text = typeof body?.text === 'string' ? body.text.slice(0, 4000) : '';
  const url = typeof body?.url === 'string' ? body.url.slice(0, 500) : '';
  const regions = Array.isArray(body?.regions) ? body.regions.filter((r) => typeof r === 'string').slice(0, 10) : [];
  const images = (Array.isArray(body?.images) ? body.images : [])
    .filter((i) => i && i.media_type === 'image/jpeg' && typeof i.data === 'string' && i.data.length <= MAX_IMAGE_B64)
    .slice(0, MAX_IMAGES);
  if (!text && !url && !images.length) return null;
  return { text, url, regions, images };
}

async function askGemini(input) {
  const body = {
    contents: [{
      role: 'user',
      parts: [
        ...input.images.map((img) => ({ inline_data: { mime_type: img.media_type, data: img.data } })),
        { text: buildPrompt({ ...input, imageCount: input.images.length }) },
      ],
    }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: SCHEMA, temperature: 0.2 },
  };
  let lastError = '';
  for (const model of MODELS) {
    const r = await fetch(`${GEMINI}/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': process.env.GEMINI_API_KEY },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(PER_MODEL_MS),
    }).catch((e) => {
      if (e.name === 'TimeoutError') return { status: 504 }; // too slow: try the next model
      throw Object.assign(new Error('AI 连不上，再试一次'), { status: 504 });
    });
    if (r.status === 404) { lastError = `找不到模型 ${model}`; continue; } // try the next name
    if (r.status >= 500) { lastError = 'AI 现在太忙'; console.warn(`gemini ${model} ${r.status}`); continue; } // overloaded/slow: try the next model
    if (r.status === 429) throw Object.assign(new Error('AI 免费额度暂时用完了，过一分钟再试'), { status: 429 });
    if (r.status === 400 || r.status === 403) {
      const msg = (await r.json().catch(() => ({})))?.error?.message || '';
      throw Object.assign(new Error(/api key/i.test(msg) ? 'GEMINI_API_KEY 无效' : `AI 请求被拒绝：${msg.slice(0, 120)}`), { status: 500 });
    }
    if (!r.ok) throw Object.assign(new Error(`AI 出错（${r.status}）`), { status: 502 });
    const data = await r.json();
    const textOut = (data.candidates?.[0]?.content?.parts || []).map((p) => p.text || '').join('');
    try {
      return JSON.parse(textOut.replace(/^```(?:json)?|```$/g, '').trim());
    } catch {
      throw Object.assign(new Error('AI 回传的格式不对'), { status: 502 });
    }
  }
  throw Object.assign(new Error(lastError === 'AI 现在太忙' ? 'AI 现在太忙，过一下再试' : `${lastError}，请在 Vercel 设定 GEMINI_MODEL`), { status: lastError === 'AI 现在太忙' ? 503 : 500 });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: '服务器没有设定 GEMINI_API_KEY' });
  if (!(await signedIn(req))) return res.status(401).json({ error: '请先登录' });

  const input = validate(await readJson(req));
  if (!input) return res.status(400).json({ error: '没有内容可以识别' });

  try {
    const out = await askGemini(input);
    const raw = Array.isArray(out?.places) ? out.places : [];
    const keep = raw.filter((p) => p?.name && !/^(小红书|instagram|ig|tiktok|抖音)$/i.test(p.name.trim()));
    // Look places up in parallel; the OSM helper still spaces out its own calls.
    const places = await Promise.all(keep.map(async (p) => {
      const loc = await locate({
        name: p.name, nameLocal: p.name_local, query: p.search_query, area: p.area, region: p.city, country: p.country,
      });
      const subtype = (SUBTYPES[p.category] || []).includes(p.subtype) ? p.subtype : subtypeFromKakao(loc?.kakaoCategory) || p.subtype || '';
      return {
        name: p.name, name_local: p.name_local || loc?.matchedName || '', country: p.country || '', city: p.city || '',
        area: p.area || '', category: p.category, subtype, tip: p.tip || '', confidence: p.confidence ?? 0.5,
        address: loc?.address || p.address || '', lat: loc?.lat ?? null, lng: loc?.lng ?? null,
        geo: loc?.source || '', place_url: loc?.placeUrl || '',
      };
    }));
    return res.status(200).json({ places });
  } catch (e) {
    console.error(e);
    return res.status(e.status || 500).json({ error: e.message || '服务器出错' });
  }
}
