# tripaa

和旅伴一起收集 Instagram / 小红书 上的攻略：

- **攻略库**：贴链接、文案或截图，AI 拆出每个地点（吃 / 去 / 玩 / 买），按城市和商圈整理；标「要去 ⭐」「去过 ✓」并打分。
- **出发准备**：交通卡、入境、eSIM、提前预订等事项，按「什么时候要做」排好，到期提醒；攻略帖里提到的准备事项会自动加进来。

技术：Vite + React（前端）、Supabase（登录 + 共用资料库 + 即时同步）、Vercel（网站 + `/api/extract` 后端函数）、Claude API（识别）。

没设定 Supabase 时，app 以「试用模式」运行：资料只存在这台设备，附示例资料。

---

## 上线步骤（大约 20 分钟）

### 1. Supabase（资料库 + 登录）

1. 到 [supabase.com](https://supabase.com) 新建一个 project（免费方案就够）。
2. 左边 **SQL Editor** → 新查询 → 把 [`supabase/schema.sql`](supabase/schema.sql) 整份贴进去 → Run。
3. **Project Settings → API**：记下 `Project URL` 和 `anon public` key。
4. **Authentication → URL Configuration**（等第 3 步拿到 Vercel 网址后再填）：
   - Site URL：`https://你的网址.vercel.app`
   - Redirect URLs：加一条 `https://你的网址.vercel.app/**`

### 2. Claude API 密钥

1. 到 [console.anthropic.com](https://console.anthropic.com) 建一个 API key。
2. 建议在 **Billing → Limits** 设一个每月上限。

### 3. Vercel（网站）

1. 在 [vercel.com](https://vercel.com) 用 GitHub 登录 → **Add New → Project** → 选这个 repo。
2. **Root Directory** 选 `trip-app`，Framework 选 **Vite**。
3. **Environment Variables** 加 5 个（参考 [`.env.example`](.env.example)）：

   | 名称 | 值 |
   |---|---|
   | `VITE_SUPABASE_URL` | Supabase Project URL |
   | `VITE_SUPABASE_ANON_KEY` | Supabase anon key |
   | `SUPABASE_URL` | 同上 URL（给后端检查登录用） |
   | `SUPABASE_ANON_KEY` | 同上 anon key |
   | `ANTHROPIC_API_KEY` | Claude API key（只放这里，网页上看不到） |

4. Deploy。拿到网址后回去填 Supabase 第 4 步。

### 4. 装到手机

- **iPhone**：Safari 打开网址 → 分享 → 「加入主屏幕」。
- **Android**：Chrome 打开 → 「安装应用」。装好后，IG / 小红书的「分享」菜单里会出现「tripaa」，可以直接分享进来。

### 5. 邀请旅伴

右上角旅行名称 → 「邀请旅伴」→ 把链接发给对方。对方用邮箱登录后就会加入，大家看到的是同一份攻略和清单，改动即时同步。

---

## 本地开发

```bash
cd trip-app
npm install
cp .env.example .env.local   # 填好值；留空 Supabase 则为试用模式
npm run dev                  # 前端
```

`/api/extract` 是 Vercel 函数，本地要跑 AI 识别请用 `npx vercel dev`。

## 识别用的模型与费用

`api/extract.js` 里的 `MODEL` 是最便宜的 `claude-haiku-5-5`（每百万 token 输入 $0.10 / 输出 $0.50），每条贴文的 AI 费用通常不到 1 美分；用到网页搜索时另外按搜索次数计费（每条最多 3 次）。如果觉得店名认得不够准，把 `MODEL` 换成 `claude-sonnet-5-5` 就好，其他代码不用改。

## 资料安全

- 每个旅行只有成员看得到（Supabase Row Level Security，规则在 `schema.sql`）。
- 邀请链接可以在旅行菜单里「换链接」，旧链接立即失效。
- Claude API key 只在 Vercel 后端；`/api/extract` 只接受已登录用户的请求。
