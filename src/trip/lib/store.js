import { useSyncExternalStore } from 'react';
import { templateTasks } from './prep';
import { seedState } from './seed';

/*
 * Local-first store. One JSON blob in localStorage for now; every record has a
 * tripId so swapping load/persist for a shared backend (旅伴共用) is the only
 * change needed later.
 *
 *   trips: { id, name, startDate, endDate, regions[], dismissedAuto[] }
 *   saves: { id, tripId, title, nameLocal, url, platform, thumbnail, note, address,
 *            region, area, category, status: 'saved'|'going'|'done', day, rating, review, raw, ai }
 *   tasks: { id, tripId, group, title, note, link, dueDate, done, autoKey?, sourceUrl?, sourceTitle? }
 */

const KEY = 'trip_planner_v2';
const OLD_KEY = 'trip_planner_v1';
const EMPTY = { activeTripId: null, trips: [], saves: [], tasks: [] };

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

export const STATUSES = [
  { id: 'saved', label: '收藏', short: '收藏' },
  { id: 'going', label: '要去 ⭐', short: '要去' },
  { id: 'done', label: '去过 ✓', short: '去过' },
];

/** v1 (with itinerary) → v2: keep trips, saves, tasks; drop itinerary/lodging. */
function migrate(old) {
  return {
    activeTripId: old.activeTripId,
    trips: old.trips || [],
    saves: (old.saves || []).map(({ starred, done, ...s }) => ({ ...s, status: done ? 'done' : starred ? 'going' : 'saved' })),
    tasks: (old.tasks || []).filter((t) => !String(t.autoKey || '').startsWith('item:')),
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...EMPTY, ...JSON.parse(raw) };
    const old = localStorage.getItem(OLD_KEY);
    if (old) return { ...EMPTY, ...migrate(JSON.parse(old)) };
  } catch {
    /* corrupted or blocked storage → start fresh */
  }
  return seedState(uid);
}

let state = typeof window === 'undefined' ? EMPTY : load();
const listeners = new Set();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full / private mode: keep working in memory */
  }
}

// Write seeded/migrated data right away so ids stay stable across reloads.
if (typeof window !== 'undefined') {
  try { if (!localStorage.getItem(KEY)) persist(); } catch { /* ignore */ }
}

function set(updater) {
  state = { ...state, ...updater(state) };
  persist();
  listeners.forEach((l) => l());
}

export function useTripState() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
  );
}

export const getState = () => state;
export const activeTrip = (s) => s.trips.find((t) => t.id === s.activeTripId) || s.trips[0] || null;
export const ofTrip = (list, trip) => (trip ? list.filter((x) => x.tripId === trip.id) : []);

/* ---------- prep tasks ---------- */

const norm = (t) => t.replace(/[\s（）()·、，,。!！]/g, '').toLowerCase();
const bigrams = (t) => { const n = norm(t); return new Set([...n].slice(0, -1).map((c, i) => c + n[i + 1])); };

/** "提前订天空胶囊小火车" ≈ "预订海云台天空胶囊小火车": most of the shorter title's bigrams appear in the longer. */
export function sameTask(a, b) {
  const A = bigrams(a);
  const B = bigrams(b);
  if (norm(a) === norm(b)) return true;
  if (Math.min(A.size, B.size) < 4) return false;
  let common = 0;
  A.forEach((x) => B.has(x) && (common += 1));
  return common / Math.min(A.size, B.size) >= 0.6;
}

/**
 * Add tasks unless dismissed before. A near-duplicate (same tip from another
 * post) is merged into the existing task: it gains the source link and note.
 */
function mergeTasks(s, trip, drafts) {
  const dismissed = new Set(trip.dismissedAuto || []);
  const tasks = [...s.tasks];
  for (const d of drafts) {
    if (d.autoKey && dismissed.has(d.autoKey)) continue;
    const mine = tasks.filter((t) => t.tripId === trip.id);
    if (d.autoKey && mine.some((t) => t.autoKey === d.autoKey)) continue;
    const dup = mine.find((t) => sameTask(t.title, d.title));
    if (dup) {
      const i = tasks.indexOf(dup);
      const note = d.note && !(dup.note || '').includes(d.note) ? [dup.note, d.note].filter(Boolean).join('\n') : dup.note;
      tasks[i] = { ...dup, note, ...(!dup.sourceUrl && d.sourceUrl ? { sourceUrl: d.sourceUrl, sourceTitle: d.sourceTitle } : {}) };
      continue;
    }
    tasks.push({ id: uid(), tripId: trip.id, group: 'other', note: '', link: '', dueDate: '', done: false, ...d });
  }
  return tasks;
}

/* ---------- actions ---------- */

export const actions = {
  setActiveTrip(id) {
    set(() => ({ activeTripId: id }));
  },

  createTrip({ name, startDate, endDate, regions, withTemplates = true }) {
    const trip = { id: uid(), name, startDate, endDate, regions, dismissedAuto: [], createdAt: Date.now() };
    set((s) => {
      const next = { ...s, trips: [...s.trips, trip], activeTripId: trip.id };
      return withTemplates ? { ...next, tasks: mergeTasks(next, trip, templateTasks(trip)) } : next;
    });
    return trip.id;
  },

  updateTrip(id, patch) {
    set((s) => ({ trips: s.trips.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  },

  deleteTrip(id) {
    set((s) => {
      const trips = s.trips.filter((t) => t.id !== id);
      return {
        trips,
        saves: s.saves.filter((x) => x.tripId !== id),
        tasks: s.tasks.filter((x) => x.tripId !== id),
        activeTripId: s.activeTripId === id ? trips[0]?.id || null : s.activeTripId,
      };
    });
  },

  /** Re-add any template tasks that are missing (and not dismissed). */
  refreshPrep(tripId) {
    set((s) => {
      const trip = s.trips.find((t) => t.id === tripId);
      return trip ? { tasks: mergeTasks(s, trip, templateTasks(trip)) } : {};
    });
  },

  addSaves(tripId, drafts) {
    const now = Date.now();
    const saves = drafts.map((d, i) => ({
      id: uid(), tripId, status: 'saved', day: '', rating: 0, review: '', createdAt: now + i, ...d,
    }));
    set((s) => ({ saves: [...saves, ...s.saves] }));
    return saves.length;
  },

  updateSave(id, patch) {
    set((s) => ({ saves: s.saves.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  },

  deleteSave(id) {
    set((s) => ({ saves: s.saves.filter((x) => x.id !== id) }));
  },

  /** Returns how many were newly added; near-duplicates are merged into existing ones. */
  addTasks(tripId, drafts) {
    let added = 0;
    set((s) => {
      const trip = s.trips.find((t) => t.id === tripId);
      if (!trip) return {};
      const tasks = mergeTasks(s, trip, drafts);
      added = tasks.length - s.tasks.length;
      return { tasks };
    });
    return added;
  },

  updateTask(id, patch) {
    set((s) => ({ tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  },

  deleteTask(id) {
    set((s) => {
      const task = s.tasks.find((t) => t.id === id);
      const trips = task?.autoKey
        ? s.trips.map((t) => (t.id === task.tripId ? { ...t, dismissedAuto: [...(t.dismissedAuto || []), task.autoKey] } : t))
        : s.trips;
      return { tasks: s.tasks.filter((t) => t.id !== id), trips };
    });
  },

  exportJSON() {
    return JSON.stringify(state, null, 2);
  },

  importJSON(text) {
    const data = JSON.parse(text);
    if (!Array.isArray(data.trips)) throw new Error('不是行程备份文件');
    set(() => ({ ...EMPTY, ...(data.items ? migrate(data) : data) }));
  },

  resetDemo() {
    set(() => seedState(uid));
  },
};
