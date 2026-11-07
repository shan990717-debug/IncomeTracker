// Known regions + their sub-areas, with keywords in 中文 / 한국어 / English.
// Classification is keyword based and always editable by the user afterwards.

export const REGIONS = [
  {
    id: 'seoul',
    name: '首尔',
    emoji: '🏙️',
    keywords: ['首尔', '首爾', '서울', 'seoul', '汉城'],
    areas: [
      { name: '弘大', keywords: ['弘大', '홍대', 'hongdae', '合井', '합정', '望远', '망원', 'mangwon'] },
      { name: '延南洞', keywords: ['延南', '연남', 'yeonnam'] },
      { name: '明洞', keywords: ['明洞', '명동', 'myeongdong', '南大门', '남대문'] },
      { name: '圣水', keywords: ['圣水', '聖水', '성수', 'seongsu'] },
      { name: '江南', keywords: ['江南', '강남', 'gangnam', '新沙', '신사', 'sinsa', '狎鸥亭', '압구정', 'apgujeong', '清潭', '청담', 'cheongdam', '林荫道', '가로수길'] },
      { name: '梨泰院', keywords: ['梨泰院', '이태원', 'itaewon', '汉南', '한남', 'hannam'] },
      { name: '钟路', keywords: ['钟路', '鐘路', '종로', 'jongno', '益善洞', '익선', 'ikseon', '仁寺洞', '인사동', 'insadong', '北村', '북촌', 'bukchon', '景福宫', '경복궁', 'gyeongbok', '光化门', '광화문', '西村', '서촌', '乙支路', '을지로', 'euljiro'] },
      { name: '东大门', keywords: ['东大门', '동대문', 'dongdaemun', 'ddp', '广藏市场', '광장시장', 'gwangjang'] },
      { name: '南山', keywords: ['南山', '남산', 'namsan', 'n首尔塔', 'n서울타워', 'n seoul tower'] },
      { name: '蚕室', keywords: ['蚕室', '잠실', 'jamsil', '乐天世界', '롯데월드', 'lotte world', '石村湖', '석촌'] },
      { name: '汝矣岛', keywords: ['汝矣岛', '여의도', 'yeouido', 'the hyundai', '现代百货', '汉江', '한강'] },
    ],
  },
  {
    id: 'busan',
    name: '釜山',
    emoji: '🌊',
    keywords: ['釜山', '부산', 'busan', 'pusan'],
    areas: [
      { name: '海云台', keywords: ['海云台', '海雲台', '해운대', 'haeundae', '青沙浦', '청사포', 'cheongsapo', '尾浦', '미포', '天空胶囊', '小火车', '스카이캡슐', '해변열차', 'blueline', 'blue line', '迎月岭', '달맞이'] },
      { name: '广安里', keywords: ['广安里', '廣安里', '광안리', 'gwangalli', '广安大桥', '광안대교', '民乐', '민락'] },
      { name: '西面', keywords: ['西面', '서면', 'seomyeon', '田浦', '전포', 'jeonpo'] },
      { name: '南浦洞', keywords: ['南浦', '남포', 'nampo', '札嘎其', '扎嘎其', '자갈치', 'jagalchi', '国际市场', '국제시장', 'bifc', '龙头山', '용두산', '富平', '부평'] },
      { name: '甘川洞', keywords: ['甘川', '감천', 'gamcheon'] },
      { name: '影岛', keywords: ['影岛', '영도', 'yeongdo', '白浅滩', '흰여울', 'huinnyeoul', '太宗台', '태종대'] },
      { name: '机张', keywords: ['机张', '機張', '기장', 'gijang', '海东龙宫寺', '해동용궁사', '龙宫寺'] },
      { name: '松岛', keywords: ['松岛', '송도', 'songdo'] },
    ],
  },
  {
    id: 'jeju',
    name: '济州岛',
    emoji: '🍊',
    keywords: ['济州', '濟州', '제주', 'jeju'],
    areas: [
      { name: '济州市', keywords: ['济州市', '제주시', 'jeju city', '东门市场', '동문시장', '龙头岩', '용두암'] },
      { name: '涯月', keywords: ['涯月', '애월', 'aewol', '翰林', '한림', 'hallim', '挟才', '협재', 'hyeopjae'] },
      { name: '咸德/旧左', keywords: ['咸德', '함덕', 'hamdeok', '旧左', '구좌', 'gujwa', '月汀里', '월정리', 'woljeong'] },
      { name: '城山', keywords: ['城山', '성산', 'seongsan', '日出峰', '일출봉', '牛岛', '우도', 'udo'] },
      { name: '西归浦', keywords: ['西归浦', '西歸浦', '서귀포', 'seogwipo', '中文', '중문', 'jungmun', '天地渊', '천지연', '正房', '정방'] },
      { name: '汉拿山', keywords: ['汉拿山', '한라산', 'hallasan'] },
    ],
  },
  {
    id: 'gyeongju',
    name: '庆州',
    emoji: '🏯',
    keywords: ['庆州', '慶州', '경주', 'gyeongju', '皇理团', '황리단', '佛国寺', '불국사'],
    areas: [],
  },
  {
    id: 'gangneung',
    name: '江陵',
    emoji: '☕',
    keywords: ['江陵', '강릉', 'gangneung', '安木', '안목', '注文津', '주문진'],
    areas: [],
  },
];

export const UNSORTED = '未分类';

export const regionByName = (name) => REGIONS.find((r) => r.name === name);

export const regionEmoji = (name) => regionByName(name)?.emoji || '📍';

const norm = (s) => (s || '').toLowerCase();

/** Detect region + area from free text. Returns { region, area }. */
export function detectRegion(text, allowedRegions) {
  const t = norm(text);
  let best = null;

  for (const region of REGIONS) {
    let score = 0;
    let area = '';
    for (const k of region.keywords) if (t.includes(norm(k))) score += 2;
    for (const a of region.areas) {
      const hits = a.keywords.filter((k) => t.includes(norm(k))).length;
      if (hits) {
        score += 3 * hits;
        if (!area) area = a.name;
      }
    }
    if (score && (!best || score > best.score)) best = { region: region.name, area, score };
  }

  if (best) return { region: best.region, area: best.area };
  // Trip has exactly one region → it is the obvious default.
  if (allowedRegions?.length === 1) return { region: allowedRegions[0], area: '' };
  return { region: UNSORTED, area: '' };
}

export const areasOf = (regionName) => regionByName(regionName)?.areas.map((a) => a.name) || [];
