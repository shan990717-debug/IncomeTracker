import { locate, searchPoints } from '../server/places.js';
import { signedIn, readJson } from '../server/http.js';

/*
 * POST /api/locate
 *   { mode: 'place', name, nameLocal, query, area, region, country } → { place } (best match for a saved place)
 *   { mode: 'search', query, korea }                                → { results: [...] } (pick a point, e.g. the hotel)
 */
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!(await signedIn(req))) return res.status(401).json({ error: '请先登录' });
  const b = (await readJson(req)) || {};
  const str = (v) => (typeof v === 'string' ? v.slice(0, 200) : '');
  if (b.mode === 'search') {
    if (!str(b.query)) return res.status(400).json({ error: '没有关键字' });
    return res.status(200).json({ results: await searchPoints(str(b.query), !!b.korea) });
  }
  const place = await locate({
    name: str(b.name), nameLocal: str(b.nameLocal), query: str(b.query), area: str(b.area), region: str(b.region), country: str(b.country),
  });
  return res.status(200).json({ place });
}
