/*
 * Location helpers. A save/lodging gets coordinates from, in order:
 *   1. lat/lng set by AI (web search) or by the user on the map  → precise
 *   2. its area's centre (弘大, 海云台 …), slightly spread out    → approximate
 * Approximate pins are drawn hollow so nobody mistakes them for the door.
 */

// Rough centres of known areas (good to a few hundred metres).
const AREA_COORDS = {
  首尔: {
    弘大: [37.5563, 126.9236], 延南洞: [37.5660, 126.9250], 明洞: [37.5636, 126.9850], 圣水: [37.5445, 127.0560],
    江南: [37.5172, 127.0286], 梨泰院: [37.5345, 126.9946], 钟路: [37.5740, 126.9850], 东大门: [37.5663, 127.0092],
    南山: [37.5512, 126.9882], 蚕室: [37.5133, 127.1001], 汝矣岛: [37.5260, 126.9246],
  },
  釜山: {
    海云台: [35.1587, 129.1604], 广安里: [35.1532, 129.1187], 西面: [35.1577, 129.0596], 南浦洞: [35.0976, 129.0306],
    甘川洞: [35.0975, 129.0106], 影岛: [35.0780, 129.0450], 机张: [35.1883, 129.2233], 松岛: [35.0760, 129.0170],
  },
  济州岛: {
    济州市: [33.4996, 126.5312], 涯月: [33.4620, 126.3310], '咸德/旧左': [33.5430, 126.6690], 城山: [33.4580, 126.9420],
    西归浦: [33.2530, 126.5600], 汉拿山: [33.3617, 126.5292],
  },
};

export const REGION_CENTER = {
  首尔: [37.5665, 126.9780], 釜山: [35.1796, 129.0756], 济州岛: [33.38, 126.55],
  庆州: [35.8562, 129.2247], 江陵: [37.7519, 128.8761],
};

const hash = (s) => [...(s || '')].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);

export const validLatLng = (lat, lng) =>
  Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 && !(lat === 0 && lng === 0);

/** { lat, lng, precise } or null. */
export function coordsOf(x) {
  if (!x) return null;
  if (validLatLng(x.lat, x.lng)) return { lat: x.lat, lng: x.lng, precise: true };
  const c = AREA_COORDS[x.region]?.[x.area];
  if (!c) return null;
  // Deterministic ~150–400 m spread so pins in one area don't stack.
  const h = hash(x.id || x.title);
  const ang = ((h & 0xffff) / 0xffff) * Math.PI * 2;
  const r = 0.0015 + (((h >>> 16) & 0xff) / 0xff) * 0.0025;
  return { lat: c[0] + Math.sin(ang) * r, lng: c[1] + Math.cos(ang) * r * 1.2, precise: false };
}

/** Great-circle distance in km. */
export function km(a, b) {
  if (!a || !b) return null;
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Rough travel hint from straight-line distance (streets add ~30%). */
export function legHint(d) {
  if (d == null) return '';
  const dist = d < 1 ? `${Math.round(d * 1000)} m` : `${d.toFixed(1)} km`;
  if (d <= 1.5) return `${dist} · 步行约 ${Math.max(1, Math.round((d * 1.3 * 60) / 4.5))} 分`;
  if (d <= 25) return `${dist} · 地铁/车约 ${Math.round(10 + d * 1.3 * 2.2)} 分`;
  return `${dist}`;
}

/** Keep AI coordinates only if they land near the claimed region (guards against hallucinated points). */
export function plausible(lat, lng, region) {
  if (!validLatLng(lat, lng)) return false;
  const c = REGION_CENTER[region];
  if (!c) return lat > 33 && lat < 39 && lng > 124 && lng < 132; // somewhere in Korea
  return km({ lat, lng }, { lat: c[0], lng: c[1] }) < 70;
}

const q = (x) => [x.nameLocal || x.title, x.nameLocal ? '' : x.area, x.nameLocal ? '' : x.region].filter(Boolean).join(' ');

/** Deep links. Naver/Kakao know Korean shops far better than Google. */
export function mapLinks(x) {
  const query = encodeURIComponent(q(x));
  const c = validLatLng(x.lat, x.lng) ? x : null;
  const label = encodeURIComponent(x.nameLocal || x.title);
  return {
    naver: `https://map.naver.com/p/search/${query}`,
    kakao: c ? `https://map.kakao.com/link/map/${label},${c.lat},${c.lng}` : `https://map.kakao.com/link/search/${query}`,
    kakaoRoute: c ? `https://map.kakao.com/link/to/${label},${c.lat},${c.lng}` : null,
    google: c ? `https://www.google.com/maps/search/?api=1&query=${c.lat},${c.lng}` : `https://www.google.com/maps/search/?api=1&query=${query}`,
  };
}
