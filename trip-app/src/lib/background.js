import { toast } from 'sonner';
import { actions, getState, setPending } from './store';
import { aiExtract } from './ai';
import { reanalyzeSave } from './reanalyze';
import { withPostMark } from './dedupe';

/*
 * Let people save a post before AI has finished reading it.
 *
 * The 收集 sheet saves the keyword guess straight away as a placeholder card
 * and hands the AI request (already running, or started now) to this module,
 * which outlives the sheet. When the answer arrives the placeholder becomes
 * the real place (extra places and 须知 are added next to it).
 *
 * This runs in the app, so closing the app mid-way interrupts it. On the next
 * open, `resumeUnfinished` re-reads posts that never got an AI pass — once per
 * post per device, so an unrecognisable post doesn't retry forever.
 */

const TRIED_KEY = 'tripaa_ai_tried';
const readTried = () => { try { return new Set(JSON.parse(localStorage.getItem(TRIED_KEY) || '[]')); } catch { return new Set(); } };
const markTried = (id) => {
  const s = readTried();
  s.add(id);
  try { localStorage.setItem(TRIED_KEY, JSON.stringify([...s].slice(-500))); } catch { /* ignore */ }
};

function apply(placeholderId, tripId, r) {
  const { places, tips } = r;
  const save = getState().saves.find((s) => s.id === placeholderId);
  if (tips?.length) actions.addTips(tripId, tips);
  if (!save) return null; // deleted meanwhile
  if (!places.length) {
    // A post that turned out to be only 须知 doesn't need a 「待识别」 place.
    if (tips?.length) { actions.deleteSave(placeholderId); return '已整理到须知'; }
    actions.updateSave(placeholderId, { unsure: true });
    return null;
  }
  const [first, ...rest] = places;
  actions.updateSave(placeholderId, { ...first, raw: withPostMark(save.raw, r.postKey, save.url), thumbnail: first.thumbnail || save.thumbnail || '', unsure: first.unsure || false });
  if (rest.length) actions.addSaves(tripId, rest.map((d) => ({ ...d, raw: save.raw })));
  return places.map((p) => p.title).slice(0, 2).join('、') + (places.length > 2 ? ` 等 ${places.length} 个` : '');
}

/**
 * Finish an AI read for a saved placeholder.
 * @param promise  the request the sheet already started, or null to start one now
 */
export function finishInBackground({ placeholderId, tripId, promise, text, url, images = [], tripRegions }) {
  markTried(placeholderId);
  setPending(placeholderId, true);
  const run = promise || aiExtract({ text, url, images, tripRegions });
  run.then((r) => {
    if (r.dup) { // turned out to be a post we already have
      actions.deleteSave(placeholderId);
      toast('这篇贴文之前收过了，没有重复加');
      return;
    }
    const done = apply(placeholderId, tripId, r);
    if (done) toast.success(`✨ 已识别：${done}`);
  }).catch(() => {
    actions.updateSave(placeholderId, { unsure: true });
    toast('有一条攻略 AI 没认出来，可以在攻略库按「重新识别」');
  }).finally(() => setPending(placeholderId, false));
}

let resumed = false;
/** On app open: give posts that were saved before AI finished one more try. */
export async function resumeUnfinished() {
  if (resumed) return;
  resumed = true;
  const s = getState();
  const tried = readTried();
  const todo = s.saves.filter((x) => x.unsure && !x.ai && x.url && !tried.has(x.id)).slice(0, 5);
  for (const save of todo) {
    const trip = s.trips.find((t) => t.id === save.tripId);
    if (!trip) continue;
    markTried(save.id);
    setPending(save.id, true);
    try { await reanalyzeSave(save, trip); } catch { /* stays 待确认 */ }
    setPending(save.id, false);
  }
}
