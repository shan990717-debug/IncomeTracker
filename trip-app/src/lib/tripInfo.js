import { daysBetween, todayISO } from './dates';

/* Flag from the trip's cities (no extra field to fill in). */
const FLAGS = [
  ['🇰🇷', ['首尔', '釜山', '济州', '庆州', '江陵', '仁川', '大邱', '全州', '束草', '韩国']],
  ['🇯🇵', ['东京', '大阪', '京都', '奈良', '北海道', '札幌', '福冈', '冲绳', '名古屋', '横滨', '神户', '箱根', '日本']],
  ['🇹🇼', ['台北', '台中', '台南', '高雄', '花莲', '垦丁', '九份', '台湾']],
  ['🇭🇰', ['香港']],
  ['🇲🇴', ['澳门']],
  ['🇨🇳', ['北京', '上海', '广州', '深圳', '成都', '重庆', '西安', '杭州', '苏州', '厦门', '桂林', '中国']],
  ['🇹🇭', ['曼谷', '清迈', '普吉', '芭提雅', '泰国']],
  ['🇻🇳', ['河内', '胡志明', '岘港', '会安', '越南']],
  ['🇸🇬', ['新加坡']],
  ['🇲🇾', ['吉隆坡', '槟城', '马六甲', '怡保', '沙巴', '兰卡威', '马来西亚']],
  ['🇮🇩', ['巴厘岛', '雅加达', '印尼']],
  ['🇵🇭', ['宿务', '马尼拉', '长滩岛', '菲律宾']],
  ['🇦🇺', ['悉尼', '墨尔本', '布里斯班', '珀斯', '黄金海岸', '大洋路', '澳洲', '澳大利亚']],
  ['🇳🇿', ['奥克兰', '皇后镇', '新西兰']],
  ['🇬🇧', ['伦敦', '爱丁堡', '英国']],
  ['🇫🇷', ['巴黎', '尼斯', '法国']],
  ['🇮🇹', ['罗马', '米兰', '威尼斯', '佛罗伦萨', '意大利']],
  ['🇺🇸', ['纽约', '洛杉矶', '旧金山', '夏威夷', '美国']],
];

export function tripFlag(trip) {
  const text = `${trip?.name || ''} ${(trip?.regions || []).join(' ')}`;
  return FLAGS.find(([, words]) => words.some((w) => text.includes(w)))?.[0] || '✈️';
}

const COVERS = [
  'from-rose-500 to-blue-500', 'from-red-500 to-orange-500', 'from-sky-500 to-emerald-500',
  'from-violet-500 to-fuchsia-500', 'from-amber-500 to-pink-500', 'from-teal-500 to-indigo-500',
];
/** A stable gradient per trip. */
export function tripCover(trip) {
  const h = [...(trip?.id || '')].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);
  return COVERS[Math.abs(h) % COVERS.length];
}

/**
 * Where we are relative to the trip.
 *   nodate  – no dates yet
 *   before  – { daysLeft }
 *   during  – { day } (1-based) — the overview switches to 旅行中 mode
 *   after   – ended
 */
export function tripPhase(trip, today = todayISO()) {
  if (!trip?.startDate) return { mode: 'nodate' };
  const left = daysBetween(today, trip.startDate);
  if (left > 0) return { mode: 'before', daysLeft: left };
  if (!trip.endDate || daysBetween(today, trip.endDate) >= 0) return { mode: 'during', day: -left + 1 };
  return { mode: 'after' };
}

export function countdownLabel(trip) {
  const p = tripPhase(trip);
  if (p.mode === 'nodate') return '还没定日期';
  if (p.mode === 'during') return `旅行中 · 第 ${p.day} 天`;
  if (p.mode === 'after') return '已结束';
  if (p.daysLeft >= 60) return `还有 ${Math.round(p.daysLeft / 30)} 个月`;
  return `还有 ${p.daysLeft} 天`;
}
