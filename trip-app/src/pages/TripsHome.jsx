import React, { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Link2, Download, Upload, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { actions, useTripState, myName, ofTrip, myPassport } from '../lib/store';
import { sharedMode } from '../lib/supabase';
import { tripFlag, tripCover, tripPhase, countdownLabel } from '../lib/tripInfo';
import { relevantToTrip, isDone, notForMyPassport } from '../lib/tips';
import { md } from '../lib/dates';
import { download } from '../lib/utils';
import { Sheet, PrimaryButton, Empty, inputCls } from '../components/ui';
import TripForm from '../components/TripForm';
import AccountSheet, { Avatar } from '../components/AccountSheet';

const COLORS = ['#10b981', '#6366f1', '#f59e0b', '#ec4899', '#0ea5e9'];

function dateText(t) {
  if (!t.startDate) return t.regions.join(' · ');
  const y = (d) => d.slice(0, 4);
  const now = String(new Date().getFullYear());
  const fmt = (d) => (y(d) === now ? md(d) : `${y(d)}/${md(d)}`);
  return `${fmt(t.startDate)} – ${fmt(t.endDate || t.startDate)} · ${t.regions.join(' · ')}`;
}

function TripCard({ trip, state, onOpen }) {
  const places = ofTrip(state.saves, trip).length;
  const actionsList = ofTrip(state.tips, trip).filter((t) => t.isAction && relevantToTrip(t, trip) && !notForMyPassport(t, myPassport()));
  const done = actionsList.filter((t) => isDone(t, state)).length;
  const members = state.members.filter((m) => m.tripId === trip.id);
  const ended = tripPhase(trip).mode === 'after';

  if (ended) {
    return (
      <button onClick={onOpen} className="w-full text-left rounded-2xl border border-border bg-card p-3 opacity-70 flex items-center gap-3">
        <span className="text-2xl">{tripFlag(trip)}</span>
        <span className="min-w-0">
          <span className="block font-bold truncate">{trip.name}</span>
          <span className="block text-xs text-muted-foreground truncate">{dateText(trip)} · {places} 个地点</span>
        </span>
      </button>
    );
  }
  return (
    <button onClick={onOpen} className="w-full text-left rounded-3xl border border-border bg-card overflow-hidden active:scale-[0.99] transition">
      <div className={`h-20 bg-gradient-to-br ${tripCover(trip)} flex items-end justify-between px-4 pb-3`}>
        <span className="text-4xl leading-none drop-shadow">{tripFlag(trip)}</span>
        <span className="rounded-full bg-black/25 text-white text-xs font-bold px-3 py-1">{countdownLabel(trip)}</span>
      </div>
      <div className="p-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <p className="font-black text-lg leading-tight truncate">{trip.name}</p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">{dateText(trip)}</p>
          <p className="text-xs font-semibold text-muted-foreground mt-2 flex gap-3">
            <span>📍 {places} 地点</span>
            {actionsList.length > 0 && <span>📝 须知 {done}/{actionsList.length}</span>}
          </p>
        </div>
        {members.length > 0 && (
          <div className="flex -space-x-2 shrink-0">
            {members.slice(0, 4).map((m, i) => (
              <span key={m.userId} className="w-8 h-8 rounded-full border-2 border-card flex items-center justify-center text-xs font-bold text-white" style={{ background: COLORS[i % COLORS.length] }}>
                {(m.displayName || '?').slice(0, 1).toUpperCase()}
              </span>
            ))}
          </div>
        )}
      </div>
    </button>
  );
}

function JoinSheet({ open, onClose, onJoined }) {
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const join = async () => {
    const c = code.trim().split('/join/').pop().replace(/[^a-z0-9]/gi, '');
    if (!c) return;
    setBusy(true);
    try { const id = await actions.joinTrip(c); toast.success('已加入旅行 🎉'); setCode(''); onJoined(id); } catch (e) { toast.error(e.message || '加入失败'); }
    setBusy(false);
  };
  return (
    <Sheet open={open} onClose={onClose} title="用邀请码加入">
      <div className="space-y-3 pb-2">
        <p className="text-sm text-muted-foreground">请旅伴在旅行里按「旅行设定 → 邀请旅伴」，把链接或邀请码贴在这里。</p>
        <input value={code} onChange={(e) => setCode(e.target.value)} className={inputCls} placeholder="邀请链接或邀请码" autoFocus />
        <PrimaryButton disabled={!code.trim() || busy} onClick={join}>{busy ? '加入中…' : '加入'}</PrimaryButton>
      </div>
    </Sheet>
  );
}

/** The outermost page: every trip is a card, like a project. */
export default function TripsHome() {
  const state = useTripState();
  const navigate = useNavigate();
  const [creating, setCreating] = useState(false);
  const [joining, setJoining] = useState(false);
  const [account, setAccount] = useState(false);
  const fileRef = useRef(null);

  const open = (id) => { actions.setActiveTrip(id); navigate(`/t/${id}`); };

  const { upcoming, ended } = useMemo(() => {
    const order = (t) => (t.startDate ? t.startDate : '9999'); // no dates after dated ones
    const list = [...state.trips];
    return {
      upcoming: list.filter((t) => tripPhase(t).mode !== 'after').sort((a, b) => order(a).localeCompare(order(b))),
      ended: list.filter((t) => tripPhase(t).mode === 'after').sort((a, b) => b.startDate.localeCompare(a.startDate)),
    };
  }, [state.trips]);

  const importFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try { actions.importJSON(await f.text()); toast.success('已导入备份'); } catch (err) { toast.error(err.message || '导入失败'); }
    e.target.value = '';
  };

  return (
    <div className="min-h-screen bg-background max-w-lg mx-auto pb-10">
      <header className="px-5 pt-6 pb-3 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-black">我的旅行</h1>
          <p className="text-xs text-muted-foreground mt-0.5">tripaa</p>
        </div>
        <button onClick={() => setAccount(true)} aria-label="我的账号"><Avatar name={sharedMode ? myName() : '试'} /></button>
      </header>

      <div className="px-4 space-y-3">
        {!state.trips.length && (
          <Empty emoji="🧳" title="还没有旅行">
            <p>建一个旅行，开始收集 IG、小红书的攻略。旅伴已经建好的话，用邀请码加入。</p>
          </Empty>
        )}
        {upcoming.length > 0 && <p className="text-xs font-bold text-muted-foreground pt-1">即将出发</p>}
        {upcoming.map((t) => <TripCard key={t.id} trip={t} state={state} onOpen={() => open(t.id)} />)}

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button onClick={() => setCreating(true)} className="rounded-2xl border-2 border-dashed border-border py-3.5 text-sm font-bold text-muted-foreground flex items-center justify-center gap-1.5">
            <Plus className="w-4 h-4" /> 新建旅行
          </button>
          <button onClick={() => (sharedMode ? setJoining(true) : toast('试用模式不能加入别人的旅行'))}
            className="rounded-2xl border-2 border-dashed border-border py-3.5 text-sm font-bold text-muted-foreground flex items-center justify-center gap-1.5">
            <Link2 className="w-4 h-4" /> 用邀请码加入
          </button>
        </div>

        {ended.length > 0 && (
          <>
            <p className="text-xs font-bold text-muted-foreground pt-3">已结束</p>
            {ended.map((t) => <TripCard key={t.id} trip={t} state={state} onOpen={() => open(t.id)} />)}
          </>
        )}

        {!sharedMode && (
          <div className="pt-6 space-y-2">
            <p className="text-[11px] text-muted-foreground text-center">试用模式：资料只存在这台设备上。</p>
            <div className="grid grid-cols-3 gap-2 text-xs font-semibold">
              <button className="rounded-xl border border-border py-2.5 flex flex-col items-center gap-1" onClick={() => download('tripaa-backup.json', actions.exportJSON())}><Download className="w-4 h-4" />备份</button>
              <button className="rounded-xl border border-border py-2.5 flex flex-col items-center gap-1" onClick={() => fileRef.current?.click()}><Upload className="w-4 h-4" />导入</button>
              <button className="rounded-xl border border-border py-2.5 flex flex-col items-center gap-1" onClick={() => window.confirm('用示例资料覆盖所有资料？') && actions.resetDemo()}><RotateCcw className="w-4 h-4" />重置示例</button>
            </div>
            <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={importFile} />
          </div>
        )}
      </div>

      <Sheet open={creating} onClose={() => setCreating(false)} title="新建旅行">
        <div className="pb-2"><TripForm onDone={(id) => { setCreating(false); if (id) open(id); }} /></div>
      </Sheet>
      <JoinSheet open={joining} onClose={() => setJoining(false)} onJoined={(id) => { setJoining(false); open(id); }} />
      <AccountSheet open={account} onClose={() => setAccount(false)} state={state} />
    </div>
  );
}
