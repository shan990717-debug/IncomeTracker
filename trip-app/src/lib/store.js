import { useSyncExternalStore } from 'react';
import { toast } from 'sonner';
import { seedState } from './seed';
import { supabase, sharedMode } from './supabase';

/*
 * One in-memory store drives the UI. Two backends:
 *   - shared (Supabase configured): rows live in Postgres, guarded by RLS so
 *     only trip members see them; realtime pushes 旅伴's changes in.
 *   - local (no Supabase): one JSON blob in localStorage, for trying the app.
 *
 * Every action edits the in-memory state first (instant UI), then the shared
 * backend diffs old vs new collections by object identity and writes only the
 * rows that changed. Remote changes are applied without being written back.
 *
 *   trips:   { id, name, startDate, endDate, regions[], dismissedAuto[], inviteCode, createdBy }
 *   members: { tripId, userId, displayName }
 *   saves:   { id, tripId, title, nameLocal, url, platform, thumbnail, note, address, country, region, area,
 *              category, subtype, lat, lng, geo: 'kakao'|'osm'|'manual'|'', placeUrl, raw, ai, unsure, addedBy }
 */

const LOCAL_KEY = 'trip_planner_v2';
const ACTIVE_KEY = 'trip_active_id';
const EMPTY = { activeTripId: null, trips: [], members: [], saves: [] };

export const uid = () =>
  (globalThis.crypto?.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36));

/* ---------- state plumbing ---------- */

// phase: 'loading' | 'signedOut' | 'ready'
let state = { ...EMPTY, phase: 'loading', user: null };
const listeners = new Set();
const emit = () => listeners.forEach((l) => l());

const readPref = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const writePref = (k, v) => { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch { /* ignore */ } };

/** Apply a change made by this user: update UI, then persist. */
function set(updater) {
  const prev = state;
  state = { ...state, ...updater(state) };
  if (state.activeTripId !== prev.activeTripId) writePref(ACTIVE_KEY, state.activeTripId);
  emit();
  if (sharedMode) queueRemoteWrite(prev, state);
  else writePref(LOCAL_KEY, JSON.stringify(pick(state)));
}

/** Apply a change that came from the server (no write-back). */
function setQuiet(patch) {
  state = { ...state, ...patch };
  emit();
}

const pick = ({ activeTripId, trips, saves }) => ({ activeTripId, trips, saves });

export function useTripState() {
  return useSyncExternalStore((l) => { listeners.add(l); return () => listeners.delete(l); }, () => state);
}

export const getState = () => state;
export const activeTrip = (s) => s.trips.find((t) => t.id === s.activeTripId) || s.trips[0] || null;
export const ofTrip = (list, trip) => (trip ? list.filter((x) => x.tripId === trip.id) : []);
export const memberName = (s, tripId, userId) =>
  s.members.find((m) => m.tripId === tripId && m.userId === userId)?.displayName || '';

/* ---------- row mapping (camelCase app ⇄ snake_case DB) ---------- */

const dateOrNull = (d) => d || null;
const toTrip = (r) => ({
  id: r.id, name: r.name, startDate: r.start_date || '', endDate: r.end_date || '', regions: r.regions || [],
  dismissedAuto: r.dismissed_auto || [], inviteCode: r.invite_code, createdBy: r.created_by,
});
const fromTrip = (t) => ({
  id: t.id, name: t.name, start_date: dateOrNull(t.startDate), end_date: dateOrNull(t.endDate),
  regions: t.regions || [], dismissed_auto: t.dismissedAuto || [],
});
const toSave = (r) => ({
  id: r.id, tripId: r.trip_id, title: r.title, nameLocal: r.name_local, url: r.url, platform: r.platform,
  thumbnail: r.thumbnail, note: r.note, address: r.address, country: r.country || '', region: r.region, area: r.area,
  category: r.category, subtype: r.subtype || '', lat: r.lat ?? null, lng: r.lng ?? null, geo: r.geo || '',
  placeUrl: r.place_url || '', raw: r.raw, ai: r.ai, unsure: r.unsure, addedBy: r.added_by, createdAt: Date.parse(r.created_at) || 0,
});
const fromSave = (s) => ({
  id: s.id, trip_id: s.tripId, title: s.title || '', name_local: s.nameLocal || '', url: s.url || '',
  platform: s.platform || '', thumbnail: s.thumbnail || '', note: s.note || '', address: s.address || '',
  country: s.country || '', region: s.region || '', area: s.area || '', category: s.category || 'place',
  subtype: s.subtype || '', lat: Number.isFinite(s.lat) ? s.lat : null, lng: Number.isFinite(s.lng) ? s.lng : null,
  geo: s.geo || '', place_url: s.placeUrl || '', raw: s.raw || '', ai: !!s.ai, unsure: !!s.unsure,
});
const toMember = (r) => ({ tripId: r.trip_id, userId: r.user_id, displayName: r.display_name });

const TABLES = [
  { key: 'trips', table: 'trips', from: fromTrip },
  { key: 'saves', table: 'saves', from: fromSave },
];

/* ---------- shared backend: writes ---------- */

let writeChain = Promise.resolve();

function diff(prev, next, key) {
  const before = new Map(prev[key].map((x) => [x.id, x]));
  const after = new Set(next[key].map((x) => x.id));
  return {
    upserts: next[key].filter((x) => before.get(x.id) !== x),
    deletes: prev[key].filter((x) => !after.has(x.id)).map((x) => x.id),
  };
}

function queueRemoteWrite(prev, next) {
  const ops = TABLES.map((t) => ({ ...t, ...diff(prev, next, t.key) }));
  if (!ops.some((o) => o.upserts.length || o.deletes.length)) return;
  writeChain = writeChain.then(async () => {
    try {
      // Parents first on insert (trips → saves/tasks); children first on delete.
      for (const o of ops) {
        if (!o.upserts.length) continue;
        const { error } = await supabase.from(o.table).upsert(o.upserts.map(o.from));
        if (error) throw error;
      }
      for (const o of [...ops].reverse()) {
        if (!o.deletes.length) continue;
        const { error } = await supabase.from(o.table).delete().in('id', o.deletes);
        if (error) throw error;
      }
    } catch (e) {
      console.error(e);
      // PGRST204 = column missing: the new SQL migration hasn't been run yet.
      toast.error(e?.code === 'PGRST204' || /column/i.test(e?.message || '')
        ? '资料库还没更新：请在 Supabase 的 SQL Editor 跑一次 migrations/002_places.sql'
        : '没有存到云端，已重新同步', { duration: 10000 });
      await loadShared();
    }
  });
}

/* ---------- shared backend: reads + realtime ---------- */

let channel = null;

async function loadShared() {
  const [trips, members, saves] = await Promise.all([
    supabase.from('trips').select('*').order('created_at'),
    supabase.from('trip_members').select('*'),
    supabase.from('saves').select('*').order('created_at', { ascending: false }),
  ]);
  const err = trips.error || members.error || saves.error;
  if (err) {
    toast.error(`读取失败：${err.message}`);
    return;
  }
  const tripList = trips.data.map(toTrip);
  const pref = readPref(ACTIVE_KEY);
  setQuiet({
    phase: 'ready',
    trips: tripList,
    members: members.data.map(toMember),
    saves: saves.data.map(toSave),
    activeTripId: tripList.some((t) => t.id === pref) ? pref : tripList[0]?.id || null,
  });
}

function applyRemote(key, map, payload) {
  const { eventType, new: row, old } = payload;
  const list = state[key];
  if (eventType === 'DELETE') {
    setQuiet({ [key]: list.filter((x) => x.id !== old.id) });
    return;
  }
  const item = map(row);
  const i = list.findIndex((x) => x.id === item.id);
  setQuiet({ [key]: i === -1 ? [item, ...list] : list.map((x, j) => (j === i ? { ...x, ...item } : x)) });
}

function subscribe() {
  channel?.unsubscribe();
  channel = supabase
    .channel('trip-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'saves' }, (p) => applyRemote('saves', toSave, p))
    .on('postgres_changes', { event: '*', schema: 'public', table: 'trips' }, (p) => applyRemote('trips', toTrip, p))
    // Membership changes (someone joined / left) are rare: just reload.
    .on('postgres_changes', { event: '*', schema: 'public', table: 'trip_members' }, () => loadShared())
    .subscribe();
}

/* ---------- boot ---------- */

function bootLocal() {
  let data = null;
  try {
    const raw = localStorage.getItem(LOCAL_KEY);
    if (raw) data = JSON.parse(raw);
  } catch { /* corrupted → reseed */ }
  if (!data) {
    data = seedState(uid);
    writePref(LOCAL_KEY, JSON.stringify(data));
  }
  state = { ...state, ...EMPTY, ...data, phase: 'ready', user: { id: 'local', email: '' } };
}

if (typeof window !== 'undefined') {
  if (!sharedMode) {
    bootLocal();
  } else {
    supabase.auth.onAuthStateChange((event, session) => {
      // Opened a password-reset link: ask for a new password before anything else.
      if (event === 'PASSWORD_RECOVERY') setQuiet({ recovering: true });
      const user = session?.user || null;
      if (!user) {
        channel?.unsubscribe();
        setQuiet({ ...EMPTY, phase: 'signedOut', user: null });
        return;
      }
      if (state.user?.id === user.id && state.phase === 'ready') return;
      setQuiet({ user, phase: 'loading' });
      // Defer: Supabase recommends not awaiting other calls inside this callback.
      setTimeout(() => { loadShared(); subscribe(); }, 0);
    });
  }
}

/* ---------- actions ---------- */

export const actions = {
  setActiveTrip(id) {
    set(() => ({ activeTripId: id }));
  },

  createTrip({ name, startDate, endDate, regions }) {
    const trip = { id: uid(), name, startDate, endDate, regions, dismissedAuto: [], createdBy: state.user?.id };
    set((s) => ({ trips: [...s.trips, trip], activeTripId: trip.id }));
    // The DB trigger adds the creator as a member; mirror it locally for the UI.
    if (sharedMode) setQuiet({ members: [...state.members, { tripId: trip.id, userId: state.user.id, displayName: myName() }] });
    return trip.id;
  },

  updateTrip(id, patch) {
    set((s) => ({ trips: s.trips.map((t) => (t.id === id ? { ...t, ...patch } : t)) }));
  },

  /** Creator deletes the trip for everyone; anyone else just leaves it. */
  async deleteTrip(id) {
    const trip = state.trips.find((t) => t.id === id);
    const drop = (s) => {
      const trips = s.trips.filter((t) => t.id !== id);
      return {
        trips,
        saves: s.saves.filter((x) => x.tripId !== id),
        members: s.members.filter((m) => m.tripId !== id),
        activeTripId: s.activeTripId === id ? trips[0]?.id || null : s.activeTripId,
      };
    };
    if (sharedMode && trip?.createdBy !== state.user?.id) {
      const { error } = await supabase.from('trip_members').delete().match({ trip_id: id, user_id: state.user.id });
      if (error) return toast.error(error.message);
      setQuiet(drop(state));
      return;
    }
    if (sharedMode) {
      // Cascade in the DB removes saves/tasks; delete the trip row only.
      const { error } = await supabase.from('trips').delete().eq('id', id);
      if (error) return toast.error(error.message);
      setQuiet(drop(state));
      return;
    }
    set(drop);
  },

  addSaves(tripId, drafts) {
    const now = Date.now();
    const saves = drafts.map((d, i) => ({
      id: uid(), tripId, addedBy: state.user?.id, createdAt: now + i, ...d,
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

  /* --- sharing (shared mode only) --- */

  async joinTrip(code) {
    const { data, error } = await supabase.rpc('join_trip', { code });
    if (error) throw error;
    if (!data) throw new Error('邀请码不对');
    await loadShared();
    set(() => ({ activeTripId: data }));
    return data;
  },

  async resetInvite(tripId) {
    const { data, error } = await supabase.rpc('reset_invite', { t: tripId });
    if (error) throw error;
    setQuiet({ trips: state.trips.map((t) => (t.id === tripId ? { ...t, inviteCode: data } : t)) });
    return data;
  },

  async setMyName(name) {
    await supabase.auth.updateUser({ data: { name } });
    await supabase.from('trip_members').update({ display_name: name }).eq('user_id', state.user.id);
    await loadShared();
  },

  doneRecovering() {
    setQuiet({ recovering: false });
  },

  async signOut() {
    await supabase.auth.signOut();
  },

  /* --- local mode backup --- */

  exportJSON() {
    return JSON.stringify(pick(state), null, 2);
  },

  importJSON(text) {
    const data = JSON.parse(text);
    if (!Array.isArray(data.trips)) throw new Error('不是备份文件');
    set(() => ({ ...EMPTY, activeTripId: data.activeTripId, trips: data.trips, saves: data.saves || [] }));
  },

  resetDemo() {
    set(() => seedState(uid));
  },
};

export function myName() {
  const u = state.user;
  return u?.user_metadata?.name || (u?.email || '').split('@')[0] || '我';
}
