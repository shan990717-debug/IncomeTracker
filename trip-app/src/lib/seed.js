import { parseShare } from './parse';
import { templateTasks } from './prep';

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

  const saves = SHARES.map((s, i) => {
    return {
      id: uid(),
      tripId: trip.id,
      ...parseShare(s.text, trip.regions),
      raw: s.text,
      status: s.starred ? 'going' : 'saved',
      day: '',
      rating: 0,
      review: '',
      createdAt: Date.now() - i * 60000,
    };
  });
  // One already visited so the 去过 state is visible.
  saves[0].status = 'done';
  saves[0].rating = 5;
  saves[0].review = '排了 40 分钟，值得';

  const tasks = templateTasks(trip).map((t) => ({ id: uid(), tripId: trip.id, done: false, ...t }));
  tasks.filter((t) => ['tpl:passport', 'tpl:insurance'].includes(t.autoKey)).forEach((t) => (t.done = true));
  // A tip that came from a saved 攻略 post, to show where it links back.
  tasks.push({
    id: uid(), tripId: trip.id, group: 'transport', title: '买 Visit Busan Pass（釜山景点+交通）', done: false,
    note: '24 小时版够跑海云台一天；包含天空胶囊小火车的折扣。', link: '', dueDate: '2026-12-15',
    sourceUrl: 'http://xhslink.com/demo-busan', sourceTitle: '釜山 3 天攻略｜交通全攻略',
  });

  return { activeTripId: trip.id, trips: [trip], saves, tasks };
}
