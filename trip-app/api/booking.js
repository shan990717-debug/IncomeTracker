import { signedIn, readJson } from '../server/http.js';
import { askGeminiJSON } from '../server/gemini.js';
import { locate } from '../server/places.js';

/*
 * POST /api/booking — read a booking confirmation (pasted email text and/or
 * screenshots: Agoda, Booking.com, Trip.com, airlines, Korail…) and return
 * structured bookings. Hotels, stations and airports are looked up on the map
 * so the 行程 can start from the hotel and route to the station.
 */

const MAX_IMAGES = 4;
const MAX_IMAGE_B64 = 2_000_000;

const POINT = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING', description: '简体中文名称，例如 仁川机场、首尔站、釜山站' },
    code: { type: 'STRING', description: '机场三字码（ICN、KUL）；车站留空' },
    search_query: { type: 'STRING', description: '拿去地图搜索的关键字，用当地语言，例如「인천국제공항 제1여객터미널」「서울역」' },
  },
  required: ['name', 'code', 'search_query'],
};

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    bookings: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          kind: { type: 'STRING', enum: ['flight', 'hotel', 'train', 'other'] },
          title: { type: 'STRING', description: '酒店名称（简体中文，或原名）；机票/车票写简短说明，例如「吉隆坡→仁川」' },
          number: { type: 'STRING', description: '航班号或车次，例如 KE 672、KTX 101；酒店留空' },
          ref: { type: 'STRING', description: '订单号 / 确认号 / PNR' },
          start_date: { type: 'STRING', description: 'YYYY-MM-DD：出发日 / 入住日（当地日期）' },
          start_time: { type: 'STRING', description: 'HH:MM 24 小时制：起飞 / 开车 / 入住时间（当地时间）；不知道留空' },
          end_date: { type: 'STRING', description: 'YYYY-MM-DD：抵达日 / 退房日' },
          end_time: { type: 'STRING', description: 'HH:MM：抵达 / 退房时间；不知道留空' },
          from: POINT,
          to: POINT,
          address: { type: 'STRING', description: '酒店地址（照原文）' },
          hotel_search_query: { type: 'STRING', description: '酒店拿去地图搜索的关键字，用当地语言' },
          city: { type: 'STRING', description: '酒店所在城市，简体中文' },
          country: { type: 'STRING', description: '国家，简体中文' },
          seats: { type: 'STRING', description: '座位 / 车厢 / 房型，例如「4 号车厢 12A 12B」「豪华双人房」' },
          note: { type: 'STRING', description: '其他重点（行李额度、早餐、取消期限），简体中文 40 字内' },
        },
        // Everything required (empty string when unknown): the lite model skips optional fields.
        required: ['kind', 'title', 'number', 'ref', 'start_date', 'start_time', 'end_date', 'end_time', 'from', 'to', 'address', 'hotel_search_query', 'city', 'country', 'seats', 'note'],
      },
    },
  },
  required: ['bookings'],
};

function prompt({ text, regions, year, imageCount }) {
  return `这是旅客贴上来的订单确认（机票、酒店、火车 / 高铁）。请把每一张订单整理出来。
这次旅行去：${regions.join('、') || '（未指定）'}；旅行大约在 ${year} 年。
${imageCount ? `附上 ${imageCount} 张订单截图，请仔细读图上的文字。\n` : ''}${text ? `订单内容：\n"""\n${text}\n"""\n` : ''}
规则：
- 每一段航班、每一间酒店、每一张车票各列一笔。来回机票就是两笔。
- 日期一律 YYYY-MM-DD，时间 HH:MM（24 小时制，当地时间）。年份没写就按旅行年份。
- 酒店：start = 入住，end = 退房。
- 看不出来的栏位留空字符串，不要编。酒店的 from / to 填空的名字。
- 航班 / 车票：from = 出发地，to = 目的地，number 写航班号或车次，seats 写车厢座位。
- 所有中文用简体。`;
}

const ymd = (s) => (/^\d{4}-\d{2}-\d{2}$/.test(s || '') ? s : '');
const hm = (s) => { const m = String(s || '').match(/^(\d{1,2}):(\d{2})/); return m ? `${m[1].padStart(2, '0')}:${m[2]}` : ''; };

async function point(p, country) {
  if (!p?.name) return null;
  const out = { name: String(p.name).slice(0, 40), code: String(p.code || '').toUpperCase().slice(0, 4) };
  const hit = await locate({ name: out.name, query: p.search_query || '', country }).catch(() => null);
  return hit ? { ...out, address: hit.address || '', lat: hit.lat, lng: hit.lng } : out;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!process.env.GEMINI_API_KEY) return res.status(500).json({ error: '服务器没有设定 GEMINI_API_KEY' });
  if (!(await signedIn(req))) return res.status(401).json({ error: '请先登录' });
  const b = await readJson(req);
  const text = typeof b?.text === 'string' ? b.text.slice(0, 6000) : '';
  const regions = Array.isArray(b?.regions) ? b.regions.filter((r) => typeof r === 'string').slice(0, 10) : [];
  const year = /^\d{4}$/.test(String(b?.year || '')) ? b.year : new Date().getFullYear();
  const images = (Array.isArray(b?.images) ? b.images : [])
    .filter((i) => i && i.media_type === 'image/jpeg' && typeof i.data === 'string' && i.data.length <= MAX_IMAGE_B64)
    .slice(0, MAX_IMAGES);
  if (!text && !images.length) return res.status(400).json({ error: '没有内容可以读' });

  try {
    const out = await askGeminiJSON({
      parts: [
        ...images.map((img) => ({ inline_data: { mime_type: img.media_type, data: img.data } })),
        { text: prompt({ text, regions, year, imageCount: images.length }) },
      ],
      schema: SCHEMA,
      temperature: 0.1,
    });
    const list = (Array.isArray(out?.bookings) ? out.bookings : []).slice(0, 10);
    const bookings = await Promise.all(list.map(async (x) => {
      const kind = ['flight', 'hotel', 'train'].includes(x.kind) ? x.kind : 'other';
      const country = x.country || '';
      const base = {
        kind, title: String(x.title || '').slice(0, 60), number: String(x.number || '').slice(0, 20), ref: String(x.ref || '').slice(0, 40),
        startDate: ymd(x.start_date), startTime: hm(x.start_time), endDate: ymd(x.end_date), endTime: hm(x.end_time),
        seats: String(x.seats || '').slice(0, 60), note: String(x.note || '').slice(0, 80), from: null, to: null, place: null,
      };
      if (kind === 'hotel') {
        const hit = await locate({ name: base.title, query: x.hotel_search_query || x.address || '', region: x.city || '', country }).catch(() => null);
        base.place = { name: base.title, address: hit?.address || x.address || '', ...(hit ? { lat: hit.lat, lng: hit.lng } : {}) };
      } else if (kind === 'flight' || kind === 'train') {
        [base.from, base.to] = await Promise.all([point(x.from, country), point(x.to, country)]);
      }
      return base;
    }));
    return res.status(200).json({ bookings });
  } catch (e) {
    console.error(e);
    return res.status(e.status || 500).json({ error: e.message || '服务器出错' });
  }
}
