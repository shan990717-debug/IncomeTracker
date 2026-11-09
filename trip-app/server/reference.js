import { askGeminiJSON } from './gemini.js';
import { fetchPost, downloadImages } from './post.js';
import { locate } from './places.js';

/*
 * 参考攻略: read someone else's itinerary post (screenshots and/or a link)
 * into days → areas → places, plus practical tips. The app keeps it and the
 * whole-trip planner learns the grouping and order from it.
 */

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    title: { type: 'STRING', description: '这篇攻略的标题，简体中文 20 字内，例如「首尔 5 天 4 夜经典路线」' },
    days: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          theme: { type: 'STRING', description: '这天的区域 / 主题，例如「钟路·北村」' },
          places: {
            type: 'ARRAY',
            items: {
              type: 'OBJECT',
              properties: {
                name: { type: 'STRING', description: '简体中文名称' },
                name_local: { type: 'STRING', description: '当地语言名称，和地图上一样；不知道就留空' },
                city: { type: 'STRING' },
                area: { type: 'STRING' },
                category: { type: 'STRING', enum: ['food', 'place', 'experience', 'shopping'] },
                tip: { type: 'STRING', description: '攻略里对这里的一句重点（简体中文 25 字内）；没有就留空' },
                search_query: { type: 'STRING', description: '地图搜索关键字，当地语言' },
              },
              required: ['name', 'name_local', 'city', 'area', 'category', 'tip', 'search_query'],
            },
          },
        },
        required: ['theme', 'places'],
      },
    },
    tips: {
      type: 'ARRAY',
      description: '攻略里的实用须知（交通卡、休馆日、要预约的…），没有就空数组',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING', description: '一句话，要做的事用动词开头（简体中文 25 字内）' },
          type: { type: 'STRING', enum: ['transport', 'entry', 'booking', 'connect', 'money', 'avoid', 'other'] },
          points: { type: 'ARRAY', items: { type: 'STRING' } },
          is_action: { type: 'BOOLEAN' },
          offset_days: { type: 'NUMBER', description: '建议出发前几天做（负数）；纯知识填 0' },
        },
        required: ['title', 'type', 'points', 'is_action', 'offset_days'],
      },
    },
  },
  required: ['title', 'days', 'tips'],
};

const str = (x, n) => String(x || '').slice(0, n);

export async function readReference({ text = '', url = '', images = [], regions = [] }) {
  const post = url ? await fetchPost(url) : null;
  const imgs = [...images];
  if (post?.ok && post.images?.length) imgs.push(...(await downloadImages(post.images, post.referer, Math.max(0, 6 - imgs.length))));
  const out = await askGeminiJSON({
    parts: [
      ...imgs.slice(0, 8).map((img) => ({ inline_data: { mime_type: img.media_type, data: img.data } })),
      { text: `这是一篇别人分享的旅行行程攻略（${regions.join('、') || '旅行'}）。把它整理成每天去哪些地方。
${imgs.length ? `附上 ${imgs.length} 张图片，请仔细读图上的文字。\n` : ''}${post?.ok ? `贴文：${post.title || ''}\n${(post.text || '').slice(0, 5000)}\n` : ''}${text ? `用户贴的文字：\n${text.slice(0, 4000)}\n` : ''}
规则：
- 照攻略的天数和顺序；没有分天就按区域分组。
- 只列具体的地点（景点、餐厅、市场、商场…），店名一定要是攻略里真的有的，不要编。
- tips 只放实用须知，不要重复地点介绍。
- 所有中文用简体。` },
    ],
    schema: SCHEMA,
    temperature: 0.2,
  });
  const days = (Array.isArray(out?.days) ? out.days : []).slice(0, 15);
  const located = await Promise.all(days.map(async (d) => ({
    theme: str(d.theme, 30),
    places: await Promise.all((d.places || []).filter((p) => p?.name).slice(0, 10).map(async (p) => {
      const hit = await locate({ name: p.name, nameLocal: p.name_local, query: p.search_query, area: p.area, region: p.city }).catch(() => null);
      return {
        name: str(p.name, 40), nameLocal: str(p.name_local, 40), city: str(p.city, 20), area: str(p.area, 20),
        category: ['food', 'place', 'experience', 'shopping'].includes(p.category) ? p.category : 'place', tip: str(p.tip, 60),
        lat: hit?.lat ?? null, lng: hit?.lng ?? null, address: hit?.address || '', geo: hit?.source || '', placeUrl: hit?.placeUrl || '',
      };
    })),
  })));
  const tips = (Array.isArray(out?.tips) ? out.tips : []).filter((t) => t?.title).slice(0, 10).map((t) => ({
    title: str(t.title, 60), type: t.type || 'other', points: (t.points || []).filter((x) => typeof x === 'string').slice(0, 4).map((x) => x.slice(0, 60)),
    isAction: t.is_action !== false, offsetDays: Number.isFinite(t.offset_days) ? Math.max(-120, Math.min(0, Math.round(t.offset_days))) : null,
  }));
  return {
    title: str(out?.title || post?.title || '参考攻略', 40), days: located.filter((d) => d.places.length), tips,
    source: { url, platform: post?.platform || (images.length ? '截图' : ''), title: str(post?.title, 40) },
  };
}
