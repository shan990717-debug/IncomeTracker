import { lodgingFor } from './store';
import { shiftDate, toMinutes } from './dates';

/*
 * Rule-based day planner. It never invents places: it only proposes saves you
 * collected, choosing ones in the same region as that night's lodging, starting
 * with the hotel's own area so the day stays walkable, and slotting them into
 * sensible times (sights in the morning, lunch, café, dinner, night spots).
 */

const SLOTS = [
  { time: '10:00', label: '上午', want: ['place', 'experience'] },
  { time: '12:30', label: '午餐', want: ['food'], meal: true },
  { time: '14:30', label: '下午', want: ['experience', 'place', 'shopping'] },
  { time: '16:30', label: '下午茶', want: ['food'], cafe: true },
  { time: '19:00', label: '晚餐', want: ['food'], meal: true },
  { time: '20:30', label: '夜晚', want: ['shopping', 'place', 'experience'] },
];

const CAFE_RE = /咖啡|cafe|café|coffee|카페|甜|dessert|bakery|面包|贝果|빵|冰淇淋/i;

/** Ways to get between regions, used when the lodging region changes. */
function transferFor(from, to) {
  const pair = [from, to].sort().join('|');
  if (pair === ['首尔', '釜山'].sort().join('|')) return { title: `KTX ${from} → ${to}`, kind: 'transport', note: '约 2.5–3 小时，记得提前买票' };
  if (from === '济州岛' || to === '济州岛') return { title: `航班 ${from} → ${to}`, kind: 'flight', note: '国内线约 1 小时，提前 1.5 小时到机场' };
  return { title: `${from} → ${to}`, kind: 'transport', note: '' };
}

export function suggestDay({ date, lodgings, items, saves }) {
  const tonight = lodgingFor(lodgings, date);
  const lastNight = lodgingFor(lodgings, shiftDate(date, -1));
  const dayItems = items.filter((i) => i.date === date);
  const region = tonight?.region || lastNight?.region || dayItems.find((i) => i.region)?.region || '';
  const out = [];

  // Moving between regions today → put the transfer in first.
  const moving = lastNight && tonight && lastNight.region !== tonight.region && lastNight.checkOut === date;
  if (moving && !dayItems.some((i) => i.kind === 'transport' || i.kind === 'flight')) {
    out.push({ key: 'transfer', time: '09:00', draft: { ...transferFor(lastNight.region, tonight.region), region: tonight.region, important: true, remindMin: 60 }, reason: `今晚住${tonight.region}，需要移动` });
  }

  if (!region) return { region, lodging: tonight, suggestions: out, hint: '先填这天的住宿，才能按区域推荐' };

  const scheduled = new Set(items.map((i) => i.saveId).filter(Boolean));
  let pool = saves.filter((s) => s.region === region && !scheduled.has(s.id) && !s.done);
  if (!pool.length) return { region, lodging: tonight, suggestions: out, hint: `${region}的收藏都安排好了` };

  // Anchor area: hotel's area if we saved anything there, else the busiest area.
  const counts = {};
  pool.forEach((s) => s.area && (counts[s.area] = (counts[s.area] || 0) + 1));
  const hotelArea = tonight?.area || lastNight?.area;
  const anchor = hotelArea && counts[hotelArea] ? hotelArea : Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];

  const score = (s, slot) => {
    let v = 0;
    if (slot.want[0] === s.category) v += 6;
    else if (slot.want.includes(s.category)) v += 3;
    else return -1;
    const cafe = CAFE_RE.test(`${s.title} ${s.note}`);
    if (slot.cafe && !cafe) return -1; // 下午茶 only takes cafés/desserts
    if (slot.meal && CAFE_RE.test(s.title)) return -1; // …and meals never do
    if (s.starred) v += 4;
    if (anchor && s.area === anchor) v += 5;
    return v;
  };

  const reasonOf = (s) => {
    const r = [];
    if (s.area && s.area === hotelArea) r.push(`离住宿近（都在${s.area}）`);
    else if (s.area && s.area === anchor) r.push(`同区顺路：${s.area}`);
    if (s.starred) r.push('你标了 ❤️');
    return r;
  };

  const busy = dayItems.map((i) => toMinutes(i.time)).filter((m) => m < 24 * 60);
  const free = (time) => !busy.some((m) => Math.abs(m - toMinutes(time)) < 75);

  for (const slot of SLOTS) {
    if (!free(slot.time)) continue;
    if (moving && toMinutes(slot.time) < toMinutes('12:30')) continue; // morning spent travelling
    let best = null;
    let bestScore = 0;
    for (const s of pool) {
      const v = score(s, slot);
      if (v > bestScore) {
        best = s;
        bestScore = v;
      }
    }
    if (!best) continue;
    pool = pool.filter((s) => s !== best);
    out.push({
      key: best.id,
      time: slot.time,
      save: best,
      draft: { title: best.title, kind: best.category, saveId: best.id, region: best.region, area: best.area },
      reason: [slot.label, ...reasonOf(best)].join(' · '),
    });
  }

  return { region, lodging: tonight, suggestions: out.sort((a, b) => toMinutes(a.time) - toMinutes(b.time)), hint: '' };
}
