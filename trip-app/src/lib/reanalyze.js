import { actions } from './store';
import { aiExtract } from './ai';

/**
 * Re-read an existing save with AI. The first place found updates it in place;
 * extra places from the same post become new saves. Returns how many were found.
 */
export async function reanalyzeSave(save, trip) {
  const text = save.raw || [save.title, save.note].filter(Boolean).join('\n');
  const { places, tips } = await aiExtract({ text, url: save.url, tripRegions: trip.regions });
  if (tips.length) actions.addTips(trip.id, tips);
  if (!places.length) return 0;
  const [first, ...rest] = places;
  // A pin the user placed by hand beats the lookup.
  const keepGeo = save.geo === 'manual' ? { lat: save.lat, lng: save.lng, geo: 'manual' } : {};
  actions.updateSave(save.id, { ...first, ...keepGeo, thumbnail: first.thumbnail || save.thumbnail || '', raw: save.raw || text });
  if (rest.length) actions.addSaves(trip.id, rest.map((d) => ({ ...d, raw: save.raw || text })));
  return places.length;
}
