import { parseShare } from './parse';

// Demo data so the first open shows how the 攻略库 and checklist look.
// "重置示例" in the trip menu restores it; deleting the trip removes it.

const SHARES = [
  { text: '弘大这家烤肉真的绝了🔥 五花肉+大酱汤 一定要排队 #首尔美食 #弘大 https://www.instagram.com/reel/demo1', starred: true },
  { text: '📍圣水洞排队贝果店\n首尔圣水必吃 早点去不然卖光 复制本条信息，打开【小红书】App查看精彩内容！ http://xhslink.com/demo2' },
  { text: '景福宫穿韩服拍照攻略 穿韩服免门票✨ 钟路 https://www.tiktok.com/@demo/video/3' },
  { text: '广藏市场 绿豆煎饼+生拌牛肉 首尔东大门附近 https://youtu.be/demo4', starred: true },
  { text: '汉江公园野餐+便利店拉面 汝矣岛 夜景超美 https://www.instagram.com/p/demo5' },
  { text: '首尔汗蒸幕体验 搓澡+烤鸡蛋 明洞 https://xhslink.com/demo6' },
  { text: '海云台天空胶囊小火车🚃 日落时段一定要提前订 釜山 https://www.instagram.com/reel/demo7', starred: true },
  { text: '📍广安里海边咖啡厅\n看广安大桥夜景 釜山 cafe https://xhslink.com/demo8' },
  { text: '甘川洞文化村 釜山的圣托里尼 打卡 https://www.tiktok.com/@demo/video/9' },
  { text: '札嘎其市场 现点海鲜 南浦洞 https://youtu.be/demo10' },
  { text: '西面猪肉汤饭 釜山必吃 早餐 https://www.instagram.com/p/demo11' },
  { text: '城山日出峰 济州必去 看日出 https://www.instagram.com/p/demo12' },
  { text: '牛岛骑电动车环岛+花生冰淇淋 济州 https://xhslink.com/demo13' },
  { text: '济州黑猪肉烤肉 西归浦 https://www.tiktok.com/@demo/video/14', starred: true },
  { text: '涯月海边咖啡厅 济州 https://www.instagram.com/p/demo15' },
  { text: 'Olive Young 明洞旗舰店 必买清单 首尔 https://xhslink.com/demo16' },
];

// Rough coordinates so 按距离 works in the demo.
const COORDS = {
  弘大: [37.5563, 126.9236], 圣水: [37.5445, 127.056], 钟路: [37.5796, 126.977], 东大门: [37.57, 126.9996],
  汝矣岛: [37.526, 126.9246], 明洞: [37.5636, 126.985], 海云台: [35.1587, 129.1604], 广安里: [35.1532, 129.1187],
  甘川洞: [35.0975, 129.0106], 南浦洞: [35.0966, 129.0306], 西面: [35.1577, 129.0596], 城山: [33.459, 126.9426],
  西归浦: [33.253, 126.56], 涯月: [33.462, 126.331],
};

export function seedState(uid) {
  const trip = {
    id: uid(),
    name: '韩国冬日之旅',
    startDate: '2026-12-18',
    endDate: '2026-12-27',
    regions: ['首尔', '釜山', '济州岛'],
    dismissedAuto: [],
  };
  const saves = SHARES.map((s, i) => {
    const d = parseShare(s.text, trip.regions);
    const c = COORDS[d.area];
    const jitter = ((i * 37) % 11) / 4000; // keep demo pins from stacking
    return {
      id: uid(), tripId: trip.id, ...d, raw: s.text, unsure: false,
      ...(c ? { lat: c[0] + jitter, lng: c[1] - jitter, geo: 'manual' } : {}),
      createdAt: Date.now() - i * 60000,
    };
  });
  // One 避雷 place and a few 须知 so trial mode shows everything.
  saves.push({
    id: uid(), tripId: trip.id, title: '广藏市场', nameLocal: '광장시장', region: '首尔', area: '钟路', category: 'food',
    subtype: '小吃', verdict: 'avoid', verdictReason: '价格乱喊，排队不值得', platform: '小红书', url: 'http://xhslink.com/demo-avoid',
    lat: 37.57, lng: 126.9996, geo: 'manual', note: '', unsure: false, createdAt: Date.now(),
  });
  const src = (title) => [{ url: 'http://xhslink.com/demo-tips', platform: '小红书', title }];
  const tip = (t) => ({ id: uid(), tripId: trip.id, points: [], country: '韩国', cities: [], needsAllCities: false, nationalities: [], isAction: true, personal: false, offsetDays: null, offsetFromPost: false, sources: [], doneBy: [], createdAt: Date.now(), ...t });
  const tips = [
    tip({ title: '申请 K-ETA', type: 'entry', personal: true, nationalities: ['马来西亚'], offsetDays: -30, points: ['官网 k-eta.go.kr 申请，小心代办网站', '大概 3 天批'], sources: src('马来西亚人去韩国入境攻略') }),
    tip({ title: '填电子入境卡 e-Arrival', type: 'entry', personal: true, offsetDays: -3, offsetFromPost: true, points: ['抵达前 3 天内可在线填'] }),
    tip({ title: 'KTX 首尔→釜山 提前一个月订', type: 'booking', cities: ['首尔', '釜山'], needsAllCities: true, offsetDays: -30, offsetFromPost: true, points: ['Korail 官网 / Korail Talk 出发前 1 个月开放', '周末很快卖完'], sources: src('釜山 3 天攻略｜交通全攻略') }),
    tip({ title: '买 Visit Busan Pass', type: 'transport', cities: ['釜山'], offsetDays: -3, points: ['24 小时版够跑海云台一天'] }),
    tip({ title: '传统市场备好现金', type: 'money', offsetDays: -7, points: ['传统市场大多只收现金'] }),
    tip({ title: '首尔地铁换乘用 Naver Map 看出口号', type: 'transport', cities: ['首尔'], isAction: false, points: ['Google Maps 在韩国导航不准'] }),
    tip({ title: '济州岛租车要国际驾照', type: 'transport', cities: ['济州岛'], offsetDays: -21, points: ['没有 IDP 不能租车'] }),
  ];

  // A sample first day in 行程, plus one place waiting in 待安排.
  const byArea = (a) => saves.find((x) => x.area === a && x.verdict !== 'avoid');
  [['弘大', 1, 'lunch'], ['汝矣岛', 2, ''], ['明洞', 3, '']].forEach(([a, order, meal]) => {
    const x = byArea(a);
    if (x) Object.assign(x, { inPlan: true, planDay: trip.startDate, planOrder: order, planMeal: meal });
  });
  const later = byArea('圣水');
  if (later) Object.assign(later, { inPlan: true, planDay: '' });
  const planDays = [{
    id: `${trip.id}|${trip.startDate}`, tripId: trip.id, day: trip.startDate,
    startPlace: { name: '弘大 L7 酒店', address: '서울 마포구 양화로 141', lat: 37.5569, lng: 126.9245 }, endPlace: null,
    startTime: '11:00', endTime: '21:00', lunch: '12:00-13:30', dinner: '18:00-19:30', legs: [], summary: '', plannedAt: null,
  }];

  return { activeTripId: trip.id, trips: [trip], saves, tips, planDays };
}
