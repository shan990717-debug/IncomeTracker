import { signedIn, readJson } from '../server/http.js';
import { askGeminiJSON } from '../server/gemini.js';
import { locate } from '../server/places.js';
import { SUBTYPES } from './extract.js';

/*
 * POST /api/must — 必去推荐 for one city: the must-see places everyone already
 * knows about (景福宫…) and a couple of classic routes. The app saves the
 * answer per trip + city, so each city costs one AI call for the whole group.
 */

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    places: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          name: { type: 'STRING', description: '简体中文名称' },
          name_local: { type: 'STRING', description: '当地语言名称（韩国用韩文），和地图上一样' },
          area: { type: 'STRING', description: '商圈或区，简体中文' },
          category: { type: 'STRING', enum: ['food', 'place', 'experience', 'shopping'] },
          subtype: { type: 'STRING' },
          tip: { type: 'STRING', description: '一句实用提醒：休馆日、最好时段、门票（简体中文 25 字内）' },
          search_query: { type: 'STRING', description: '地图搜索关键字，当地语言' },
        },
        required: ['name', 'name_local', 'area', 'category', 'subtype', 'tip', 'search_query'],
      },
    },
    routes: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING', description: '路线名，例如「经典半天：景福宫 → 北村 → 仁寺洞」' },
          stops: { type: 'ARRAY', items: { type: 'STRING' }, description: '依序的地点名称，要和 places 里的 name 完全一样' },
          duration: { type: 'STRING', description: '大约多久，例如「半天」「3–4 小时」' },
          tip: { type: 'STRING', description: '一句话：怎么走最顺、什么时候去（简体中文 40 字内）' },
        },
        required: ['title', 'stops', 'duration', 'tip'],
      },
    },
  },
  required: ['places', 'routes'],
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: '服务器没有设定 GEMINI_API_KEY' });
  if (!(await signedIn(req))) return res.status(401).json({ error: '请先登录' });
  const b = await readJson(req);
  const city = typeof b?.city === 'string' ? b.city.trim().slice(0, 30) : '';
  const country = typeof b?.country === 'string' ? b.country.slice(0, 20) : '';
  if (!city) return res.status(400).json({ error: '没有城市' });
  const lists = Object.entries(SUBTYPES).map(([k, v]) => `${k}: ${v.join('、')}`).join('\n');
  try {
    const out = await askGeminiJSON({
      parts: [{ text: `列出第一次去${country ? `${country}的` : ''}${city}的旅客「一定要去」的地方，是大家都知道、不用另外找攻略的经典（例如首尔的景福宫、北村韩屋村、南山首尔塔、明洞）。
- places：8 到 10 个，以景点为主，可以有 1–2 个经典市场或美食街，不要列单一餐厅。
- routes：2 条经典路线，把邻近的必去地点串起来（步行或一两站地铁），stops 的名字要和 places 的 name 完全一样。
- subtype 从这个清单选：
${lists}
- 所有中文用简体。` }],
      schema: SCHEMA,
      temperature: 0.3,
    });
    const raw = (Array.isArray(out?.places) ? out.places : []).filter((p) => p?.name).slice(0, 12);
    const places = await Promise.all(raw.map(async (p) => {
      const hit = await locate({ name: p.name, nameLocal: p.name_local, query: p.search_query, area: p.area, region: city, country }).catch(() => null);
      return {
        name: String(p.name).slice(0, 40), nameLocal: p.name_local || '', area: p.area || '', category: p.category || 'place',
        subtype: (SUBTYPES[p.category] || []).includes(p.subtype) ? p.subtype : '', tip: p.tip || '',
        lat: hit?.lat ?? null, lng: hit?.lng ?? null, address: hit?.address || '', geo: hit?.source || '', placeUrl: hit?.placeUrl || '',
      };
    }));
    const names = new Set(places.map((p) => p.name));
    const routes = (Array.isArray(out?.routes) ? out.routes : []).map((r) => ({
      title: String(r.title || '').slice(0, 60), duration: String(r.duration || '').slice(0, 20), tip: String(r.tip || '').slice(0, 80),
      stops: (r.stops || []).filter((x) => names.has(x)),
    })).filter((r) => r.stops.length >= 2).slice(0, 3);
    return res.status(200).json({ places, routes });
  } catch (e) {
    console.error(e);
    return res.status(e.status || 500).json({ error: e.message || '服务器出错' });
  }
}
