import React, { useEffect, useState } from 'react';
import { Navigate, NavLink, Outlet, useLocation, useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { Plus, ChevronLeft, Home, BookMarked, CalendarDays } from 'lucide-react';
import { cn } from '../lib/utils';
import { actions, useTripState, ofTrip, myName } from '../lib/store';
import { relevantToTrip } from '../lib/tips';
import { tripFlag, countdownLabel } from '../lib/tripInfo';
import { md } from '../lib/dates';
import { sharedMode } from '../lib/supabase';
import CollectSheet from './CollectSheet';
import TripSettingsSheet from './TripSettingsSheet';
import AccountSheet, { Avatar } from './AccountSheet';

const COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ec4899', '#0ea5e9'];

/** Small stacked initials of who's in this trip (shared mode). */
function MemberDots({ state, trip, onClick }) {
  const members = state.members.filter((m) => m.tripId === trip.id);
  if (!members.length) return null;
  return (
    <button onClick={onClick} className="flex -space-x-2 shrink-0" aria-label="旅伴">
      {members.slice(0, 4).map((m, i) => (
        <span key={m.userId} className="w-8 h-8 rounded-full border-2 border-background flex items-center justify-center text-xs font-bold text-white"
          style={{ background: COLORS[i % COLORS.length] }}>
          {(m.displayName || '?').slice(0, 1).toUpperCase()}
        </span>
      ))}
      {members.length === 1 && <span className="w-8 h-8 rounded-full border-2 border-dashed border-muted-foreground/40 bg-background flex items-center justify-center text-muted-foreground text-sm">+</span>}
    </button>
  );
}

function Tab({ to, end, icon: Icon, label }) {
  return (
    <NavLink to={to} end={end}
      className={({ isActive }) => cn('flex-1 flex flex-col items-center justify-center py-1.5 gap-0.5 select-none', isActive ? 'text-primary' : 'text-muted-foreground')}>
      <Icon className="w-5 h-5" />
      <span className="text-[11px] font-bold">{label}</span>
    </NavLink>
  );
}

/** 攻略库 = 📍 地点 / 📝 须知, switched at the top. */
export function LibraryLayout() {
  const ctx = useOutletContext();
  const { state, trip } = ctx;
  const places = ofTrip(state.saves, trip).length;
  const tips = ofTrip(state.tips, trip).filter((t) => relevantToTrip(t, trip)).length;
  const cls = ({ isActive }) => `flex-1 text-center rounded-xl py-2 text-sm font-extrabold transition ${isActive ? 'bg-card shadow text-foreground' : 'text-muted-foreground'}`;
  return (
    <>
      <div className="flex gap-1 mx-4 mt-3 rounded-2xl bg-muted p-1">
        <NavLink to={`/t/${trip.id}/library`} end className={cls}>📍 地点 {places}</NavLink>
        <NavLink to={`/t/${trip.id}/library/tips`} className={cls}>📝 须知 {tips}</NavLink>
      </div>
      <Outlet context={ctx} />
    </>
  );
}

/** Everything inside one trip: header, the page, bottom tabs and the 收集 button. */
export default function TripLayout() {
  const state = useTripState();
  const { tripId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const trip = state.trips.find((t) => t.id === tripId);
  const [collectOpen, setCollectOpen] = useState(false);
  const [collectText, setCollectText] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  // Remember the last trip opened (the Android share target lands there).
  useEffect(() => { if (trip && state.activeTripId !== trip.id) actions.setActiveTrip(trip.id); }, [trip?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Shared from another app (see /share): open 收集 with the text.
  useEffect(() => {
    const shared = location.state?.shareText;
    if (!shared) return;
    setCollectText(shared);
    setCollectOpen(true);
    navigate(location.pathname, { replace: true, state: null });
  }, [location.state]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!trip) return <Navigate to="/" replace />; // deleted, left, or not a member
  const base = `/t/${trip.id}`;
  const dates = trip.startDate ? `${md(trip.startDate)} – ${md(trip.endDate || trip.startDate)} · ` : '';

  return (
    <div className="min-h-screen bg-background max-w-lg mx-auto relative">
      <header className="sticky top-0 z-30 bg-background/90 backdrop-blur border-b border-border/60 pl-2 pr-4 pt-3 pb-2.5 flex items-center gap-2">
        <button onClick={() => navigate('/')} aria-label="回到我的旅行" className="w-9 h-9 -ml-0.5 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted shrink-0">
          <ChevronLeft className="w-6 h-6" />
        </button>
        <button onClick={() => setSettingsOpen(true)} className="flex-1 min-w-0 text-left">
          <h1 className="text-lg font-extrabold truncate">{tripFlag(trip)} {trip.name}</h1>
          <p className="text-xs text-muted-foreground truncate">
            {dates}{trip.regions.join(' · ')} · <span className="text-primary font-semibold">{countdownLabel(trip)}</span>
          </p>
        </button>
        <MemberDots state={state} trip={trip} onClick={() => setSettingsOpen(true)} />
        <button onClick={() => setAccountOpen(true)} aria-label="我的账号"><Avatar name={sharedMode ? myName() : '试'} /></button>
      </header>

      <main className="pb-28">
        <Outlet context={{ state, trip, openCollect: () => setCollectOpen(true), openSettings: () => setSettingsOpen(true) }} />
      </main>

      <nav className="fixed bottom-0 inset-x-0 z-40 max-w-lg mx-auto select-none">
        <div className="bg-card border-t border-border flex items-end px-2 pt-1.5" style={{ paddingBottom: 'calc(0.6rem + env(safe-area-inset-bottom))' }}>
          <Tab to={base} end icon={Home} label="总览" />
          <Tab to={`${base}/library`} icon={BookMarked} label="攻略库" />
          <div className="flex-1 flex flex-col items-center">
            <button onClick={() => setCollectOpen(true)} aria-label="收集攻略"
              className="w-14 h-14 -mt-7 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center active:scale-95 transition">
              <Plus className="w-7 h-7" />
            </button>
            <span className="text-[11px] font-bold text-muted-foreground mt-0.5">收集</span>
          </div>
          <Tab to={`${base}/plan`} icon={CalendarDays} label="行程" />
        </div>
      </nav>

      <CollectSheet open={collectOpen} onClose={() => { setCollectOpen(false); setCollectText(''); }} trip={trip} initialText={collectText} />
      <TripSettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} state={state} trip={trip} />
      <AccountSheet open={accountOpen} onClose={() => setAccountOpen(false)} state={state} />
    </div>
  );
}
