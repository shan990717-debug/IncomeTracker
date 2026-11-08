import { signedIn, readJson } from '../server/http.js';
import { askGeminiJSON } from '../server/gemini.js';
import { travel, buildTimeline, nearestOrder, defaultStay } from '../server/schedule.js';

/*
 * POST /api/plan — order one day's stops.
 *
 * We give Gemini the stops, the estimated travel minutes between every pair
 * (straight-line estimate), the day's start/end and meal windows. It returns
 * the order, how long to stay, which stop is lunch / dinner, and a short
 * reason. We then compute the times ourselves (buildTimeline) so they always
 * add up. If AI fails, a nearest-next order is used instead.
 */

const MAX_STOPS = 12;

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    order: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING' },
          stay_minutes: { type: 'NUMBER', description: '在这里待多久（分钟）' },
          meal: { type: 'STRING', enum: ['lunch', 'dinner', 'none'] },
          reason: { type: 'STRING', description: '为什么放在这个位置，一句话简体中文（20字内）；没有特别原因就留空' },
        },
        required: ['id', 'stay_minutes', 'meal', 'reason'],
      },
    },
    summary: { type: 'STRING', description: '一句话总结这天的路线（简体中文，30字内）' },
    gap_tip: { type: 'STRING', description: '如果中间有超过 2 小时的空档，建议怎么用（简体中文）；没有就留空' },
  },
  required: ['order', 'summary'],
};

function buildPrompt({ day, start, end, startTime, endTime, lunch, dinner, stops }) {
  const pts = [{ id: 'START', ...start }, ...stops, ...(end ? [{ id: 'END', ...end }] : [])];
  const lines = stops.map((s) => `- id=${s.id}｜${s.title}｜${s.category}/${s.subtype || '-'}｜${s.area || ''}${s.note ? `｜贴文重点：${s.note}` : ''}`).join('\n');
  const matrix = pts.map((a) => `${a.id}: ${pts.filter((b) => b !== a).map((b) => `${b.id}=${travel(a, b).minutes}分`).join(' ')}`).join('\n');
  return `你在帮旅客排 ${day} 这一天的行程顺序。
出发：${start?.name || '（未设定）'}，${startTime} 出门；结束：${end?.name || '（不用回去）'}，希望 ${endTime} 前结束。
午餐时间 ${lunch}，晚餐时间 ${dinner}。

要去的地点：
${lines}

两地之间的交通时间（分钟，估算）：
${matrix}

规则：
- 每个地点都要排进去，id 照抄，每个只出现一次。
- 顺序尽量顺路，少走回头路；从出发点开始，最后离结束点近。
- 吃饭的地点安排在午餐或晚餐时间，meal 填 lunch / dinner；咖啡甜点不算正餐（meal 填 none）。
- 参考贴文重点：例如「早上去才买得到」就排前面，「看日落」就排傍晚。
- stay_minutes：咖啡店约 40、餐厅约 60、市场约 90、景点 60–90、主题乐园可以更久。
- 所有中文用简体。`;
}

function validate(b) {
  const pt = (p) => (p && typeof p === 'object' ? { name: String(p.name || '').slice(0, 80), lat: Number(p.lat), lng: Number(p.lng) } : null);
  const stops = (Array.isArray(b?.stops) ? b.stops : []).slice(0, MAX_STOPS).map((s) => ({
    id: String(s.id || ''), title: String(s.title || '').slice(0, 60), category: String(s.category || 'place'),
    subtype: String(s.subtype || ''), area: String(s.area || ''), note: String(s.note || '').slice(0, 120),
    lat: Number(s.lat), lng: Number(s.lng),
  })).filter((s) => s.id && s.title);
  if (!stops.length) return null;
  const clean = (p) => { const x = pt(p); if (x && !Number.isFinite(x.lat)) { delete x.lat; delete x.lng; } return x; };
  stops.forEach((s) => { if (!Number.isFinite(s.lat) || !Number.isFinite(s.lng)) { delete s.lat; delete s.lng; } });
  return {
    day: String(b.day || ''), start: clean(b.start), end: clean(b.end), stops,
    startTime: String(b.startTime || '10:00'), endTime: String(b.endTime || '21:00'),
    lunch: String(b.lunch || '12:00-13:30'), dinner: String(b.dinner || '18:00-19:30'),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!(await signedIn(req))) return res.status(401).json({ error: '请先登录' });
  const input = validate(await readJson(req));
  if (!input) return res.status(400).json({ error: '这天还没有地点' });

  let ordered = null;
  let summary = '';
  let gapTip = '';
  let aiUsed = false;
  let aiError = '';
  if (process.env.GEMINI_API_KEY) {
    try {
      const out = await askGeminiJSON({ parts: [{ text: buildPrompt(input) }], schema: SCHEMA });
      const byId = new Map(input.stops.map((s) => [s.id, s]));
      const seen = new Set();
      const list = [];
      for (const o of Array.isArray(out?.order) ? out.order : []) {
        const s = byId.get(o?.id);
        if (!s || seen.has(s.id)) continue;
        seen.add(s.id);
        const stay = Number(o.stay_minutes);
        list.push({ ...s, stay: Number.isFinite(stay) && stay >= 10 && stay <= 480 ? Math.round(stay) : defaultStay(s), meal: o.meal === 'lunch' || o.meal === 'dinner' ? o.meal : '', reason: String(o.reason || '').slice(0, 60) });
      }
      // Anything the model dropped goes at the end rather than disappearing.
      input.stops.filter((s) => !seen.has(s.id)).forEach((s) => list.push({ ...s, stay: defaultStay(s), meal: '', reason: '' }));
      ordered = list;
      summary = String(out?.summary || '').slice(0, 80);
      gapTip = String(out?.gap_tip || '').slice(0, 120);
      aiUsed = true;
    } catch (e) {
      aiError = e.message;
    }
  }
  if (!ordered) {
    ordered = nearestOrder(input.start, input.stops).map((s) => ({ ...s, stay: defaultStay(s), reason: '' }));
    summary = 'AI 暂时不可用，先按「每次去最近的一站」排';
  }

  const tl = buildTimeline({ ...input, stops: ordered });
  return res.status(200).json({
    stops: tl.stops.map((s, i) => ({ id: s.id, order: i + 1, time: s.time, stay: s.stay, meal: s.meal || '', reason: s.reason || '' })),
    legs: tl.legs,
    endTime: tl.endTime,
    summary,
    gapTip,
    aiUsed,
    aiError,
  });
}
