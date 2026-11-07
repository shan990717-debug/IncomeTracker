import { parseShare } from './parse';
import { templateTasks } from './prep';

// Demo trip so the first open shows how everything fits together.
// "重置示例" in the trip menu restores it; deleting the trip removes it.

const SHARES = [
  { text: '弘大这家烤肉真的绝了🔥 五花肉+大酱汤 一定要排队 #首尔美食 #弘大 https://www.instagram.com/reel/demo1', starred: true },
  { text: '📍圣水洞排队贝果店\n首尔圣水必吃 早点去不然卖光 复制本条信息，打开【小红书】App查看精彩内容！ http://xhslink.com/demo2' },
  { text: '景福宫穿韩服拍照攻略 穿韩服免门票✨ 钟路 https://www.tiktok.com/@demo/video/3', at: [37.5796, 126.9770] },
  { text: '广藏市场 绿豆煎饼+生拌牛肉 首尔东大门附近 https://youtu.be/demo4', starred: true, at: [37.5700, 126.9996] },
  { text: '汉江公园野餐+便利店拉面 汝矣岛 夜景超美 https://www.instagram.com/p/demo5' },
  { text: '首尔汗蒸幕体验 搓澡+烤鸡蛋 明洞 https://xhslink.com/demo6' },
  { text: '海云台天空胶囊小火车🚃 日落时段一定要提前订 釜山 https://www.instagram.com/reel/demo7', starred: true },
  { text: '📍广安里海边咖啡厅\n看广安大桥夜景 釜山 cafe https://xhslink.com/demo8' },
  { text: '甘川洞文化村 釜山的圣托里尼 打卡 https://www.tiktok.com/@demo/video/9', at: [35.0975, 129.0106] },
  { text: '札嘎其市场 现点海鲜 南浦洞 https://youtu.be/demo10', at: [35.0966, 129.0306] },
  { text: '西面猪肉汤饭 釜山必吃 早餐 https://www.instagram.com/p/demo11' },
  { text: '城山日出峰 济州必去 看日出 https://www.instagram.com/p/demo12', at: [33.4590, 126.9426] },
  { text: '牛岛骑电动车环岛+花生冰淇淋 济州 https://xhslink.com/demo13' },
  { text: '济州黑猪肉烤肉 西归浦 https://www.tiktok.com/@demo/video/14', starred: true },
  { text: '涯月海边咖啡厅 济州 https://www.instagram.com/p/demo15' },
  { text: 'Olive Young 明洞旗舰店 必买清单 首尔 https://xhslink.com/demo16' },
];

export function seedState(uid) {
  const trip = {
    id: uid(),
    name: '韩国冬日之旅',
    startDate: '2026-12-18',
    endDate: '2026-12-27',
    regions: ['首尔', '釜山', '济州岛'],
    dismissedAuto: [],
    createdAt: Date.now(),
  };

  const saves = SHARES.map((s, i) => ({
    id: uid(),
    tripId: trip.id,
    ...parseShare(s.text, trip.regions),
    starred: !!s.starred,
    ...(s.at ? { lat: s.at[0], lng: s.at[1], geo: 'manual' } : {}),
    done: false,
    rating: 0,
    review: '',
    createdAt: Date.now() - i * 60000,
  }));
  const byTitle = (part) => saves.find((s) => s.title.includes(part));

  const lodgings = [
    { id: uid(), tripId: trip.id, name: '弘大站附近民宿', region: '首尔', area: '弘大', checkIn: '2026-12-18', checkOut: '2026-12-22' },
    { id: uid(), tripId: trip.id, name: '海云台海景酒店', region: '釜山', area: '海云台', checkIn: '2026-12-22', checkOut: '2026-12-25' },
    { id: uid(), tripId: trip.id, name: '西归浦民宿', region: '济州岛', area: '西归浦', checkIn: '2026-12-25', checkOut: '2026-12-27' },
  ];

  const mk = (date, time, title, extra = {}) => ({
    id: uid(), tripId: trip.id, date, time, title, kind: 'place', region: '', area: '', note: '',
    important: false, remindMin: 30, done: false, rating: 0, review: '', ...extra,
  });
  const fromSave = (date, time, save, extra = {}) =>
    save && mk(date, time, save.title, { kind: save.category, saveId: save.id, region: save.region, area: save.area, ...extra });

  const items = [
    mk('2026-12-18', '07:10', '航班 出发 → 仁川 ICN', { kind: 'flight', region: '首尔', important: true, remindMin: 180, note: '提前 3 小时到机场' }),
    mk('2026-12-18', '15:00', 'AREX 机场快线到弘大', { kind: 'transport', region: '首尔', area: '弘大' }),
    mk('2026-12-18', '16:00', '民宿 check-in', { kind: 'note', region: '首尔', area: '弘大', important: true, remindMin: 30 }),
    fromSave('2026-12-18', '19:00', byTitle('烤肉')),
    fromSave('2026-12-19', '10:00', byTitle('景福宫')),
    fromSave('2026-12-19', '12:30', byTitle('广藏市场')),
    mk('2026-12-22', '09:30', 'KTX 首尔站 → 釜山站', { kind: 'transport', region: '釜山', important: true, remindMin: 60, note: '首尔站提前 30 分钟到' }),
    fromSave('2026-12-23', '16:00', byTitle('小火车'), { important: true, remindMin: 60 }),
    mk('2026-12-25', '11:00', '航班 釜山 → 济州', { kind: 'flight', region: '济州岛', important: true, remindMin: 120 }),
    mk('2026-12-25', '13:00', '济州机场取租车', { kind: 'transport', region: '济州岛', note: '带护照 + 国际驾照' }),
    mk('2026-12-27', '18:00', '航班 济州 → 回家', { kind: 'flight', region: '济州岛', important: true, remindMin: 180 }),
  ].filter(Boolean);

  const tasks = templateTasks(trip).map((t) => ({ id: uid(), tripId: trip.id, done: false, ...t }));
  // A couple already done so progress is visible.
  tasks.filter((t) => ['tpl:passport', 'tpl:insurance'].includes(t.autoKey)).forEach((t) => (t.done = true));

  return { activeTripId: trip.id, trips: [trip], saves, lodgings, items, tasks };
}
