import React, { useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { BellRing, CalendarArrowDown, Check, ChevronRight, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { actions, itemStatus, lodgingFor, ofTrip } from '../lib/store';
import { tripDates, md, weekday, todayISO, toMinutes, daysBetween, dueLabel } from '../lib/dates';
import { buildICS, download } from '../lib/ics';
import { notifyGranted, notifySupported, requestNotify } from '../lib/reminders';
import { Chip, Stars, Empty } from '../components/ui';
import ItemSheet, { kindOf } from '../components/ItemSheet';
import { TimelineItem } from './Plan';

function ReminderBar({ state, trip }) {
  const [granted, setGranted] = useState(notifyGranted());
  const items = ofTrip(state.items, trip);
  const tasks = ofTrip(state.tasks, trip);

  const exportCal = () => {
    download(`${trip.name}.ics`, buildICS({ trip, items, tasks, statusOf: (i) => itemStatus(state, i) }));
    toast.success('已下载日历文件，打开它就能加入手机日历（含提醒）');
  };
  const enable = async () => {
    const r = await requestNotify();
    if (r === 'granted') { setGranted(true); toast.success('已开启：App 开着时会准时提醒'); }
    else toast(r === 'unsupported' ? '这个浏览器不支持通知，请用「加入手机日历」' : '通知被拒绝了，可以用「加入手机日历」');
  };

  return (
    <div className="grid grid-cols-2 gap-2">
      <button onClick={exportCal} className="rounded-2xl border border-border bg-card p-3 text-left">
        <CalendarArrowDown className="w-5 h-5 text-primary mb-1" />
        <p className="text-sm font-bold">加入手机日历</p>
        <p className="text-[11px] text-muted-foreground leading-snug">重要时间点 + 准备事项，手机会准时响</p>
      </button>
      <button onClick={enable} disabled={granted || !notifySupported()} className="rounded-2xl border border-border bg-card p-3 text-left disabled:opacity-70">
        <BellRing className={`w-5 h-5 mb-1 ${granted ? 'text-primary' : 'text-amber-500'}`} />
        <p className="text-sm font-bold">{granted ? '通知已开启' : '开启通知'}</p>
        <p className="text-[11px] text-muted-foreground leading-snug">{notifySupported() ? 'App 打开时，提前提醒你' : '此浏览器不支持'}</p>
      </button>
    </div>
  );
}

function TaskRow({ t }) {
  const overdue = t.dueDate && t.dueDate < todayISO();
  return (
    <div className="flex items-center gap-3 py-2">
      <button onClick={() => actions.updateTask(t.id, { done: !t.done })} aria-label="完成"
        className={`w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 ${t.done ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/40'}`}>
        {t.done && <Check className="w-3.5 h-3.5" />}
      </button>
      <span className={`flex-1 text-sm ${t.done ? 'line-through text-muted-foreground' : ''}`}>{t.title}</span>
      <span className={`text-[11px] font-semibold shrink-0 ${overdue ? 'text-destructive' : 'text-muted-foreground'}`}>{dueLabel(t.dueDate)}</span>
    </div>
  );
}

function BeforeTrip({ state, trip }) {
  const navigate = useNavigate();
  const days = daysBetween(todayISO(), trip.startDate);
  const tasks = ofTrip(state.tasks, trip);
  const open = tasks.filter((t) => !t.done).sort((a, b) => (a.dueDate || '9').localeCompare(b.dueDate || '9'));
  const urgent = open.filter((t) => t.dueDate && daysBetween(todayISO(), t.dueDate) <= 7);
  const key = ofTrip(state.items, trip).filter((i) => i.important).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).slice(0, 4);

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-gradient-to-br from-sky-500 to-indigo-600 text-white p-5">
        <p className="text-sm opacity-90">距离出发</p>
        <p className="text-5xl font-black tracking-tight">{days}<span className="text-xl font-bold ml-1">天</span></p>
        <p className="text-sm opacity-90 mt-1">{md(trip.startDate)} {weekday(trip.startDate)} 出发 · 准备进度 {tasks.length - open.length}/{tasks.length}</p>
      </div>

      <section className="rounded-2xl border border-border bg-card px-4 py-2">
        <div className="flex items-center justify-between pt-1">
          <h3 className="text-sm font-bold">{urgent.length ? `这周要处理（${urgent.length}）` : '接下来要准备'}</h3>
          <button onClick={() => navigate('/trip/prep')} className="text-xs text-primary font-semibold flex items-center">全部<ChevronRight className="w-3 h-3" /></button>
        </div>
        <div className="divide-y divide-border">
          {(urgent.length ? urgent : open.slice(0, 4)).map((t) => <TaskRow key={t.id} t={t} />)}
          {!open.length && <p className="text-sm text-muted-foreground py-3">都准备好了 🎉</p>}
        </div>
      </section>

      {key.length > 0 && (
        <section className="rounded-2xl border border-border bg-card p-4 space-y-2.5">
          <h3 className="text-sm font-bold">重要时间点</h3>
          {key.map((i) => (
            <div key={i.id} className="flex items-center gap-3 text-sm">
              <span className="text-xs font-bold tabular-nums w-20 shrink-0 text-muted-foreground">{md(i.date)} {i.time}</span>
              <span className="truncate">{kindOf(i.kind).emoji} {i.title}</span>
            </div>
          ))}
        </section>
      )}
    </div>
  );
}

function TripDay({ state, trip, date, onOpen }) {
  const isToday = date === todayISO();
  const now = new Date();
  const nowMin = isToday ? now.getHours() * 60 + now.getMinutes() : -1;
  const items = ofTrip(state.items, trip).filter((i) => i.date === date).sort((a, b) => toMinutes(a.time) - toMinutes(b.time));
  const next = items.find((i) => !itemStatus(state, i).done && toMinutes(i.time) >= nowMin - 30);
  const important = items.filter((i) => i.important && !itemStatus(state, i).done);
  const lodging = lodgingFor(ofTrip(state.lodgings, trip), date);
  // Only on the real current day: overdue prep tasks are a "today" concern, not a preview one.
  const dueTasks = isToday ? ofTrip(state.tasks, trip).filter((t) => !t.done && t.dueDate && t.dueDate <= date).slice(0, 5) : [];
  const done = items.filter((i) => itemStatus(state, i).done).length;

  return (
    <div className="space-y-4">
      {next ? (
        <button onClick={() => onOpen(next)} className="w-full text-left rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white p-5">
          <p className="text-xs opacity-90 flex items-center gap-1"><Clock className="w-3.5 h-3.5" />{isToday ? '下一站' : '这天第一站'}</p>
          <p className="text-3xl font-black tabular-nums mt-1">{next.time || '—'}</p>
          <p className="text-lg font-bold leading-snug">{kindOf(next.kind).emoji} {next.title}</p>
          {(next.area || next.note) && <p className="text-xs opacity-90 mt-1">{[next.area, next.note].filter(Boolean).join(' · ')}</p>}
        </button>
      ) : items.length ? (
        <div className="rounded-3xl bg-muted p-5 text-center"><p className="text-3xl">🎉</p><p className="font-bold mt-1">今天的行程都完成了</p></div>
      ) : null}

      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>{lodging ? `🛏 ${lodging.name}` : '🛏 未填住宿'}</span>
        <span>打卡 {done}/{items.length}</span>
      </div>

      {important.length > 0 && (
        <section className="rounded-2xl border border-amber-300/60 bg-amber-50 dark:bg-amber-500/10 p-4 space-y-2">
          <h3 className="text-sm font-bold text-amber-700 dark:text-amber-300 flex items-center gap-1.5"><BellRing className="w-4 h-4" />今天的重要时间点</h3>
          {important.map((i) => (
            <div key={i.id} className="flex items-center gap-3 text-sm">
              <span className="font-bold tabular-nums w-12">{i.time}</span>
              <span className="flex-1 truncate">{i.title}</span>
              <span className="text-[11px] text-amber-700 dark:text-amber-300 shrink-0">提前 {i.remindMin >= 60 ? `${i.remindMin / 60}h` : `${i.remindMin}m`}</span>
            </div>
          ))}
        </section>
      )}

      {dueTasks.length > 0 && (
        <section className="rounded-2xl border border-border bg-card px-4 py-2">
          <h3 className="text-sm font-bold pt-1">还没办的准备事项</h3>
          <div className="divide-y divide-border">{dueTasks.map((t) => <TaskRow key={t.id} t={t} />)}</div>
        </section>
      )}

      <div className="space-y-2">
        {items.map((it) => <TimelineItem key={it.id} item={it} state={state} onOpen={onOpen} highlight={it === next} />)}
        {!items.length && <Empty emoji="🗓️" title="这天没有安排">去「行程」用智能安排排一下</Empty>}
      </div>
    </div>
  );
}

function Review({ state, trip }) {
  const rated = useMemo(() => {
    const seen = new Set();
    const out = [];
    for (const i of ofTrip(state.items, trip)) {
      const st = itemStatus(state, i);
      if (!st.done || seen.has(i.saveId || i.id)) continue;
      seen.add(i.saveId || i.id);
      out.push({ id: i.id, title: i.title, kind: i.kind, area: i.area, date: i.date, ...st });
    }
    for (const s of ofTrip(state.saves, trip)) {
      if (s.done && !seen.has(s.id)) out.push({ id: s.id, title: s.title, kind: s.category, area: s.area, date: '', done: true, rating: s.rating, review: s.review });
    }
    return out.sort((a, b) => b.rating - a.rating);
  }, [state, trip]);
  const scored = rated.filter((r) => r.rating);
  const avg = scored.length ? (scored.reduce((s, r) => s + r.rating, 0) / scored.length).toFixed(1) : '—';
  const total = ofTrip(state.saves, trip).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2 text-center">
        {[['打卡', rated.length], ['平均分', avg], ['收藏完成', total ? `${Math.round((ofTrip(state.saves, trip).filter((s) => s.done).length / total) * 100)}%` : '—']].map(([l, v]) => (
          <div key={l} className="rounded-2xl border border-border bg-card py-3">
            <p className="text-2xl font-black">{v}</p><p className="text-[11px] text-muted-foreground">{l}</p>
          </div>
        ))}
      </div>
      {!rated.length ? <Empty emoji="⭐" title="还没有打卡">在行程里打勾、给星星，这里会变成你的旅行评分榜</Empty> : (
        <div className="space-y-2">
          {rated.map((r) => (
            <div key={r.id} className="rounded-2xl border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold truncate">{kindOf(r.kind).emoji} {r.title}</p>
                <Stars value={r.rating} size="w-3.5 h-3.5" />
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">{[r.date && md(r.date), r.area].filter(Boolean).join(' · ')}{r.review && ` · “${r.review}”`}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Today() {
  const { state, trip } = useOutletContext();
  const dates = tripDates(trip);
  const today = todayISO();
  const auto = today < trip.startDate ? 'before' : today > trip.endDate ? 'review' : today;
  const [view, setView] = useState(auto);
  const [editing, setEditing] = useState(null);

  return (
    <div className="pt-3 space-y-4">
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar px-4">
        <Chip active={view === 'before'} onClick={() => setView('before')}>出发前</Chip>
        {dates.map((d, i) => (
          <Chip key={d} active={view === d} onClick={() => setView(d)}>{d === today ? '今天' : `D${i + 1} ${md(d)}`}</Chip>
        ))}
        <Chip active={view === 'review'} onClick={() => setView('review')}>⭐ 回顾</Chip>
      </div>
      {view !== auto && view !== 'review' && (
        <p className="px-4 -mt-2 text-[11px] text-muted-foreground">预览模式：看看那天会提醒你什么</p>
      )}

      <div className="px-4 space-y-4">
        {view !== 'review' && <ReminderBar state={state} trip={trip} />}
        {view === 'before' ? <BeforeTrip state={state} trip={trip} />
          : view === 'review' ? <Review state={state} trip={trip} />
          : <TripDay state={state} trip={trip} date={view} onOpen={setEditing} />}
      </div>

      <ItemSheet item={editing} onClose={() => setEditing(null)} state={state} trip={trip} />
    </div>
  );
}
