import { locate, subtypeFromKakao } from '../server/places.js';
import { signedIn, readJson } from '../server/http.js';
import { fetchPost, downloadImages } from '../server/post.js';
import { askGeminiJSON } from '../server/gemini.js';

/*
 * POST /api/extract — read one social-media post (caption/link and/or
 * screenshots) and return the places it recommends, each with category,
 * 种类, city/area and — when it can be found — real coordinates.
 *
 * 1. Gemini (free tier, key in GEMINI_API_KEY) reads the text/screenshots and
 *    returns JSON constrained by a schema.
 * 2. Each place is looked up on Kakao (Korea) or OpenStreetMap (elsewhere).
 */

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
          verdict: { type: 'STRING', enum: ['recommend', 'avoid'], description: '帖子是推荐这里，还是叫人别去（避雷）' },
          verdict_reason: { type: 'STRING', description: '避雷的话，一句话说为什么（简体中文，20字内）；推荐就留空' },
        },
        required: ['name', 'city', 'category', 'subtype', 'confidence', 'verdict'],
      },
    },
    tips: {
      type: 'ARRAY',
      description: '须知：帖子里提到的实用信息或出发前/到当地要做的事（交通卡、订票、入境、上网、钱、避雷提醒等）。不是景点或店家介绍。',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING', description: '一句话标题，要做的事用动词开头，例如「申请 K-ETA」「KTX 首尔→釜山 提前一个月订」（简体中文，25字内）' },
          type: { type: 'STRING', enum: ['transport', 'entry', 'booking', 'connect', 'money', 'avoid', 'other'] },
          points: { type: 'ARRAY', items: { type: 'STRING' }, description: '2-4 个重点：在哪买/订、价格、注意事项（简体中文，每点 30 字内）' },
          country: { type: 'STRING', description: '国家，简体中文' },
          cities: { type: 'ARRAY', items: { type: 'STRING' }, description: '适用城市（简体中文）；适用整个国家就留空' },
          needs_all_cities: { type: 'BOOLEAN', description: '城市之间的路线（例如 首尔→釜山 的车票）为 true；只要去其中一个城市就适用为 false' },
          nationalities: { type: 'ARRAY', items: { type: 'STRING' }, description: '帖子有说只适用某些护照（例如 马来西亚）就列出来（简体中文国名）；没说就留空' },
          is_action: { type: 'BOOLEAN', description: '是要去做的事（订、买、申请、下载）为 true；只是知识或提醒为 false' },
          personal: { type: 'BOOLEAN', description: '每个旅客都要自己做（K-ETA、入境卡、eSIM）为 true；一个人帮大家做就好（订车票、订餐厅）为 false' },
          offset_days: { type: 'NUMBER', description: '建议出发前几天做：-30 表示出发前 30 天，0 表示出发当天或到当地。帖子没写就按常识建议一个；纯知识填 0' },
          offset_from_post: { type: 'BOOLEAN', description: '天数是帖子写的为 true；是你按常识建议的为 false' },
        },
        required: ['title', 'type', 'points', 'cities', 'is_action', 'personal', 'offset_days', 'offset_from_post'],
      },
    },
  },
  required: ['places', 'tips'],
};

function buildPrompt({ text, url, regions, imageCount, post }) {
  const lists = Object.entries(SUBTYPES).map(([k, v]) => `${k}: ${v.join('、')}`).join('\n');
  const postBlock = post?.ok
    ? `贴文原文（从链接读到的）：
标题：${post.title || '（无）'}
内文：
"""
${(post.text || '').slice(0, 5000)}
"""
${post.tags?.length ? `标签：${post.tags.join('、')}\n` : ''}${post.location ? `发布地点：${post.location}\n` : ''}${post.isVideo ? '（这是影片贴文，内文和封面可能只写了一部分店名）\n' : ''}`
    : '';
  return `你在帮朋友整理从 Instagram / 小红书 收藏的旅行攻略，把帖子里推荐的地点一个一个找出来。
这次旅行去：${regions.join('、') || '（未指定）'}

${imageCount ? `附上 ${imageCount} 张图片（贴文的图片或用户截图），请仔细读图片里的文字（店名、招牌、地址、菜单常常在图片上）。\n` : ''}${postBlock}${text ? `用户贴上的分享文字：\n"""\n${text}\n"""\n` : ''}${url ? `链接：${url}\n` : ''}
规则：
- 每一个具体的地点都列出来：餐厅、咖啡厅、景点、店铺、体验活动。一篇介绍好几家就分别列。
- category：food=吃喝（含咖啡甜点、酒馆），place=景点，experience=体验活动，shopping=购物。
- subtype 从下面的清单选一个最接近的：
${lists}
- 店名一定要是帖子里真的出现的。看不出店名就不要编，返回空的 places。
- 帖子叫人「别去」「避雷」「踩雷」「不推荐」的地方，verdict 填 avoid，并写原因。
- tips（须知）：帖子里的实用信息另外列出：交通（交通卡、KTX、机场、地铁）、入境签证（K-ETA、入境卡）、预订（要提前订的票、餐厅）、上网（eSIM、App）、钱（换钱、付款、退税）、避雷提醒（被宰、陷阱）。
  同一件事只列一次；单纯介绍景点或店家的内容不要放进 tips。没有就返回空数组。
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

function askGemini(input) {
  return askGeminiJSON({
    parts: [
      ...input.images.map((img) => ({ inline_data: { mime_type: img.media_type, data: img.data } })),
      { text: buildPrompt({ ...input, imageCount: input.images.length }) },
    ],
    schema: SCHEMA,
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: '服务器没有设定 GEMINI_API_KEY' });
  if (!(await signedIn(req))) return res.status(401).json({ error: '请先登录' });

  const input = validate(await readJson(req));
  if (!input) return res.status(400).json({ error: '没有内容可以识别' });

  try {
    // Open the link for the full post (the share text is only a cut-off title).
    const post = input.url ? await fetchPost(input.url) : null;
    if (post?.ok && post.images?.length) {
      const room = Math.max(0, 6 - input.images.length);
      input.images.push(...(await downloadImages(post.images, post.referer, Math.min(room, 4))));
    }
    const out = await askGemini({ ...input, post });
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
        verdict: p.verdict === 'avoid' ? 'avoid' : 'recommend', verdict_reason: p.verdict === 'avoid' ? (p.verdict_reason || '') : '',
      };
    }));
    const TIP_TYPES = ['transport', 'entry', 'booking', 'connect', 'money', 'avoid', 'other'];
    const strs = (a, n) => (Array.isArray(a) ? a.filter((x) => typeof x === 'string' && x.trim()).map((x) => x.trim()).slice(0, n) : []);
    const tips = (Array.isArray(out?.tips) ? out.tips : []).filter((t) => t?.title).map((t) => ({
      title: String(t.title).slice(0, 60),
      type: TIP_TYPES.includes(t.type) ? t.type : 'other',
      points: strs(t.points, 4),
      country: t.country || '',
      cities: strs(t.cities, 6),
      needs_all_cities: !!t.needs_all_cities,
      nationalities: strs(t.nationalities, 10),
      is_action: t.is_action !== false,
      personal: !!t.personal,
      offset_days: Number.isFinite(t.offset_days) ? Math.max(-120, Math.min(30, Math.round(t.offset_days))) : null,
      offset_from_post: !!t.offset_from_post,
    }));
    return res.status(200).json({
      places,
      tips,
      post: post ? { ok: !!post.ok, reason: post.reason || '', platform: post.platform || '', title: post.title || '', cover: post.images?.[0] || '', textLength: (post.text || '').length } : null,
    });
  } catch (e) {
    console.error(e);
    return res.status(e.status || 500).json({ error: e.message || '服务器出错' });
  }
}
