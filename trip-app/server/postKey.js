/*
 * One key per social-media post, so the same post pasted twice is recognised
 * no matter which share link it came through. Shared by the app and the
 * server; pure, no imports.
 *
 *   xhs:<noteId>   ig:<code>   tt:<videoId>   yt:<videoId>   otherwise host+path
 *
 * 小红书 short links (xhslink.com/…) are different on every share, so the app
 * asks /api/extract (resolveOnly, no AI) to follow the redirect to the note id.
 */
export function postKey(url) {
  if (!url) return '';
  let s = String(url).trim();
  try { s = decodeURIComponent(s); } catch { /* keep as is */ }
  let m;
  if ((m = s.match(/xiaohongshu\.com\/(?:explore|discovery\/item|item)\/([0-9a-f]{24})/i))) return `xhs:${m[1].toLowerCase()}`;
  if ((m = s.match(/instagram\.com\/(?:[\w.]+\/)?(?:p|reel|reels|tv)\/([\w-]+)/i))) return `ig:${m[1]}`;
  if ((m = s.match(/tiktok\.com\/.*\/video\/(\d+)/i))) return `tt:${m[1]}`;
  if ((m = s.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/))([\w-]{11})/i))) return `yt:${m[1]}`;
  try {
    const u = new URL(s);
    return `${u.hostname.replace(/^www\./, '').toLowerCase()}${u.pathname.replace(/\/+$/, '')}`;
  } catch {
    return '';
  }
}

export const isShortLink = (url) => /xhslink\.(?:com|cn)|vm\.tiktok\.com|vt\.tiktok\.com/i.test(url || '');
