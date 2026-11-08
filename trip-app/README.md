# tripaa

把 Instagram / 小红书 上收藏的攻略（美食、景点、体验、购物）整理好，和旅伴一起用。

- **收集**：贴链接（可一次多条）或截图 → AI 认出每个地方的店名、韩文名、分类（美食 / 景点 / 体验 / 购物）和种类（烤肉、火锅、咖啡甜点…）→ 自动找到位置。
- **整理**：按城市、分类、种类筛选；**按种类**或**按距离**排序（从「我现在的位置」或搜一个地方，例如酒店）。
- **点进去**：Google 评论 / Naver / Kakao 地图、看原贴文、地址。
- **避雷**：贴文说「别去」的地点标 👎 避雷，变灰、附原因。
- **须知**：交通、入境签证、预订、上网、钱、避雷提醒。AI 从贴文整理重点、适用城市和建议出发前几天做（贴文没写就标「AI 建议」）；要做的事可以打勾，个人的事（K-ETA、入境卡）每人各自打勾；跟这次行程城市无关的自动收起；填了护照国家会标出入境须知适不适用你。

技术：Vite + React、Supabase（登录 + 共用资料 + 即时同步）、Vercel（网站 + `/api` 函数）、Gemini（识别，免费方案）、Kakao Local（韩国地点）、OpenStreetMap（其他国家）。

没设定 Supabase 时为「试用模式」：资料只存在这台设备，附示例资料。

---

## 设定

### Supabase
1. SQL Editor：新装的跑 [`supabase/schema.sql`](supabase/schema.sql)；**已经装过旧版的，依序跑还没跑过的 [`supabase/migrations/`](supabase/migrations/)**（002_places.sql、003_tips.sql、004_plan.sql、005_bookings.sql）。
2. Authentication → Sign In / Providers → Email：关掉 **Confirm email**。
3. Authentication → URL Configuration：Site URL 和 Redirect URLs（`https://你的网址/**`）填 Vercel 网址。

### API keys（全部免费）
- **Gemini**：[aistudio.google.com](https://aistudio.google.com) → Get API key → Create API key。
- **Kakao**：[developers.kakao.com](https://developers.kakao.com) → 내 애플리케이션 → 애플리케이션 추가하기 → 앱 키 → **REST API 키**（有「카카오맵」设定的话把 사용 설정 打开）。
- OpenStreetMap 不用 key。

### Vercel 环境变量

| 名称 | 值 |
|---|---|
| `VITE_SUPABASE_URL`、`SUPABASE_URL` | Supabase Project URL |
| `VITE_SUPABASE_ANON_KEY`、`SUPABASE_ANON_KEY` | Supabase publishable / anon key |
| `GEMINI_API_KEY` | Gemini key |
| `KAKAO_REST_API_KEY` | Kakao REST API key |
| `GEMINI_MODEL`（可选） | 预设模型名称不能用时，填一个可用的 Gemini 模型名称 |

改完环境变量要 **Redeploy**。

## 本地开发

```bash
cd trip-app
npm install
cp .env.example .env.local
npx vercel dev     # 前端 + /api 函数；只跑前端用 npm run dev
```

## 资料安全

- 每个旅行只有成员看得到（Row Level Security，见 `schema.sql`）。
- `/api/booking`：读订单确认信 / 截图（Gemini），酒店、车站、机场用 Kakao / OSM 找位置。
- `/api/plan`：把一天的地点交给 Gemini 排顺序（交通时间先用直线距离估算），时间由服务器按顺序算好。
- 所有 key 只在 Vercel 后端；`/api/*` 只接受已登录用户的请求。
- Gemini 免费方案：Google 可能会用传进去的内容改进模型，不要贴私人资料。
