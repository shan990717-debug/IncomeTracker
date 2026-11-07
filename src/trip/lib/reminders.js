import { useEffect } from 'react';
import { itemStatus } from './store';
import { todayISO, toMinutes } from './dates';

/*
 * In-app reminders: while the app is open (or a tab is in the background),
 * important stops for today fire a browser notification `remindMin` before.
 * Browsers can't wake a closed web page, so the calendar export (.ics) is the
 * dependable phone reminder; this covers the "app is open" case.
 */

const FIRED = 'trip_reminders_fired';

export const notifySupported = () => typeof window !== 'undefined' && 'Notification' in window;
export const notifyGranted = () => notifySupported() && Notification.permission === 'granted';

export async function requestNotify() {
  if (!notifySupported()) return 'unsupported';
  return Notification.requestPermission();
}

function fired() {
  try {
    const v = JSON.parse(localStorage.getItem(FIRED) || '{}');
    return v.date === todayISO() ? v : { date: todayISO(), ids: [] };
  } catch {
    return { date: todayISO(), ids: [] };
  }
}

function markFired(id) {
  const v = fired();
  v.ids.push(id);
  try { localStorage.setItem(FIRED, JSON.stringify(v)); } catch { /* ignore */ }
}

function show(title, body, tag) {
  try {
    new Notification(title, { body, tag });
  } catch {
    // Android Chrome only allows notifications via a service worker registration.
    navigator.serviceWorker?.ready?.then((r) => r.showNotification(title, { body, tag })).catch(() => {});
  }
}

export function useReminders(state, trip) {
  useEffect(() => {
    if (!trip || !notifyGranted()) return;
    const today = todayISO();
    const items = state.items.filter((i) => i.tripId === trip.id && i.date === today && i.important && i.time && !itemStatus(state, i).done);
    const timers = [];
    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const done = new Set(fired().ids);

    for (const it of items) {
      if (done.has(it.id)) continue;
      const at = toMinutes(it.time) - (it.remindMin || 30);
      const fire = () => { show(`⏰ ${it.time} ${it.title}`, it.note || it.area || '', it.id); markFired(it.id); };
      if (at <= nowMin && toMinutes(it.time) >= nowMin) fire();
      else if (at > nowMin) timers.push(setTimeout(fire, (at - nowMin) * 60000 - now.getSeconds() * 1000));
    }

    // Prep tasks due today: one summary notification per day.
    const due = state.tasks.filter((t) => t.tripId === trip.id && !t.done && t.dueDate && t.dueDate <= today);
    if (due.length && !done.has('tasks')) {
      show(`📋 有 ${due.length} 件准备事项该处理了`, due.slice(0, 3).map((t) => t.title).join('、'), 'tasks');
      markFired('tasks');
    }
    return () => timers.forEach(clearTimeout);
  }, [state, trip]);
}
