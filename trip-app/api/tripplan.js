import { signedIn, readJson } from '../server/http.js';
import { askGeminiJSON } from '../server/gemini.js';
import { locate } from '../server/places.js';
import { readReference } from '../server/reference.js';

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
          stops: { type: 'ARRAY', items: { type: 'STRING' }, description: '这天依序要去的 id（P…、R… 或自己安排的 E…），固定时间的 E 放在对的位置' },
        },
        required: ['day', 'theme', 'stops'],
      },
    },
    events: {
      type: 'ARRAY',
      description: '旅客自己说想做、但攻略库没有的安排（倒数、滑雪、剪头发…），每件一笔；没有就空数组',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING', description: 'E1、E2… 要和 days.stops 里用的一样' },
          day: { type: 'STRING', description: 'YYYY-MM-DD；旅客说「前几天」就挑合适的一天' },
          title: { type: 'STRING', description: '简短名称，例如「跨年倒数」「江村滑雪」「剪头发」（简体中文）' },
          start: { type: 'STRING', description: 'HH:MM 开始时间；时间不固定就留空' },
          end: { type: 'STRING', description: 'HH:MM 结束时间；不知道就留空' },
          stay_minutes: { type: 'NUMBER', description: '大约多久（分钟）' },
          includes_travel: { type: 'BOOLEAN', description: '时间已经包含来回交通（例如「几点出门、晚上几点回到」）为 true' },
          place: { type: 'STRING', description: '建议去的地方（简体中文），例如 普信阁、江村度假村；不确定就留空' },
          search_query: { type: 'STRING', description: '地图搜索关键字，当地语言；没有就留空' },
          category: { type: 'STRING', enum: ['food', 'place', 'experience', 'shopping'] },
          note: { type: 'STRING', description: '一句提醒（简体中文 30 字内）' },
        },
        required: ['id', 'day', 'title', 'start', 'end', 'stay_minutes', 'includes_travel', 'place', 'search_query', 'category', 'note'],
      },
    },
    todos: {
      type: 'ARRAY',
      description: '因为旅客的安排要先准备的事（例如买滑雪票、订位）；没有就空数组',
      items: {
        type: 'OBJECT',
        properties: {
          title: { type: 'STRING', description: '动词开头，例如「买江村滑雪套票」（简体中文 25 字内）' },
          points: { type: 'ARRAY', items: { type: 'STRING' }, description: '1–3 个重点' },
          offset_days: { type: 'NUMBER', description: '建议出发前几天做，负数，例如 -14' },
        },
        required: ['title', 'points', 'offset_days'],
      },
    },
    new_places: {
      type: 'ARRAY',
      description: '收藏和推荐都不够把某天排满时，你自己推荐的地点（N1、N2…），名称要真实存在；够的话就空数组',
      items: {
        type: 'OBJECT',
        properties: {
          id: { type: 'STRING', description: 'N1、N2… 要和 days.stops 里用的一样' },
          name: { type: 'STRING', description: '简体中文名称' },
          name_local: { type: 'STRING', description: '当地语言名称' },
          city: { type: 'STRING' },
          area: { type: 'STRING' },
          category: { type: 'STRING', enum: ['food', 'place', 'experience', 'shopping'] },
          tip: { type: 'STRING', description: '一句话为什么推荐（简体中文 25 字内）' },
          search_query: { type: 'STRING', description: '地图搜索关键字，当地语言' },
        },
        required: ['id', 'name', 'name_local', 'city', 'area', 'category', 'tip', 'search_query'],
      },
    },
    summary: { type: 'STRING', description: '一两句话说明这样安排的思路（简体中文 60 字内）' },
  },
  required: ['days', 'events', 'todos', 'new_places', 'summary'],
};

const line = (x) => `${x.id}｜${x.title}｜${x.city || '?'}${x.area ? `·${x.area}` : ''}｜${x.kind || ''}${x.note ? `｜${x.note}` : ''}`;

function prompt({ days, places, extras, pace, prefs, wishes, references }) {
  return `你在帮朋友把旅行攻略排成每天的行程。只决定「哪个地点放哪一天」，每天的顺序之后会再排。

每一天（城市是那晚住的地方；可用时间已经扣掉飞机、退房等）：
${days.map((d) => `- ${d.day}｜${d.label}｜城市：${d.city || '未知'}${d.base ? `｜住 ${d.base}` : ''}｜可用 ${d.hours}${d.note ? `｜${d.note}` : ''}`).join('\n')}

我们收藏的地点（P 开头，优先用这些）：
${places.map(line).join('\n') || '（没有）'}

推荐 / 参考攻略里提到的地方（R 开头，只用来补空，不一定要用）：
${extras.map(line).join('\n') || '（没有）'}
${references ? `\n别人分享的行程攻略（学习它怎么分区、哪些地方排同一天、什么顺序顺路；不要照抄，以我们收藏的为主）：\n${references}\n` : ''}

节奏：${PACE[pace] || PACE.normal}。可用时间短的日子（例如落地当天、起飞当天）少排，甚至不排。
排满时间：每一天「停留 + 交通」加起来要接近那天的可用时间（交通每段约 30 分）。停留大约：景点 60–90 分、餐厅 60、咖啡 40、市场 90、购物商圈（明洞、弘大、东大门…）150–180、商场 120。
- 只有一两个地点、却有大半天的日子，要再补附近的地方，例如购物日把邻近的商圈串起来（明洞 → 南大门 → 东大门、弘大 → 延南洞 → 望远）。
- 先用 P，再用 R；都不够时可以在 new_places 自己推荐真实存在的地点（N1、N2…）。
${prefs.length ? `偏好：${prefs.join('、')}。\n` : ''}${wishes ? `旅客自己想做的事（一定要照着排，时间优先）：「${wishes}」\n- 只有具体要做的事（剪头发、倒数、滑雪…）才变成 events；像「以购物为主」「想轻松一点」这种是偏好，用来挑地点，不要变成 events。
- 每件事变成一笔 events（E1、E2…），放进对的日子，并把 E 的 id 放在 days.stops 里正确的顺序（例如晚上的倒数放最后）。\n- 有固定时间的事，其他地点要排在它前后空出来的时间；整天的活动（例如滑雪）那天只在前后剩下的时间排少少几站。\n- 需要先准备的（买票、预约）写进 todos。\n` : ''}规则：
- 地点只能排在同一个城市的日子；搭 KTX / 飞机换城市的那天，前后两个城市的地点都可以。
- 同一个商圈 / 附近的地点放同一天，不要一天跑好几个远的区。
- 每天大约 2 个正餐（餐厅 / 小吃），其余是景点、购物、咖啡；不要一天全是吃的。
- 收藏的地点尽量都排进去；真的排不下就留着不排。
- 收藏不够填满的日子，才从 R 开头的推荐补。
- 每个 id 最多出现一次，照抄，不要编新的 id。
- 名字很像、其实是同一个地方的（例如「63 SkyPicnic」和「星巴克 63 SkyPicnic」），只排一个。
- 自己安排的事（E…）的时间一定要在那天的「可用」时间里面；想做的日子没有空，就挑最近一个有空的日子。
- 所有中文用简体。`;
}

/* ---------- second pass: days with lots of free time get nearby places added ---------- */

const toM = (x) => { const [h, m] = String(x || '').split(':').map(Number); return Number.isFinite(h) ? h * 60 + (m || 0) : null; };
const stayOf = (x) => (/购物|商圈|商场/.test(`${x.kind || ''}${x.title || ''}`) ? 150 : /咖啡|甜点/.test(x.kind || '') ? 40 : /美食|小吃|餐/.test(x.kind || '') ? 60 : 80);

const FILL_SCHEMA = {
  type: 'OBJECT',
  properties: {
    days: { type: 'ARRAY', items: { type: 'OBJECT', properties: { day: { type: 'STRING' }, add: { type: 'ARRAY', items: { type: 'STRING' } } }, required: ['day', 'add'] } },
    new_places: SCHEMA.properties.new_places,
  },
  required: ['days', 'new_places'],
};

async function fillThinDays({ days, result, P, R, events, newPlaces, short, wishes, prefs }) {
  const byId = new Map([...P, ...R].map((x) => [x.id, x]));
  const used = new Set(result.flatMap((d) => d.stops.map((x) => x.id)));
  const thin = result.map((d) => {
    const info = days.find((x) => x.day === d.day);
    const [a, b] = String(info?.hours || '').split('-').map(toM);
    const avail = a != null && b != null ? b - a : 0;
    const spent = d.stops.reduce((m, x) => {
      const ev = events.find((e) => e.key === x.id);
      const shortId = [...short.entries()].find(([, v]) => v.id === x.id)?.[0];
      return m + (ev ? ev.stay : stayOf(byId.get(shortId) || {})) + 30;
    }, 0);
    return { d, info, avail, free: avail - spent };
  }).filter((x) => x.avail >= 240 && x.free >= 180);
  if (!thin.length) return;
  const free = [...P, ...R].filter((x) => !used.has(short.get(x.id)?.id));
  const out = await askGeminiJSON({
    parts: [{ text: `下面这几天行程排得太空，请帮每一天补「附近」的地点，把空的时间排满（停留：购物商圈 150–180 分、商场 120、景点 60–90、餐厅 60、咖啡 40，每段交通约 30 分）。
${thin.map((x) => `- ${x.d.day}｜${x.info.city}｜主题：${x.d.theme}｜已排：${x.d.stops.map((s) => [...short.entries()].find(([, v]) => v.id === s.id)?.[0]).map((k) => byId.get(k)?.title || events.find((e) => e.key === `E:${k}`)?.title || newPlaces.find((n) => n.id === `N:${k}`)?.title || k).join('、') || '（没有）'}｜还空约 ${Math.round(x.free / 60)} 小时`).join('\n')}
${wishes ? `旅客说：「${wishes}」
` : ''}${prefs.length ? `偏好：${prefs.join('、')}
` : ''}
还没用的收藏 / 推荐（优先用，id 照抄）：
${free.map((x) => `${x.id}｜${x.title}｜${x.city || ''}${x.area ? `·${x.area}` : ''}｜${x.kind || ''}`).join('\n') || '（没有）'}

规则：
- 只补跟那天主题、区域相近的地方（例如购物日在明洞，就补南大门、东大门、乐天百货；在弘大就补延南洞、望远）。
- 上面不够就在 new_places 推荐真实存在的地点（id 用 N${newPlaces.length + 1} 开始），add 里放 id。
- 每个 id 只能用一次。所有中文用简体。` }],
    schema: FILL_SCHEMA,
    temperature: 0.3,
  }).catch(() => null);
  if (!out) return;
  const extraNew = await Promise.all((out.new_places || []).filter((x) => x?.id && x.name).slice(0, 15).map(async (x) => {
    const hit = await locate({ name: x.name, nameLocal: x.name_local, query: x.search_query, area: x.area, region: x.city }).catch(() => null);
    return {
      id: `N:${String(x.id).trim().toUpperCase()}`, title: String(x.name).slice(0, 40),
      place: { name: String(x.name).slice(0, 40), nameLocal: String(x.name_local || '').slice(0, 40), city: x.city || '', area: x.area || '',
        category: ['food', 'place', 'experience', 'shopping'].includes(x.category) ? x.category : 'place', tip: String(x.tip || '').slice(0, 60),
        lat: hit?.lat ?? null, lng: hit?.lng ?? null, address: hit?.address || '', geo: hit?.source || '', placeUrl: hit?.placeUrl || '' },
    };
  }));
  extraNew.filter((x) => !short.has(x.id.slice(2))).forEach((x) => { short.set(x.id.slice(2), { id: x.id, extra: true }); newPlaces.push(x); });
  (out.days || []).forEach((d) => {
    const day = result.find((x) => x.day === d.day && thin.some((t) => t.d === x));
    if (!day) return;
    (d.add || []).map((k) => String(k).trim().toUpperCase()).forEach((k) => {
      const ref = short.get(k);
      if (!ref || used.has(ref.id)) return;
      used.add(ref.id);
      day.stops.push(ref);
    });
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: '服务器没有设定 GEMINI_API_KEY' });
  if (!(await signedIn(req))) return res.status(401).json({ error: '请先登录' });
  const b = await readJson(req);
  const str = (x, n) => String(x || '').slice(0, n);
  // 参考攻略: read one itinerary post (screenshots / link) — no planning in this call.
  if (b?.readRef) {
    const images = (Array.isArray(b.images) ? b.images : []).filter((i) => i?.media_type === 'image/jpeg' && typeof i.data === 'string' && i.data.length <= 2_000_000).slice(0, 4);
    const text = str(b.text, 4000);
    const url = (text.match(/https?:\/\/\S+/) || [])[0] || '';
    if (!text && !images.length) return res.status(400).json({ error: '没有内容可以读' });
    try { return res.status(200).json(await readReference({ text, url, images, regions: (b.regions || []).filter((x) => typeof x === 'string').slice(0, 6) })); } catch (e) {
      console.error(e);
      return res.status(e.status || 500).json({ error: e.message || '服务器出错' });
    }
  }
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
      parts: [{ text: prompt({ days, places: P, extras: R, pace: b?.pace, prefs: (b?.prefs || []).filter((x) => typeof x === 'string').slice(0, 6), wishes: str(b?.wishes, 1500), references: str(b?.references, 3000) }) }],
      schema: SCHEMA,
      temperature: 0.3,
    });
    const valid = new Set(days.map((d) => d.day));
    const hm = (x) => { const m = String(x || '').match(/^(\d{1,2}):(\d{2})/); return m ? `${m[1].padStart(2, '0')}:${m[2]}` : ''; };
    const evs = (Array.isArray(out?.events) ? out.events : []).filter((e) => e?.id && e.title && valid.has(e.day)).slice(0, 15);
    const events = await Promise.all(evs.map(async (e) => {
      const hit = e.place || e.search_query ? await locate({ name: e.place, query: e.search_query, region: days.find((d) => d.day === e.day)?.city?.split('→').pop() || '' }).catch(() => null) : null;
      const stay = Number(e.stay_minutes);
      return {
        key: `E:${String(e.id).trim().toUpperCase()}`, day: e.day, title: str(e.title, 30), start: hm(e.start), end: hm(e.end),
        stay: Number.isFinite(stay) && stay > 0 ? Math.min(900, Math.round(stay)) : 90, includesTravel: !!e.includes_travel,
        place: e.place ? { name: str(e.place, 40), address: hit?.address || '', ...(hit ? { lat: hit.lat, lng: hit.lng, geo: hit.source, placeUrl: hit.placeUrl || '' } : {}) } : null,
        category: ['food', 'place', 'experience', 'shopping'].includes(e.category) ? e.category : 'experience', note: str(e.note, 60),
      };
    }));
    events.forEach((e) => short.set(e.key.slice(2), { id: e.key, event: true }));
    const nps = (Array.isArray(out?.new_places) ? out.new_places : []).filter((x) => x?.id && x.name).slice(0, 20);
    const newPlaces = await Promise.all(nps.map(async (x) => {
      const hit = await locate({ name: x.name, nameLocal: x.name_local, query: x.search_query, area: x.area, region: x.city }).catch(() => null);
      return {
        id: `N:${String(x.id).trim().toUpperCase()}`, title: str(x.name, 40),
        place: {
          name: str(x.name, 40), nameLocal: str(x.name_local, 40), city: str(x.city, 20), area: str(x.area, 20),
          category: ['food', 'place', 'experience', 'shopping'].includes(x.category) ? x.category : 'place', tip: str(x.tip, 60),
          lat: hit?.lat ?? null, lng: hit?.lng ?? null, address: hit?.address || '', geo: hit?.source || '', placeUrl: hit?.placeUrl || '',
        },
      };
    }));
    newPlaces.forEach((x) => short.set(x.id.slice(2), { id: x.id, extra: true }));
    const todos = (Array.isArray(out?.todos) ? out.todos : []).filter((t) => t?.title).slice(0, 8).map((t) => ({
      title: str(t.title, 40), points: (t.points || []).filter((x) => typeof x === 'string').slice(0, 3).map((x) => x.slice(0, 40)),
      offsetDays: Number.isFinite(t.offset_days) ? Math.max(-120, Math.min(0, Math.round(t.offset_days))) : -7,
    }));
    const used = new Set();
    const result = (Array.isArray(out?.days) ? out.days : []).filter((d) => valid.has(d.day)).map((d) => ({
      day: d.day,
      theme: str(d.theme, 20),
      stops: (d.stops || []).map((k) => String(k).trim().toUpperCase()).filter((k) => short.has(k) && !used.has(k) && used.add(k)).map((k) => short.get(k)),
    }));
    await fillThinDays({ days, result, P, R, events, newPlaces, short, wishes: str(b?.wishes, 1500), prefs: (b?.prefs || []).filter((x) => typeof x === 'string').slice(0, 6) });

    // Events the model forgot to put in a day's list go at the end of their day.
    events.forEach((e) => { const d = result.find((x) => x.day === e.day); if (d && !d.stops.some((x) => x.id === e.key)) d.stops.push({ id: e.key, event: true }); });
    return res.status(200).json({ days: result, events, todos, newPlaces, summary: str(out?.summary, 120) });
  } catch (e) {
    console.error(e);
    return res.status(e.status || 500).json({ error: e.message || '服务器出错' });
  }
}
