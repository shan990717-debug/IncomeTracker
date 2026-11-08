/*
 * Find where a place actually is.
 *   Korea  → Kakao Local keyword search (best coverage of Korean shops; needs KAKAO_REST_API_KEY)
 *   other  → OpenStreetMap Nominatim (free, no key; good for sights, weaker for small shops)
 * Returns { lat, lng, address, placeUrl, kakaoCategory, source } or null.
 * Base URLs can be overridden by env for testing.
 */

const KAKAO = process.env.KAKAO_BASE_URL || 'https://dapi.kakao.com';
const OSM = process.env.OSM_BASE_URL || 'https://nominatim.openstreetmap.org';

// Never let a slow map service hold up the whole request.
const timed = (ms) => ({ signal: AbortSignal.timeout(ms) });

const KR_CITIES = ['首尔', '釜山', '济州', '济州岛', '庆州', '江陵', '仁川', '大邱', '大田', '光州', '全州', '水原', '束草', '统营', '丽水'];
const HANGUL = /[가-힣]/;

export function inKorea({ country = '', region = '', nameLocal = '' }) {
  return /韩国|韓國|korea|^kr$|대한민국/i.test(country) || KR_CITIES.some((c) => region.includes(c)) || HANGUL.test(nameLocal);
}

async function kakao(query) {
  const key = process.env.KAKAO_REST_API_KEY;
  if (!key || !query) return null;
  const r = await fetch(`${KAKAO}/v2/local/search/keyword.json?size=1&query=${encodeURIComponent(query)}`, {
    headers: { Authorization: `KakaoAK ${key}` }, ...timed(5000),
  });
  if (!r.ok) return null;
  const d = (await r.json()).documents?.[0];
  if (!d) return null;
  return {
    lat: Number(d.y), lng: Number(d.x),
    address: d.road_address_name || d.address_name || '',
    placeUrl: d.place_url || '',
    kakaoCategory: d.category_name || '',
    matchedName: d.place_name || '',
    source: 'kakao',
  };
}

// Nominatim asks for at most 1 request/second and an identifying User-Agent,
// so OSM calls go through a queue spaced ~1.1 s apart even when places are
// looked up in parallel.
let osmQueue = Promise.resolve();
let lastOsm = 0;
function osm(query) {
  if (!query) return Promise.resolve(null);
  const run = async () => {
    const wait = 1100 - (Date.now() - lastOsm);
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastOsm = Date.now();
    const r = await fetch(`${OSM}/search?format=jsonv2&limit=1&accept-language=zh-CN,en&q=${encodeURIComponent(query)}`, {
      headers: { 'User-Agent': 'tripaa/0.1 (personal trip guide app)' }, ...timed(6000),
    });
    if (!r.ok) return null;
    const d = (await r.json())[0];
    if (!d) return null;
    return { lat: Number(d.lat), lng: Number(d.lon), address: d.display_name || '', placeUrl: '', kakaoCategory: '', matchedName: d.name || '', source: 'osm' };
  };
  const result = osmQueue.then(run, run);
  osmQueue = result.catch(() => null);
  return result;
}

/** Try a few queries from most to least specific; first hit wins. */
export async function locate({ name = '', nameLocal = '', query = '', area = '', region = '', country = '' }) {
  const korea = inKorea({ country, region, nameLocal });
  const queries = [...new Set([
    query,
    nameLocal && area ? `${nameLocal} ${area}` : '',
    nameLocal,
    name && region ? `${name} ${region}` : '',
  ].filter(Boolean))];
  const started = Date.now();
  for (const q of queries) {
    if (Date.now() - started > 12000) break; // give up on this place, keep the request moving
    try {
      const hit = korea ? (await kakao(q).catch(() => null)) || (await osm(q)) : await osm(q);
      if (hit && Number.isFinite(hit.lat) && Number.isFinite(hit.lng)) return hit;
    } catch (e) {
      console.error('locate failed', q, e.message);
    }
  }
  return null;
}

/** Search for a point to measure distance from (e.g. the hotel). Returns up to 5 results. */
export async function searchPoints(query, korea) {
  const out = [];
  try {
    const key = process.env.KAKAO_REST_API_KEY;
    if (korea && key) {
      const r = await fetch(`${KAKAO}/v2/local/search/keyword.json?size=5&query=${encodeURIComponent(query)}`, { headers: { Authorization: `KakaoAK ${key}` }, ...timed(6000) });
      if (r.ok) for (const d of (await r.json()).documents || []) out.push({ name: d.place_name, address: d.road_address_name || d.address_name, lat: Number(d.y), lng: Number(d.x) });
    }
    if (!out.length) {
      const r = await fetch(`${OSM}/search?format=jsonv2&limit=5&accept-language=zh-CN,en&q=${encodeURIComponent(query)}`, { headers: { 'User-Agent': 'tripaa/0.1 (personal trip guide app)' }, ...timed(6000) });
      if (r.ok) for (const d of await r.json()) out.push({ name: d.name || d.display_name.split(',')[0], address: d.display_name, lat: Number(d.lat), lng: Number(d.lon) });
    }
  } catch (e) {
    console.error('search failed', e);
  }
  return out;
}

/** Kakao categories ("음식점 > 한식 > 육류,고기") → our 种类, when the AI gave none. */
const KAKAO_SUBTYPES = [
  [/육류|고기|갈비|삼겹|곱창|막창|구이/, '烤肉'],
  [/해물|생선|회|조개|게|대게|장어/, '海鲜'],
  [/치킨|닭강정/, '炸鸡'],
  [/찌개|전골|샤브|부대/, '火锅'],
  [/카페|디저트|베이커리|제과|아이스크림|떡/, '咖啡甜点'],
  [/일식|초밥|돈까스|라멘|우동/, '日料'],
  [/국수|냉면|칼국수|면/, '面食'],
  [/술집|호프|포장마차|와인|칵테일|바$/, '酒馆'],
  [/분식|떡볶이|김밥/, '小吃'],
  [/한식|국밥|백반|해장국|설렁탕|삼계탕/, '韩式家常'],
  [/양식|이탈리안|피자|햄버거|스테이크/, '西餐'],
];
export function subtypeFromKakao(cat = '') {
  return KAKAO_SUBTYPES.find(([re]) => re.test(cat))?.[1] || '';
}
