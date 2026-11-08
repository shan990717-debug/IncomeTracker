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
  return { activeTripId: trip.id, trips: [trip], saves };
}
