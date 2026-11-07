import { useSyncExternalStore } from 'react';
import { templateTasks, tasksFromItems } from './prep';
import { seedState } from './seed';

/*
 * Local-first store for the trip planner. Everything lives in one JSON blob in
 * localStorage so the module works without a backend. Every record carries a
 * tripId, so moving to a shared backend (and merging with the split-bill app,
 * keyed by the same trip) only means swapping load/persist.
 *
 * Shape:
 *   activeTripId
 *   trips:    { id, name, startDate, endDate, regions[], dismissedAuto[] }
 *   saves:    { id, tripId, title, url, platform, note, address, region, area, category, starred, done, rating, review }
 *   lodgings: { id, tripId, name, region, area, checkIn, checkOut }
 *   items:    { id, tripId, date, time, title, kind, saveId?, region, area, note, important, remindMin, done, rating, review }
 *   tasks:    { id, tripId, group, title, note, link, dueDate, done, autoKey? }
 */

const KEY = 'trip_planner_v1';
const EMPTY = { activeTripId: null, trips: [], saves: [], lodgings: [], items: [], tasks: [] };

const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return { ...EMPTY, ...JSON.parse(raw) };
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

// Write the seeded demo right away so its ids stay stable across reloads.
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

/* ---------- derived helpers (pure) ---------- */

export const activeTrip = (s) => s.trips.find((t) => t.id === s.activeTripId) || s.trips[0] || null;
export const ofTrip = (list, trip) => (trip ? list.filter((x) => x.tripId === trip.id) : []);

/** Done/rating of an itinerary item lives on its linked save when there is one. */
export function itemStatus(s, item) {
  const save = item.saveId && s.saves.find((x) => x.id === item.saveId);
  const src = save || item;
  return { done: !!src.done, rating: src.rating || 0, review: src.review || '' };
}

/** Lodging for the night of `date` (check-in ≤ date < check-out), else the one you check out of. */
export function lodgingFor(lodgings, date) {
  return (
    lodgings.find((l) => l.checkIn <= date && date < l.checkOut) ||
    lodgings.find((l) => l.checkOut === date) ||
    null
  );
}

/* ---------- auto tasks ---------- */

function mergeAutoTasks(s, trip, drafts) {
  const dismissed = new Set(trip.dismissedAuto || []);
  const tasks = [...s.tasks];
  const has = (key) => tasks.some((t) => t.tripId === trip.id && t.autoKey === key);
  for (const { covers, ...d } of drafts) {
    if (dismissed.has(d.autoKey)) continue;
    // A template task (e.g. "买 KTX 车票") already covers this item → don't duplicate it.
    if (covers && has(covers) && !has(d.autoKey)) continue;
    const i = tasks.findIndex((t) => t.tripId === trip.id && t.autoKey === d.autoKey);
    if (i === -1) tasks.push({ id: uid(), tripId: trip.id, done: false, ...d });
    else if (!tasks[i].done) tasks[i] = { ...tasks[i], dueDate: d.dueDate, note: d.note || tasks[i].note };
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
      return withTemplates ? { ...next, tasks: mergeAutoTasks(next, trip, templateTasks(trip)) } : next;
    });
    return trip.id;
  },

  updateTrip(id, patch) {
    set((s) => ({ trips: s.trips.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  },

  deleteTrip(id) {
    set((s) => {
      const keep = (x) => x.tripId !== id;
      const trips = s.trips.filter((t) => t.id !== id);
      return {
        trips,
        saves: s.saves.filter(keep),
        lodgings: s.lodgings.filter(keep),
        items: s.items.filter(keep),
        tasks: s.tasks.filter(keep),
        activeTripId: s.activeTripId === id ? trips[0]?.id || null : s.activeTripId,
      };
    });
  },

  /** Re-add any template / itinerary-derived prep tasks that are missing. */
  refreshPrep(tripId) {
    set((s) => {
      const trip = s.trips.find((t) => t.id === tripId);
      if (!trip) return {};
      const items = s.items.filter((i) => i.tripId === tripId);
      return { tasks: mergeAutoTasks(s, trip, [...templateTasks(trip), ...tasksFromItems(items)]) };
    });
  },

  addSaves(tripId, drafts) {
    const now = Date.now();
    const saves = drafts.map((d, i) => ({
      id: uid(), tripId, starred: false, done: false, rating: 0, review: '', createdAt: now + i, ...d,
    }));
    set((s) => ({ saves: [...saves, ...s.saves] }));
    return saves.map((x) => x.id);
  },

  updateSave(id, patch) {
    set((s) => ({ saves: s.saves.map((x) => (x.id === id ? { ...x, ...patch } : x)) }));
  },

  deleteSave(id) {
    set((s) => ({
      saves: s.saves.filter((x) => x.id !== id),
      // Keep scheduled stops, just unlink them.
      items: s.items.map((i) => (i.saveId === id ? { ...i, saveId: null } : i)),
    }));
  },

  addItem(tripId, draft) {
    const item = {
      id: uid(), tripId, time: '', kind: 'place', note: '', important: false, remindMin: 30,
      done: false, rating: 0, review: '', ...draft,
    };
    set((s) => {
      const trip = s.trips.find((t) => t.id === tripId);
      const next = { ...s, items: [...s.items, item] };
      return { items: next.items, tasks: trip ? mergeAutoTasks(next, trip, tasksFromItems([item])) : s.tasks };
    });
    return item.id;
  },

  updateItem(id, patch) {
    set((s) => {
      const items = s.items.map((i) => (i.id === id ? { ...i, ...patch } : i));
      const item = items.find((i) => i.id === id);
      const trip = item && s.trips.find((t) => t.id === item.tripId);
      return { items, tasks: trip ? mergeAutoTasks({ ...s, items }, trip, tasksFromItems([item])) : s.tasks };
    });
  },

  /** Check-off / rate an item; writes through to the linked save. */
  setItemStatus(item, patch) {
    if (item.saveId && state.saves.some((x) => x.id === item.saveId)) actions.updateSave(item.saveId, patch);
    else actions.updateItem(item.id, patch);
  },

  deleteItem(id) {
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
  },

  upsertLodging(tripId, lodging) {
    set((s) => {
      if (lodging.id) return { lodgings: s.lodgings.map((l) => (l.id === lodging.id ? { ...l, ...lodging } : l)) };
      return { lodgings: [...s.lodgings, { ...lodging, id: uid(), tripId }] };
    });
  },

  deleteLodging(id) {
    set((s) => ({ lodgings: s.lodgings.filter((l) => l.id !== id) }));
  },

  addTask(tripId, draft) {
    set((s) => ({ tasks: [...s.tasks, { id: uid(), tripId, group: 'other', note: '', link: '', dueDate: '', done: false, ...draft }] }));
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
    set(() => ({ ...EMPTY, ...data }));
  },

  resetDemo() {
    set(() => seedState(uid));
  },
};
