import { detectRegion, areasOf } from './regions';

export const CATEGORIES = [
  { id: 'food', label: '想吃', emoji: '🍜', color: 'bg-orange-100 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300' },
  { id: 'place', label: '想去', emoji: '📸', color: 'bg-sky-100 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300' },
  { id: 'experience', label: '想做', emoji: '✨', color: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300' },
  { id: 'shopping', label: '想买', emoji: '🛍️', color: 'bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300' },
];

export const categoryOf = (id) => CATEGORIES.find((c) => c.id === id) || CATEGORIES[1];

const CATEGORY_KEYWORDS = {
  food: [
    '美食', '好吃', '必吃', '餐厅', '餐廳', '饭店', '烤肉', '炸鸡', '咖啡', 'cafe', 'café', 'coffee', '甜点', '甜品', '面包', '贝果',
    'bakery', '汤饭', '海鲜', '酱蟹', '部队锅', '拉面', '冷面', '刀削面', '韩牛', '烤鳗鱼', '生鱼片', '辣炒年糕', '年糕', '饺子', '炸酱面',
    '参鸡汤', '排骨', '五花肉', '猪肉汤', '牛骨汤', '早午餐', 'brunch', '小吃', '路边摊', '酒馆', '居酒屋', '마차', '포차', '맛집', '식당',
    '카페', '고기', '치킨', '국밥', '빵', '디저트', 'restaurant', 'food', 'eat', 'dessert', '排队', '米其林', 'michelin', '鱼饼', '黑猪肉',
    '橘子', '冰淇淋', '奶茶', 'bbq', '必吃', '炭烤', '牛肠', '烤贝', '烤蛤', '煎饼', '牛肉', '早餐', '晚餐', '午餐', '宵夜',
  ],
  experience: [
    '体验', '體驗', '韩服', '汗蒸', '搓澡', '찜질방', '人生四格', '四格', '拍照馆', '自拍馆', 'photo booth', '浮潜', '潜水', '冲浪', '骑马',
    '滑雪', '课程', 'class', 'diy', '手作', '演唱会', '音乐剧', '小火车', '天空胶囊', '缆车', '游船', '游艇', 'yacht', '观光巴士', 'spa',
    '皮肤管理', '头皮', '美发', '做头发', '个人色彩', '蹦极', '卡丁车', '采摘', '摘橘子', '烧酒', '射箭', '体验馆', '主题乐园', '乐天世界',
    '游乐园', 'workshop', '체험', '해변열차', '스카이캡슐', '热气球', '徒步', '登山', 'hiking', '环岛', '骑车', '电动车', '野餐',
  ],
  shopping: [
    '购物', '必买', 'olive young', 'oliveyoung', '奥利巴', '免税', '免稅', '商场', '百货', '百貨', '地下商街', 'outlet', '奥特莱斯', '文具',
    '美妆', '护肤', '衣服', '服饰', '市集', 'pop-up', 'popup', '快闪', '买', '쇼핑', '다이소', 'daiso', '大创', '眼镜', '香水', '买手店',
    'select shop', '中古',
  ],
  place: [
    // No single characters like 山/村/宫 here: they hit region names (釜山, 汉拿山).
    '景点', '打卡', '海边', '海滩', '公园', '宫殿', '景福宫', '昌德宫', '首尔塔', '文化村', '韩屋村', '寺庙', '爬山', '瀑布', '展览', '博物馆',
    '美术馆', '夜景', '日落', '日出', 'view', '观景台', '步道', '大桥', '图书馆', '书店', '花海', '樱花', '枫叶', '雪景', '灯光',
    'museum', 'beach', 'park',
  ],
};

export function detectCategory(text) {
  const t = (text || '').toLowerCase();
  let best = 'place';
  let bestScore = 0;
  for (const [cat, words] of Object.entries(CATEGORY_KEYWORDS)) {
    const score = words.reduce((s, w) => (t.includes(w.toLowerCase()) ? s + (w.length >= 3 ? 2 : 1) : s), 0);
    // Ties go to the more specific categories (food/experience/shopping beat place).
    if (score > bestScore) {
      best = cat;
      bestScore = score;
    }
  }
  return best;
}

export const PLATFORMS = [
  { id: 'xhs', label: '小红书', match: /xhslink\.com|xiaohongshu\.com|小红书/i },
  { id: 'instagram', label: 'Instagram', match: /instagram\.com|instagr\.am/i },
  { id: 'tiktok', label: 'TikTok', match: /tiktok\.com/i },
  { id: 'douyin', label: '抖音', match: /douyin\.com|抖音/i },
  { id: 'youtube', label: 'YouTube', match: /youtube\.com|youtu\.be/i },
  { id: 'facebook', label: 'Facebook', match: /facebook\.com|fb\.watch|fb\.com/i },
  { id: 'threads', label: 'Threads', match: /threads\.net|threads\.com/i },
  { id: 'naver', label: 'Naver', match: /naver\.(com|me)/i },
  { id: 'gmaps', label: 'Google Maps', match: /maps\.app\.goo\.gl|google\.[a-z.]+\/maps|goo\.gl\/maps/i },
];

export const detectPlatform = (text) => PLATFORMS.find((p) => p.match.test(text || ''))?.label || '';

const URL_RE = /https?:\/\/[^\s，。！？、）)】」"'<>]+/gi;

// Boilerplate that share sheets add around the real content.
const NOISE = [
  /复制本条信息[^\n!！]*[!！]?/g,
  /打开【?小红书】?\s*App\s*查看[^\n!！]*[!！]?/gi,
  /复制(?:此链接|打开抖音)[^\n!！]*[!！]?/g,
  /\d+\.\d+ [A-Za-z]{2,4}:\/ /g,
  /看看.{0,10}的视频/g,
  /\[[^\]]{1,6}R\]/g, // 小红书 emoji codes like [赞R]
];

function cleanText(raw) {
  let t = raw.replace(URL_RE, ' ');
  for (const n of NOISE) t = t.replace(n, ' ');
  return t.replace(/[ \t]+/g, ' ').trim();
}

function extractTitle(text) {
  // 1) Pin line: "📍店名" / "地址：xxx" — share captions usually name the spot here.
  const pin = text.match(/📍\s*([^\n#|｜/]{2,40})/);
  if (pin) return pin[1].trim();
  // 2) Brackets: 【店名】「店名」
  const br = text.match(/[【「『]([^】」』]{2,30})[】」』]/);
  if (br) return br[1].trim();
  // 3) First meaningful line, hashtags stripped.
  const line = text
    .split('\n')
    .map((l) => l.replace(/#\S+/g, '').trim())
    .find((l) => l.length >= 2);
  return (line || '').slice(0, 40);
}

function extractAddress(text) {
  const m = text.match(/(?:地址|주소|address)\s*[:：]\s*([^\n]{4,80})/i);
  return m ? m[1].trim() : '';
}

/** Parse one shared snippet (link + caption) into a draft save. */
export function parseShare(raw, tripRegions) {
  const urls = raw.match(URL_RE) || [];
  const url = urls[0] || '';
  const text = cleanText(raw);
  const { region, area } = detectRegion(raw, tripRegions);
  return {
    url,
    platform: detectPlatform(raw),
    title: extractTitle(text) || (url ? '未命名收藏' : ''),
    note: text.slice(0, 300),
    address: extractAddress(text),
    region,
    area: areasOf(region).includes(area) ? area : area || '',
    category: detectCategory(raw),
  };
}

/**
 * Split a paste that may contain several shares. Each URL ends a chunk, so
 * "caption1 link1 caption2 link2" gives two drafts. Plain lists (one place
 * per line, no links) also become one draft per line.
 */
export function parseMany(raw, tripRegions) {
  const input = (raw || '').trim();
  if (!input) return [];
  const urls = input.match(URL_RE) || [];

  let chunks;
  if (urls.length > 1) {
    chunks = [];
    let rest = input;
    for (const u of urls) {
      const i = rest.indexOf(u) + u.length;
      chunks.push(rest.slice(0, i));
      rest = rest.slice(i);
    }
    // Trailing boilerplate after the last link belongs to the last chunk.
    if (rest.trim()) chunks[chunks.length - 1] += rest;
  } else if (urls.length === 0 && input.split('\n').filter((l) => l.trim()).length > 1 && input.length < 600) {
    chunks = input.split('\n').filter((l) => l.trim());
  } else {
    chunks = [input];
  }
  return chunks.map((c) => parseShare(c, tripRegions)).filter((d) => d.title || d.url);
}
