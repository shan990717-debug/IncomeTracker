import { postKey, isShortLink } from '../../server/postKey.js';
import { getState } from './store';

/*
 * "Did we already collect this post?" — checked in the app before any AI
 * call, so pasting the same post again costs nothing.
 *
 * A save is matched by its link (tracking parameters ignored, IG/TikTok/YouTube
 * by post id). 小红书 share links differ every time, so the note id found when
 * the post was read is kept as a hidden ⟦post:…⟧ mark at the end of save.raw
 * (no database change), and 须知 sources carry it as source.key.
 */

const MARK = /⟦post:([^⟧]+)⟧/g;

export { postKey, isShortLink };

export function withPostMark(raw, key, url) {
  const r = String(raw || '');
  if (!key || key === postKey(url) || r.includes(`⟦post:${key}⟧`)) return r;
  return `${r}\n⟦post:${key}⟧`;
}

export const stripPostMark = (raw) => String(raw || '').replace(/\n?⟦post:[^⟧]+⟧/g, '');

function keysOfSave(s) {
  const keys = new Set([postKey(s.url)]);
  for (const m of String(s.raw || '').matchAll(MARK)) keys.add(m[1]);
  keys.delete('');
  return keys;
}

/** Saves and 须知 in this trip that came from the post with this key, or null. Placeholders still being read don't count. */
export function alreadyCollected(tripId, key) {
  if (!key) return null;
  const st = getState();
  const pending = new Set(st.pending || []);
  const saves = st.saves.filter((s) => s.tripId === tripId && !pending.has(s.id) && keysOfSave(s).has(key));
  const tips = st.tips.filter((t) => t.tripId === tripId && (t.sources || []).some((src) => src.key === key || postKey(src.url) === key));
  return saves.length || tips.length ? { saves, tips } : null;
}

export function describeCollected({ saves, tips }) {
  const names = saves.slice(0, 3).map((s) => s.title).join('、');
  return [
    saves.length && `${names}${saves.length > 3 ? ` 等 ${saves.length} 个地点` : ''}`,
    tips.length && `${tips.length} 条须知`,
  ].filter(Boolean).join('，');
}
