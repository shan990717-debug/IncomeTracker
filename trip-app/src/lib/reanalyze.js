import { actions } from './store';
import { aiExtract } from './ai';
import { dueFromOffset } from './prep';

/**
 * Re-read an existing save with AI. The first place found updates it in place
 * (keeping status / rating); extra places become new saves; prep tips found in
 * the post go to the checklist. Returns { places, tasks } counts.
 */
export async function reanalyzeSave(save, trip) {
  const text = save.raw || [save.title, save.note].filter(Boolean).join('\n');
  const { places, tasks } = await aiExtract({ text, url: save.url, tripRegions: trip.regions });
  if (places.length) {
    const [first, ...rest] = places;
    actions.updateSave(save.id, { ...first, thumbnail: first.thumbnail || save.thumbnail || '', raw: save.raw || text });
    if (rest.length) actions.addSaves(trip.id, rest.map((d) => ({ ...d, raw: save.raw || text })));
  }
  const added = tasks.length
    ? actions.addTasks(trip.id, tasks.map(({ offset, ...t }) => ({ ...t, dueDate: dueFromOffset(trip.startDate, offset) })))
    : 0;
  return { places: places.length, tasks: added };
}
