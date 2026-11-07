import { shiftDate } from './dates';

export const TASK_GROUPS = [
  { id: 'docs', label: '证件入境', emoji: '🛂' },
  { id: 'transport', label: '交通', emoji: '🚄' },
  { id: 'connect', label: '上网通讯', emoji: '📶' },
  { id: 'booking', label: '预订', emoji: '🎟️' },
  { id: 'money', label: '钱', emoji: '💳' },
  { id: 'packing', label: '行李', emoji: '🧳' },
  { id: 'other', label: '其他', emoji: '📝' },
];

/**
 * Preparation templates for a Korea trip. `when(regions)` decides if a task
 * applies; `offset` is days relative to departure (negative = before).
 * Rules change — the notes say what to double-check, not legal advice.
 */
const TEMPLATES = [
  { key: 'passport', group: 'docs', title: '护照有效期至少剩 6 个月', offset: -45 },
  {
    key: 'keta', group: 'docs', title: '确认是否需要 K-ETA，需要就提前申请', offset: -30,
    note: '各国规定不同，以官网为准。只认官网，小心代办收费网站。', link: 'https://www.k-eta.go.kr',
  },
  {
    key: 'earrival', group: 'docs', title: '填写韩国电子入境卡 e-Arrival Card', offset: -3,
    note: '抵达前 3 天内可在线填写，免去飞机上手写。', link: 'https://www.e-arrivalcard.go.kr',
  },
  { key: 'insurance', group: 'docs', title: '买旅游保险', offset: -14 },
  { key: 'esim', group: 'connect', title: '买 eSIM / 上网卡', offset: -7, note: '先确认手机支持 eSIM；出发前装好，落地再开启。' },
  { key: 'apps', group: 'connect', title: '下载 Naver Map、KakaoMap、Kakao T、Papago', offset: -3, note: 'Google Maps 在韩国步行/驾车导航不好用。' },
  {
    key: 'tcard', group: 'transport', title: '准备交通卡（T-money / WOWPASS / Climate Card）', offset: -3,
    note: '可在便利店买 T-money；WOWPASS 可兑换+交通二合一。Climate Card 只在首尔有效。',
  },
  { key: 'airport', group: 'transport', title: '查好机场到住宿的交通（AREX / 机场巴士 / 出租车）', offset: -2 },
  {
    key: 'ktx', group: 'transport', title: '买 KTX 首尔 ⇄ 釜山车票', offset: -30,
    when: (r) => r.includes('首尔') && r.includes('釜山'),
    note: 'Korail 官网/App 通常提前一个月开放，周末与假期很快卖完。也可考虑 Korail Pass。', link: 'https://www.letskorail.com',
  },
  {
    key: 'jejuflight', group: 'transport', title: '订去济州岛的机票', offset: -30,
    when: (r) => r.includes('济州岛') && r.length > 1,
  },
  {
    key: 'jejucar', group: 'transport', title: '济州租车 + 国际驾照（IDP）', offset: -21,
    when: (r) => r.includes('济州岛'), note: '济州公共交通班次少，多数人会租车。没有 IDP 不能租。',
  },
  {
    key: 'skycapsule', group: 'booking', title: '预订海云台天空胶囊小火车', offset: -14,
    when: (r) => r.includes('釜山'), note: '热门时段（日落）很快订满，建议提前在官网订。', link: 'https://www.bluelinepark.com',
  },
  { key: 'restaurants', group: 'booking', title: '热门餐厅提前用 Catchtable / Naver 预约', offset: -14 },
  { key: 'hotel', group: 'booking', title: '再次确认每晚住宿 & 入住时间', offset: -7 },
  { key: 'cash', group: 'money', title: '换韩元 / 准备多币种卡', offset: -7, note: '传统市场和路边摊多数只收现金。' },
  { key: 'adapter', group: 'packing', title: '带转换插头（韩国 220V，C/F 型圆脚）', offset: -1 },
];

/** Tasks a new trip should start with, given its regions. */
export function templateTasks(trip) {
  const regions = trip.regions || [];
  return TEMPLATES.filter((t) => !t.when || t.when(regions)).map((t) => ({
    autoKey: `tpl:${t.key}`,
    group: t.group,
    title: t.title,
    note: t.note || '',
    link: t.link || '',
    dueDate: trip.startDate ? shiftDate(trip.startDate, t.offset) : '',
  }));
}

/** Time buckets for the checklist: what matters is *when* to do it. */
export const BUCKETS = [
  { id: 'month', label: '出发前 1 个月以上', test: (d) => d <= -28 },
  { id: 'weeks', label: '出发前 1–4 周', test: (d) => d > -28 && d <= -7 },
  { id: 'week', label: '出发前一周内', test: (d) => d > -7 && d < 0 },
  { id: 'arrive', label: '出发当天 / 到当地', test: (d) => d >= 0 },
];

/** Bucket for a task given departure date; tasks without a date go last. */
export function bucketOf(task, startDate) {
  if (!task.dueDate || !startDate) return 'nodate';
  const d = Math.round((new Date(task.dueDate) - new Date(startDate)) / 86400000);
  return BUCKETS.find((b) => b.test(d))?.id || 'nodate';
}

/** Turn an AI "days before departure" hint into a due date. */
export function dueFromOffset(startDate, offset) {
  if (!startDate || !Number.isFinite(offset)) return '';
  return shiftDate(startDate, Math.max(-90, Math.min(14, Math.round(offset))));
}
