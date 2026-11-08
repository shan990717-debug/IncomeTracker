/*
 * Open a shared link on the server and pull out what the share text leaves
 * out: the post's full text, hashtags, location and images.
 *
 *   小红书   xhslink.com → note page; data lives in window.__INITIAL_STATE__
 *   Instagram   page meta tags (served to link-preview crawlers)
 *   TikTok      public oEmbed
 *   anything    Open Graph / meta tags
 *
 * Platforms change their pages and sometimes block servers, so everything
 * here is best effort: on failure we return { ok: false, reason } and the
 * caller falls back to the pasted text and screenshots.
 */

const BROWSER_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const DESKTOP_UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36';
// Instagram serves full Open Graph tags (incl. the caption) to link-preview crawlers.
const PREVIEW_UA = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';

const timed = (ms) => AbortSignal.timeout(ms);

const decode = (s = '') => s
  .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(Number(n)))
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => String.fromCodePoint(parseInt(n, 16)));

function meta(html, key) {
  const re = new RegExp(`<meta[^>]+(?:property|name)=["']${key}["'][^>]*>`, 'i');
  const tag = html.match(re)?.[0];
  const content = tag?.match(/content=["']([^"']*)["']/i)?.[1];
  return content ? decode(content).trim() : '';
}

async function getHtml(url, ua) {
  const r = await fetch(url, {
    redirect: 'follow',
    headers: { 'User-Agent': ua, 'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8,ko;q=0.7', Accept: 'text/html,application/xhtml+xml' },
    signal: timed(8000),
  });
  return { status: r.status, finalUrl: r.url, html: r.ok ? await r.text() : '' };
}

/** Pull the JSON object assigned to window.__INITIAL_STATE__ (小红书 uses `undefined` literals). */
function initialState(html) {
  const i = html.indexOf('window.__INITIAL_STATE__=');
  if (i === -1) return null;
  const start = html.indexOf('{', i);
  const end = html.indexOf('</script>', start);
  if (start === -1 || end === -1) return null;
  const raw = html.slice(start, end).trim().replace(/;$/, '').replace(/:undefined/g, ':null');
  try { return JSON.parse(raw); } catch { return null; }
}

/** Find the note object whatever the page variant (detail map / note / feed). */
function findNote(state) {
  const n = state?.note;
  if (!n) return null;
  const map = n.noteDetailMap || {};
  const first = Object.values(map).find((v) => v?.note?.title || v?.note?.desc);
  return first?.note || n.note || null;
}

function xhsImageUrl(img) {
  const u = img?.urlDefault || img?.url || img?.infoList?.find((x) => x.imageScene?.includes('DFT'))?.url || img?.infoList?.[0]?.url || '';
  return u.startsWith('//') ? `https:${u}` : u;
}

async function xiaohongshu(url) {
  // The note data is in the desktop page; the mobile page sometimes has it too. Try both.
  let page = null;
  for (const ua of [DESKTOP_UA, BROWSER_UA]) {
    const p = await getHtml(url, ua);
    if (!p.html) { page = page || p; continue; }
    page = p;
    const note = findNote(initialState(p.html));
    if (note) {
      return {
        ok: true,
        title: note.title || '',
        text: note.desc || '',
        tags: (note.tagList || []).map((t) => t.name).filter(Boolean),
        location: note.ipLocation || '',
        images: (note.imageList || []).map(xhsImageUrl).filter(Boolean).slice(0, 6),
        isVideo: note.type === 'video',
        referer: 'https://www.xiaohongshu.com/',
      };
    }
  }
  const { status, finalUrl, html } = page;
  if (!html) return { ok: false, reason: `小红书页面打不开（${status}）` };
  if (/website-login|captcha|验证/i.test(finalUrl)) return { ok: false, reason: '小红书要求登录或验证，读不到内文' };
  // Fallback: meta tags still carry the title, the opening of the text and a cover.
  const title = meta(html, 'og:title').replace(/\s*-\s*小红书.*$/, '');
  const text = meta(html, 'description') || meta(html, 'og:description');
  if (!title && !text) return { ok: false, reason: '小红书页面没有内文（可能被挡了）' };
  return { ok: true, title, text, tags: (meta(html, 'keywords') || '').split(/[,，]/).filter(Boolean), images: [meta(html, 'og:image')].filter(Boolean), referer: 'https://www.xiaohongshu.com/' };
}

async function instagram(url) {
  const { status, html } = await getHtml(url, PREVIEW_UA);
  if (!html) return { ok: false, reason: `Instagram 页面打不开（${status}）` };
  // og:description looks like: `123 likes, 4 comments - user on May 1, 2026: "caption…"`
  const desc = meta(html, 'og:description') || meta(html, 'description');
  const caption = desc.match(/:\s*["“](.*)["”]\s*\.?$/s)?.[1] || desc;
  const title = meta(html, 'og:title');
  if (!caption && !title) return { ok: false, reason: 'Instagram 没给内文（可能要登录）' };
  return { ok: true, title, text: caption, tags: (caption.match(/#[^\s#]+/g) || []).map((t) => t.slice(1)), images: [meta(html, 'og:image')].filter(Boolean) };
}

async function tiktok(url) {
  const r = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(url)}`, { signal: timed(8000) });
  if (!r.ok) return { ok: false, reason: `TikTok 读不到（${r.status}）` };
  const j = await r.json();
  return { ok: true, title: '', text: j.title || '', tags: [], images: [j.thumbnail_url].filter(Boolean), author: j.author_name || '' };
}

async function generic(url) {
  const { status, html } = await getHtml(url, BROWSER_UA);
  if (!html) return { ok: false, reason: `页面打不开（${status}）` };
  const title = meta(html, 'og:title') || decode(html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || '');
  const text = meta(html, 'og:description') || meta(html, 'description');
  if (!title && !text) return { ok: false, reason: '页面没有可读的内容' };
  return { ok: true, title, text, tags: [], images: [meta(html, 'og:image')].filter(Boolean) };
}

export async function fetchPost(url) {
  if (!/^https?:\/\//i.test(url || '')) return null;
  try {
    if (/xhslink\.com|xiaohongshu\.com/i.test(url)) return { platform: '小红书', ...(await xiaohongshu(url)) };
    if (/instagram\.com|instagr\.am/i.test(url)) return { platform: 'Instagram', ...(await instagram(url)) };
    if (/tiktok\.com/i.test(url)) return { platform: 'TikTok', ...(await tiktok(url)) };
    return { platform: '', ...(await generic(url)) };
  } catch (e) {
    return { ok: false, reason: e.name === 'TimeoutError' ? '打开链接太慢' : `打不开链接（${e.message}）` };
  }
}

/** Download a few post images for the AI to read (menus, signs, captions on pictures). */
export async function downloadImages(urls, referer, max = 4) {
  const out = [];
  for (const u of urls.slice(0, max)) {
    try {
      const r = await fetch(u, { headers: { 'User-Agent': BROWSER_UA, ...(referer ? { Referer: referer } : {}) }, signal: timed(6000) });
      const type = (r.headers.get('content-type') || '').split(';')[0];
      if (!r.ok || !/^image\/(jpeg|png|webp)$/.test(type)) continue;
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length > 3_000_000) continue;
      out.push({ media_type: type, data: buf.toString('base64') });
    } catch { /* skip this image */ }
  }
  return out;
}
