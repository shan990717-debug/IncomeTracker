import React, { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { BookMarked, ClipboardCheck, Plus, ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';
import { useTripState, activeTrip, ofTrip } from '../lib/store';
import { md, daysBetween, todayISO } from '../lib/dates';
import { useReminders } from '../lib/reminders';
import CollectSheet from './CollectSheet';
import TripSheet from './TripSheet';
import { PrimaryButton, inputCls } from './ui';
import AccountSheet, { Avatar } from './AccountSheet';
import { sharedMode } from '../lib/supabase';
import { actions, myName } from '../lib/store';
import { toast } from 'sonner';

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

/** Small stacked initials of who's in this trip (shared mode). */
function MemberDots({ state, trip, onClick }) {
  const members = trip ? state.members.filter((m) => m.tripId === trip.id) : [];
  if (members.length < 1) return null;
  return (
    <button onClick={onClick} className="flex -space-x-2 shrink-0" aria-label="旅伴">
      {members.slice(0, 4).map((m, i) => (
        <span key={m.userId} className="w-8 h-8 rounded-full border-2 border-background flex items-center justify-center text-xs font-bold text-white"
          style={{ background: ['#10b981', '#6366f1', '#f59e0b', '#ec4899'][i % 4] }}>
          {(m.displayName || '?').slice(0, 1).toUpperCase()}
        </span>
      ))}
      {members.length === 1 && <span className="w-8 h-8 rounded-full border-2 border-dashed border-muted-foreground/40 bg-background flex items-center justify-center text-muted-foreground text-sm">+</span>}
    </button>
  );
}

/** Home when you have no trip yet: start one, or join a buddy's with their invite code/link. */
function Welcome({ onCreate }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const join = async () => {
    // Accept the whole invite link or just the code.
    const c = code.trim().split('/join/').pop().replace(/[^a-z0-9]/gi, '');
    if (!c) return;
    setBusy(true);
    try { await actions.joinTrip(c); toast.success('已加入旅行 🎉'); } catch (e) { toast.error(e.message || '加入失败'); }
    setBusy(false);
  };
  return (
    <div className="px-5 pt-8 space-y-5">
      <div>
        <p className="text-2xl font-black">{sharedMode ? `嗨，${myName()} 👋` : '欢迎来到 tripaa 👋'}</p>
        <p className="text-sm text-muted-foreground mt-1">把 IG、小红书上收藏的攻略整理好，出发前要做的事也不会漏。</p>
      </div>
      <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
        <p className="font-bold">🧳 建立一个旅行</p>
        <p className="text-xs text-muted-foreground">填好日期和城市，会自动帮你列出发前要准备的事。</p>
        <PrimaryButton onClick={onCreate}>建立第一个旅行</PrimaryButton>
      </div>
      {sharedMode && (
        <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
          <p className="font-bold">🤝 旅伴已经建好了？</p>
          <p className="text-xs text-muted-foreground">请对方在 tripaa 里按「邀请旅伴」，把链接或邀请码贴在这里。</p>
          <div className="flex gap-2">
            <input value={code} onChange={(e) => setCode(e.target.value)} className={inputCls} placeholder="邀请链接或邀请码" />
            <button onClick={join} disabled={!code.trim() || busy}
              className="shrink-0 rounded-xl border border-border px-4 text-sm font-bold disabled:opacity-40">{busy ? '…' : '加入'}</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function TripLayout() {
  const state = useTripState();
  const trip = activeTrip(state);
  const [collectOpen, setCollectOpen] = useState(false);
  const [collectText, setCollectText] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

  // Android share sheet → /share?title=…&text=…&url=… → open 收集 prefilled.
  useEffect(() => {
    if (location.pathname !== '/share') return;
    const q = new URLSearchParams(location.search);
    const shared = [q.get('title'), q.get('text'), q.get('url')].filter(Boolean).join('\n');
    navigate('/', { replace: true });
    if (shared) { setCollectText(shared); setCollectOpen(true); }
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps
  const [tripOpen, setTripOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
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
        {trip ? (
          <button onClick={() => setTripOpen(true)} className="flex-1 min-w-0 text-left">
            <div className="flex items-center gap-1">
              <h1 className="text-lg font-extrabold truncate">{trip.name}</h1>
              <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
            </div>
            <p className="text-xs text-muted-foreground truncate">
              {md(trip.startDate)} – {md(trip.endDate)} · {trip.regions.join(' · ')} · <span className="text-primary font-semibold">{countdown}</span>
            </p>
          </button>
        ) : (
          <div className="flex-1 flex items-center gap-2">
            <img src="/icon.svg" alt="" className="w-7 h-7" />
            <h1 className="text-lg font-black">tripaa</h1>
          </div>
        )}
        <MemberDots state={state} trip={trip} onClick={() => setTripOpen(true)} />
        <button onClick={() => setAccountOpen(true)} aria-label="我的账号">
          <Avatar name={sharedMode ? myName() : '试'} />
        </button>
      </header>

      <main className="pb-28">
        {trip ? (
          <Outlet context={{ state, trip, openCollect: () => setCollectOpen(true) }} />
        ) : (
          <Welcome onCreate={() => setTripOpen(true)} />
        )}
      </main>

      {trip && <nav className="fixed bottom-0 inset-x-0 z-40 max-w-lg mx-auto select-none">
        <div className="bg-card border-t border-border flex items-center px-6 pt-1" style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}>
          <Tab to="/" end icon={BookMarked} label="攻略库" />
          <div className="flex-1 flex flex-col items-center">
            <button onClick={() => trip && setCollectOpen(true)} aria-label="收集攻略"
              className="w-14 h-14 -mt-6 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center active:scale-95 transition">
              <Plus className="w-7 h-7" />
            </button>
            <span className="text-[11px] font-semibold text-muted-foreground mt-0.5">收集</span>
          </div>
          <Tab to="/prep" icon={ClipboardCheck} label="出发准备" badge={dueCount} />
        </div>
      </nav>}

      {trip && <CollectSheet open={collectOpen} onClose={() => { setCollectOpen(false); setCollectText(''); }} trip={trip} initialText={collectText} />}
      <TripSheet open={tripOpen} onClose={() => setTripOpen(false)} state={state} trip={trip} />
      <AccountSheet open={accountOpen} onClose={() => setAccountOpen(false)} state={state} />
    </div>
  );
}
