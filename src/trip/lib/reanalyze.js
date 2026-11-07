import { actions } from './store';
import { aiExtract } from './ai';

/**
 * Re-read an existing save with AI. The first place found updates the save in
 * place (keeping ❤️ / 打卡 / 评分); extra places from the same post become new
 * saves. Returns how many places were found (0 = nothing changed).
 */
export async function reanalyzeSave(save, trip) {
  const text = save.raw || [save.title, save.note].filter(Boolean).join('\n');
  const { drafts } = await aiExtract({ text, url: save.url, tripRegions: trip.regions });
  if (!drafts.length) return 0;
  const [first, ...rest] = drafts;
  actions.updateSave(save.id, { ...first, thumbnail: first.thumbnail || save.thumbnail || '', raw: save.raw || text });
  if (rest.length) actions.addSaves(trip.id, rest.map((d) => ({ ...d, raw: save.raw || text })));
  return drafts.length;
}
