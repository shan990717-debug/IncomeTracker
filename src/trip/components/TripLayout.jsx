import React, { useMemo, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { Bookmark, CalendarDays, Bell, ClipboardCheck, ClipboardPaste, ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useTripState, activeTrip } from '../lib/store';
import { md, daysBetween, todayISO } from '../lib/dates';
import PasteSheet from './PasteSheet';
import TripSheet from './TripSheet';
import { Empty, PrimaryButton } from './ui';
import { useReminders } from '../lib/reminders';
import { Toaster } from 'sonner';
import '../trip.css';

const TABS_LEFT = [
  { to: '/trip', end: true, icon: Bookmark, label: '收藏' },
  { to: '/trip/plan', icon: CalendarDays, label: '行程' },
];
const TABS_RIGHT = [
  { to: '/trip/today', icon: Bell, label: '今天' },
  { to: '/trip/prep', icon: ClipboardCheck, label: '准备' },
];

function Tab({ to, end, icon: Icon, label }) {
  return (
    <NavLink to={to} end={end}
      className={({ isActive }) => cn('flex flex-col items-center justify-center flex-1 py-2 gap-0.5 transition-colors select-none',
        isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}>
      <Icon className="w-5 h-5" />
      <span className="text-[10px] font-semibold">{label}</span>
    </NavLink>
  );
}

export default function TripLayout() {
  const state = useTripState();
  const trip = activeTrip(state);
  const [pasteOpen, setPasteOpen] = useState(false);
  const [tripOpen, setTripOpen] = useState(!trip);
  useReminders(state, trip);

  const countdown = useMemo(() => {
    if (!trip) return '';
    const d = daysBetween(todayISO(), trip.startDate);
    if (d > 0) return `还有 ${d} 天出发`;
    const left = daysBetween(todayISO(), trip.endDate);
    if (left >= 0) return `旅行第 ${-d + 1} 天`;
    return '已结束';
  }, [trip]);

  return (
    <div className="min-h-screen bg-background max-w-lg mx-auto relative">
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur border-b border-border/60 px-4 pt-3 pb-2.5 flex items-center gap-3">
        <button onClick={() => setTripOpen(true)} className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-1">
            <h1 className="text-lg font-extrabold truncate">{trip?.name || '新建行程'}</h1>
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          </div>
          {trip && (
            <p className="text-xs text-muted-foreground truncate">
              {md(trip.startDate)} – {md(trip.endDate)} · {trip.regions.join(' · ')} · <span className="text-primary font-semibold">{countdown}</span>
            </p>
          )}
        </button>
        <Link to="/" className="text-xs font-semibold text-muted-foreground border border-border rounded-full px-3 py-1.5 hover:text-foreground">
          记账
        </Link>
      </header>

      <main className="pb-28">
        {trip ? (
          <Outlet context={{ state, trip, openPaste: () => setPasteOpen(true) }} />
        ) : (
          <Empty emoji="🧳" title="还没有行程">
            <PrimaryButton className="mt-4" onClick={() => setTripOpen(true)}>新建一个行程</PrimaryButton>
          </Empty>
        )}
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-40 max-w-lg mx-auto select-none">
        <div className="bg-card border-t border-border flex items-center px-2 pt-1" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
          {TABS_LEFT.map((t) => <Tab key={t.to} {...t} />)}
          <div className="flex-1 flex flex-col items-center">
            <button onClick={() => trip && setPasteOpen(true)} aria-label="粘贴收藏"
              className="w-14 h-14 -mt-6 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center active:scale-95 transition">
              <ClipboardPaste className="w-6 h-6" />
            </button>
            <span className="text-[10px] font-semibold text-muted-foreground mt-0.5">粘贴</span>
          </div>
          {TABS_RIGHT.map((t) => <Tab key={t.to} {...t} />)}
        </div>
      </nav>

      {trip && <PasteSheet open={pasteOpen} onClose={() => setPasteOpen(false)} trip={trip} />}
      <Toaster position="top-center" richColors closeButton={false} />
      <TripSheet open={tripOpen} onClose={() => setTripOpen(false)} state={state} trip={trip} />
    </div>
  );
}
