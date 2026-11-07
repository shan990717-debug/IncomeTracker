import React, { useMemo, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { BookMarked, ClipboardCheck, Plus, ChevronDown } from 'lucide-react';
import { Toaster } from 'sonner';
import { cn } from '@/lib/utils';
import { useTripState, activeTrip, ofTrip } from '../lib/store';
import { md, daysBetween, todayISO } from '../lib/dates';
import { useReminders } from '../lib/reminders';
import CollectSheet from './CollectSheet';
import TripSheet from './TripSheet';
import { Empty, PrimaryButton } from './ui';
import '../trip.css';

function Tab({ to, end, icon: Icon, label, badge }) {
  return (
    <NavLink to={to} end={end}
      className={({ isActive }) => cn('relative flex flex-col items-center justify-center flex-1 py-2 gap-0.5 transition-colors select-none',
        isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground')}>
      <Icon className="w-5 h-5" />
      <span className="text-[11px] font-semibold">{label}</span>
      {badge > 0 && <span className="absolute top-1 left-1/2 ml-2 min-w-[16px] h-4 px-1 rounded-full bg-destructive text-white text-[10px] font-bold leading-4 text-center">{badge}</span>}
    </NavLink>
  );
}

export default function TripLayout() {
  const state = useTripState();
  const trip = activeTrip(state);
  const [collectOpen, setCollectOpen] = useState(false);
  const [tripOpen, setTripOpen] = useState(!trip);
  useReminders(state, trip);

  const countdown = useMemo(() => {
    if (!trip) return '';
    const d = daysBetween(todayISO(), trip.startDate);
    if (d > 0) return `还有 ${d} 天出发`;
    return daysBetween(todayISO(), trip.endDate) >= 0 ? `旅行第 ${-d + 1} 天` : '已结束';
  }, [trip]);

  // Red badge on 出发准备: tasks due today or overdue.
  const dueCount = trip ? ofTrip(state.tasks, trip).filter((t) => !t.done && t.dueDate && t.dueDate <= todayISO()).length : 0;

  return (
    <div className="min-h-screen bg-background max-w-lg mx-auto relative">
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur border-b border-border/60 px-4 pt-3 pb-2.5 flex items-center gap-3">
        <button onClick={() => setTripOpen(true)} className="flex-1 min-w-0 text-left">
          <div className="flex items-center gap-1">
            <h1 className="text-lg font-extrabold truncate">{trip?.name || '新建旅行'}</h1>
            <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
          </div>
          {trip && (
            <p className="text-xs text-muted-foreground truncate">
              {md(trip.startDate)} – {md(trip.endDate)} · {trip.regions.join(' · ')} · <span className="text-primary font-semibold">{countdown}</span>
            </p>
          )}
        </button>
        <Link to="/" className="text-xs font-semibold text-muted-foreground border border-border rounded-full px-3 py-1.5 hover:text-foreground">记账</Link>
      </header>

      <main className="pb-28">
        {trip ? (
          <Outlet context={{ state, trip, openCollect: () => setCollectOpen(true) }} />
        ) : (
          <Empty emoji="🧳" title="还没有旅行">
            <PrimaryButton className="mt-4" onClick={() => setTripOpen(true)}>新建一个旅行</PrimaryButton>
          </Empty>
        )}
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-40 max-w-lg mx-auto select-none">
        <div className="bg-card border-t border-border flex items-center px-6 pt-1" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
          <Tab to="/trip" end icon={BookMarked} label="攻略库" />
          <div className="flex-1 flex flex-col items-center">
            <button onClick={() => trip && setCollectOpen(true)} aria-label="收集攻略"
              className="w-14 h-14 -mt-6 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center active:scale-95 transition">
              <Plus className="w-7 h-7" />
            </button>
            <span className="text-[11px] font-semibold text-muted-foreground mt-0.5">收集</span>
          </div>
          <Tab to="/trip/prep" icon={ClipboardCheck} label="出发准备" badge={dueCount} />
        </div>
      </nav>

      {trip && <CollectSheet open={collectOpen} onClose={() => setCollectOpen(false)} trip={trip} />}
      <Toaster position="top-center" richColors />
      <TripSheet open={tripOpen} onClose={() => setTripOpen(false)} state={state} trip={trip} />
    </div>
  );
}
