import { useEffect } from 'react';
import { todayISO } from './dates';

/*
 * One notification a day listing prep tasks that are due or overdue, shown the
 * first time the app is opened that day (if notifications are allowed).
 * A closed web page can't wake itself, so the calendar export (.ics) is the
 * dependable reminder; this is the "when you open the app" nudge.
 */

const FIRED = 'trip_reminders_fired';

export const notifySupported = () => typeof window !== 'undefined' && 'Notification' in window;
export const notifyGranted = () => notifySupported() && Notification.permission === 'granted';

export async function requestNotify() {
  if (!notifySupported()) return 'unsupported';
  return Notification.requestPermission();
}

function show(title, body) {
  try {
    new Notification(title, { body, tag: 'trip-tasks' });
  } catch {
    // Android Chrome only allows notifications via a service worker registration.
    navigator.serviceWorker?.ready?.then((r) => r.showNotification(title, { body, tag: 'trip-tasks' })).catch(() => {});
  }
}

export function useReminders(state, trip) {
  useEffect(() => {
    if (!trip || !notifyGranted()) return;
    const today = todayISO();
    try {
      if (localStorage.getItem(FIRED) === `${trip.id}:${today}`) return;
    } catch { /* ignore */ }
    const due = state.tasks.filter((t) => t.tripId === trip.id && !t.done && t.dueDate && t.dueDate <= today);
    if (!due.length) return;
    show(`📋 ${trip.name}：${due.length} 件事该处理了`, due.slice(0, 3).map((t) => t.title).join('、'));
    try { localStorage.setItem(FIRED, `${trip.id}:${today}`); } catch { /* ignore */ }
  }, [state.tasks, trip]);
}
