import { signedIn, readJson } from '../server/http.js';
import { askGeminiJSON } from '../server/gemini.js';

/*
 * POST /api/tripplan — AI 帮我排整个旅行: put the collected places (and, to
 * fill gaps, some 必去推荐) on the trip's days. Only decides which places go
 * on which day; the order and times of each day are done afterwards by
 * /api/plan, one day at a time, like the 「AI 帮我排」 button.
 */

const PACE = { relaxed: '轻松：一天 3–4 站', normal: '普通：一天 5–6 站', packed: '紧凑：一天 7–8 站' };

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    days: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          day: { type: 'STRING', description: '日期 YYYY-MM-DD，照抄' },
          theme: { type: 'STRING', description: '这天的主题 / 商圈，例如「钟路·北村」「海云台」（简体中文 12 字内）' },
          stops: { type: 'ARRAY', items: { type: 'STRING' }, description: '这天要去的地点 id（照抄 P… 或 R… 开头的 id）' },
        },
        required: ['day', 'theme', 'stops'],
      },
    },
    summary: { type: 'STRING', description: '一两句话说明这样安排的思路（简体中文 60 字内）' },
  },
  required: ['days', 'summary'],
};

const line = (x) => `${x.id}｜${x.title}｜${x.city || '?'}${x.area ? `·${x.area}` : ''}｜${x.kind || ''}${x.note ? `｜${x.note}` : ''}`;

function prompt({ days, places, extras, pace, prefs }) {
  return `你在帮朋友把旅行攻略排成每天的行程。只决定「哪个地点放哪一天」，每天的顺序之后会再排。

每一天（城市是那晚住的地方；可用时间已经扣掉飞机、退房等）：
${days.map((d) => `- ${d.day}｜${d.label}｜城市：${d.city || '未知'}${d.base ? `｜住 ${d.base}` : ''}｜可用 ${d.hours}${d.note ? `｜${d.note}` : ''}`).join('\n')}

我们收藏的地点（P 开头，优先用这些）：
${places.map(line).join('\n') || '（没有）'}

AI 推荐的必去（R 开头，只用来补空，不一定要用）：
${extras.map(line).join('\n') || '（没有）'}

节奏：${PACE[pace] || PACE.normal}。可用时间短的日子（例如落地当天、起飞当天）少排，甚至不排。
${prefs.length ? `偏好：${prefs.join('、')}。\n` : ''}规则：
- 地点只能排在同一个城市的日子；搭 KTX / 飞机换城市的那天，前后两个城市的地点都可以。
- 同一个商圈 / 附近的地点放同一天，不要一天跑好几个远的区。
- 每天大约 2 个正餐（餐厅 / 小吃），其余是景点、购物、咖啡；不要一天全是吃的。
- 收藏的地点尽量都排进去；真的排不下就留着不排。
- 收藏不够填满的日子，才从 R 开头的推荐补。
- 每个 id 最多出现一次，照抄，不要编新的 id。
- 所有中文用简体。`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: '服务器没有设定 GEMINI_API_KEY' });
  if (!(await signedIn(req))) return res.status(401).json({ error: '请先登录' });
  const b = await readJson(req);
  const str = (x, n) => String(x || '').slice(0, n);
  const days = (Array.isArray(b?.days) ? b.days : []).slice(0, 31).map((d) => ({
    day: str(d.day, 10), label: str(d.label, 30), city: str(d.city, 30), base: str(d.base, 40), hours: str(d.hours, 20), note: str(d.note, 80),
  })).filter((d) => /^\d{4}-\d{2}-\d{2}$/.test(d.day));
  const item = (x) => ({ id: str(x.id, 60), title: str(x.title, 40), city: str(x.city, 20), area: str(x.area, 20), kind: str(x.kind, 20), note: str(x.note, 60) });
  const places = (Array.isArray(b?.places) ? b.places : []).slice(0, 150).map(item).filter((x) => x.id && x.title);
  const extras = (Array.isArray(b?.extras) ? b.extras : []).slice(0, 80).map(item).filter((x) => x.id && x.title);
  if (!days.length) return res.status(400).json({ error: '没有可以排的日子' });
  if (!places.length && !extras.length) return res.status(400).json({ error: '攻略库还没有地点' });

  // The model sees short ids (P1, R1…); map them back afterwards.
  const short = new Map();
  const P = places.map((x, i) => { short.set(`P${i + 1}`, { id: x.id, extra: false }); return { ...x, id: `P${i + 1}` }; });
  const R = extras.map((x, i) => { short.set(`R${i + 1}`, { id: x.id, extra: true }); return { ...x, id: `R${i + 1}` }; });
  try {
    const out = await askGeminiJSON({
      parts: [{ text: prompt({ days, places: P, extras: R, pace: b?.pace, prefs: (b?.prefs || []).filter((x) => typeof x === 'string').slice(0, 6) }) }],
      schema: SCHEMA,
      temperature: 0.3,
    });
    const valid = new Set(days.map((d) => d.day));
    const used = new Set();
    const result = (Array.isArray(out?.days) ? out.days : []).filter((d) => valid.has(d.day)).map((d) => ({
      day: d.day,
      theme: str(d.theme, 20),
      stops: (d.stops || []).map((k) => String(k).trim().toUpperCase()).filter((k) => short.has(k) && !used.has(k) && used.add(k)).map((k) => short.get(k)),
    }));
    return res.status(200).json({ days: result, summary: str(out?.summary, 120) });
  } catch (e) {
    console.error(e);
    return res.status(e.status || 500).json({ error: e.message || '服务器出错' });
  }
}
