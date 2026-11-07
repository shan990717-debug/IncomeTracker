import Anthropic from '@anthropic-ai/sdk';

/*
 * POST /api/extract — read one social-media post (caption/link and/or
 * screenshots) and return { places: [...], tasks: [...] }.
 *
 * Runs on Vercel so ANTHROPIC_API_KEY never reaches the browser. When
 * SUPABASE_URL/SUPABASE_ANON_KEY are set, only signed-in users of the app can
 * call it (otherwise anyone who finds the URL could spend your credits).
 *
 * Claude gets a web search tool (to identify a place when the caption only
 * says "这家绝了") and must hand in its answer through the save_guide tool,
 * whose strict schema guarantees well-formed JSON.
 */

// Cheapest current model ($0.10 / $0.50 per million tokens). Swap for
// 'claude-sonnet-5-5' if place recognition isn't good enough.
const MODEL = 'claude-haiku-5-5';
const MAX_IMAGES = 4;
const MAX_IMAGE_B64 = 2_000_000; // ~1.5 MB per screenshot after client-side shrinking

const CATEGORIES = ['food', 'place', 'experience', 'shopping'];
const GROUPS = ['docs', 'transport', 'connect', 'booking', 'money', 'packing', 'other'];

const SAVE_GUIDE = {
  name: 'save_guide',
  description: 'Hand in what you extracted from the post. Call this exactly once, at the end.',
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    required: ['places', 'tasks'],
    properties: {
      places: {
        type: 'array',
        description: 'Every distinct restaurant, café, sight, shop or activity the post recommends. Empty if none.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['name', 'name_local', 'region', 'area', 'category', 'address', 'tip', 'confidence'],
          properties: {
            name: { type: 'string', description: '简体中文名称；没有中文名就用原名' },
            name_local: { type: 'string', description: 'Korean (or local-language) name as on Naver/Kakao Map; "" if unknown' },
            region: { type: 'string', description: '城市，简体中文，例如 首尔 / 釜山 / 济州岛' },
            area: { type: 'string', description: '商圈，简体中文，例如 弘大 / 圣水 / 海云台；"" if unknown' },
            category: { type: 'string', enum: CATEGORIES },
            address: { type: 'string', description: '"" if unknown' },
            tip: { type: 'string', description: '一句话重点：推荐菜/亮点/营业时间/注意事项（简体中文，30字内）' },
            confidence: { type: 'number', description: '0-1: how sure you are this exact place is correctly identified' },
          },
        },
      },
      tasks: {
        type: 'array',
        description: 'Things to prepare or book before / on arrival that the post mentions. Not sightseeing. Empty if none.',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['title', 'group', 'offset_days', 'note'],
          properties: {
            title: { type: 'string', description: '要做的事，动词开头，简体中文，例如「买 WOWPASS 卡」「提前订天空胶囊小火车」' },
            group: { type: 'string', enum: GROUPS, description: 'docs=证件入境 transport=交通 connect=上网 booking=预订 money=钱 packing=行李' },
            offset_days: { type: 'number', description: 'When to do it vs departure: -30 = a month before, -3 = 3 days before, 0 = on arrival' },
            note: { type: 'string', description: '帖子里的具体建议：价格、在哪买、注意事项（简体中文，60字内）；"" if none' },
          },
        },
      },
    },
  },
};

function buildPrompt({ text, url, previewTitle, regions, imageCount }) {
  return `你在帮一群朋友把 Instagram / 小红书 上收藏的旅行攻略整理好。
这次旅行的地区：${regions.join('、') || '（未指定）'}

${imageCount ? `附上 ${imageCount} 张帖子截图，请仔细读图片里的文字。\n` : ''}${text ? `帖子文字：\n"""\n${text}\n"""\n` : ''}${url ? `链接：${url}\n` : ''}${previewTitle ? `链接标题：${previewTitle}\n` : ''}
请把内容拆成两类，然后调用 save_guide 交卷：
1. places：帖子推荐的每一个具体地点（餐厅、咖啡厅、景点、店铺、体验）。一篇介绍多家就分别列出。
   category：food=吃喝（含咖啡甜点），place=景点打卡，experience=体验活动（韩服、汗蒸、小火车、课程等），shopping=购物。
   文字和截图都没写店名时，可以用 web_search 搜链接或关键字确认（最多搜几次就好）；确认不了就不要编造，宁可少列或给低 confidence。
2. tasks：帖子提到的「出发前或刚到时要准备/预订的事」，例如交通卡、入境卡/K-ETA、eSIM、提前订票订位、换钱、要下载的 App。
   单纯的景点介绍不要放进 tasks。
所有中文用简体。`;
}

async function signedIn(req) {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = process.env;
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return true; // local/demo deployments without login
  const auth = req.headers.authorization || '';
  if (!auth.startsWith('Bearer ')) return false;
  const r = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: { apikey: SUPABASE_ANON_KEY, Authorization: auth } });
  return r.ok;
}

function validate(body) {
  const text = typeof body?.text === 'string' ? body.text.slice(0, 4000) : '';
  const url = typeof body?.url === 'string' ? body.url.slice(0, 500) : '';
  const previewTitle = typeof body?.previewTitle === 'string' ? body.previewTitle.slice(0, 200) : '';
  const regions = Array.isArray(body?.regions) ? body.regions.filter((r) => typeof r === 'string').slice(0, 10) : [];
  const images = (Array.isArray(body?.images) ? body.images : [])
    .filter((i) => i && i.media_type === 'image/jpeg' && typeof i.data === 'string' && i.data.length <= MAX_IMAGE_B64)
    .slice(0, MAX_IMAGES);
  if (!text && !url && !images.length) return null;
  return { text, url, previewTitle, regions, images };
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: '服务器没有设定 ANTHROPIC_API_KEY' });
  if (!(await signedIn(req))) return res.status(401).json({ error: '请先登录' });

  const input = validate(req.body);
  if (!input) return res.status(400).json({ error: '没有内容可以识别' });

  const client = new Anthropic();
  const messages = [{
    role: 'user',
    content: [
      ...input.images.map((img) => ({ type: 'image', source: { type: 'base64', media_type: img.media_type, data: img.data } })),
      { type: 'text', text: buildPrompt({ ...input, imageCount: input.images.length }) },
    ],
  }];

  try {
    // A few rounds at most: web search can pause the turn, and the model may
    // answer in prose once before calling save_guide.
    for (let round = 0; round < 4; round++) {
      const response = await client.messages.create({
        model: MODEL,
        max_tokens: 16000,
        output_config: { effort: 'low' }, // extraction, not deep reasoning: faster and cheaper
        tools: [SAVE_GUIDE, { type: 'web_search_20250305', name: 'web_search', max_uses: 3 }],
        messages,
      });

      if (response.stop_reason === 'refusal') return res.status(422).json({ error: 'AI 拒绝处理这则内容' });

      const handIn = response.content.find((b) => b.type === 'tool_use' && b.name === 'save_guide');
      if (handIn) {
        const { places = [], tasks = [] } = handIn.input || {};
        return res.status(200).json({ places, tasks });
      }

      messages.push({ role: 'assistant', content: response.content });
      if (response.stop_reason === 'pause_turn') continue; // server tool loop paused: resend as-is to resume
      messages.push({ role: 'user', content: '请调用 save_guide 交卷（没有内容就交空数组）。' });
    }
    return res.status(502).json({ error: 'AI 没有给出结果' });
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return res.status(429).json({ error: 'AI 太忙了，稍后再试' });
    if (e instanceof Anthropic.AuthenticationError) return res.status(500).json({ error: 'ANTHROPIC_API_KEY 无效' });
    if (e instanceof Anthropic.APIError) return res.status(502).json({ error: `AI 出错（${e.status}）` });
    console.error(e);
    return res.status(500).json({ error: '服务器出错' });
  }
}
