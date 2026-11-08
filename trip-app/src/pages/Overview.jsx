import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Check, ChevronRight, LocateFixed, Loader2 } from 'lucide-react';
import { actions, ofTrip, myPassport, memberName } from '../lib/store';
import { relevantToTrip, notForMyPassport, isDone, whenLabel, tipType } from '../lib/tips';
import { tripFlag, tripCover, tripPhase } from '../lib/tripInfo';
import { CATEGORIES } from '../lib/parse';
import { todayISO, md, weekday, shiftDate } from '../lib/dates';
import { km, fmtKm, myPosition, hasCoords } from '../lib/geo';
import SaveSheet from '../components/SaveSheet';
import BookingSheet from '../components/BookingSheet';
import { ofTripBookings, kindOf, bookingTitle, bookingWhen, nights, coveredByBooking } from '../lib/bookings';
import { RouteButtons } from './Plan';
import { daysOf, stopsOf, timelineOf, MEAL_LABEL, UNPLANNED } from '../lib/plan';

function Card({ title, link, onLink, children }) {
  return (
    <section className="rounded-2xl border border-border bg-card p-4">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-sm font-extrabold">{title}</h3>
        {link && <button onClick={onLink} className="text-xs font-bold text-primary flex items-center">{link}<ChevronRight className="w-3.5 h-3.5" /></button>}
      </div>
      {children}
    </section>
  );
}

function TaskLine({ tip, trip, state }) {
  const done = isDone(tip, state);
  const when = whenLabel(tip, trip, todayISO());
  const booked = !done && coveredByBooking(tip, ofTripBookings(state, trip));
  return (
    <div className="flex items-center gap-3 py-1.5">
      <button onClick={() => actions.toggleTip(tip)} aria-label={done ? '取消完成' : '完成'}
        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${done ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/40'}`}>
        {done && <Check className="w-3 h-3" />}
      </button>
      <span className={`flex-1 text-sm font-semibold leading-snug ${done ? 'line-through text-muted-foreground' : ''}`}>
        {tip.title}{tip.personal ? '（每人）' : ''}
      </span>
      {booked ? <span className="text-[11px] font-bold shrink-0 text-emerald-600">✓ 已有订单</span> : when?.date && !done && (
        <span className={`text-[11px] font-bold shrink-0 ${when.late ? 'text-destructive' : 'text-primary'}`}>
          {when.late ? when.text.split('· ')[1] : `${md(when.date)} 前`}
        </span>
      )}
    </div>
  );
}

/** Saved places near me that aren't 避雷 — for the 旅行中 overview. */
function Nearby({ state, trip, onOpen }) {
  const [pos, setPos] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const locate = () => {
    setBusy(true); setErr('');
    myPosition().then(setPos).catch((e) => setErr(e.message)).finally(() => setBusy(false));
  };
  useEffect(() => { locate(); }, []); // ask once when the 旅行中 overview opens
  const list = useMemo(() => (pos ? ofTrip(state.saves, trip)
    .filter((s) => s.verdict !== 'avoid' && hasCoords(s))
    .map((s) => ({ s, d: km(pos, s) }))
    .filter((x) => x.d <= 1.5)
    .sort((a, b) => a.d - b.d)
    .slice(0, 8) : []), [pos, state.saves, trip]);

  return (
    <Card title="📍 附近的收藏">
      {!pos ? (
        <button onClick={locate} disabled={busy} className="w-full rounded-xl border border-border py-2.5 text-sm font-semibold flex items-center justify-center gap-2">
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <LocateFixed className="w-4 h-4 text-primary" />}
          {busy ? '定位中…' : err || '用我的位置找附近的收藏'}
        </button>
      ) : list.length ? (
        <div className="flex gap-2 overflow-x-auto no-scrollbar -mx-1 px-1">
          {list.map(({ s, d }) => (
            <button key={s.id} onClick={() => onOpen(s.id)} className="shrink-0 w-36 text-left rounded-xl bg-muted p-2.5">
              <p className="text-sm font-bold truncate">{s.title}</p>
              <p className="text-[11px] text-primary font-semibold">{fmtKm(d)}</p>
            </button>
          ))}
        </div>
      ) : <p className="text-sm text-muted-foreground">1.5 公里内没有收藏的地方。</p>}
    </Card>
  );
}

/** 订单: flights, hotels, trains. Everyone sees all of them; personal ones are tagged with whose they are. */
function Bookings({ state, trip, onOpen, onAdd }) {
  const list = ofTripBookings(state, trip);
  const me = state.user?.id || 'local';
  return (
    <Card title={`🎫 订单${list.length ? ` · ${list.length}` : ''}`}>
      {state.bookingsMissing && <p className="text-xs text-amber-600 mb-2">🛠️ 请先在 Supabase 跑一次 <b>migrations/005_bookings.sql</b>，订单才能存。</p>}
      {list.map((b) => {
        const k = kindOf(b.kind);
        const who = b.forAll ? '' : b.ownerId === me ? '只有我' : `${memberName(state, trip.id, b.ownerId) || '旅伴'} 的`;
        return (
          <button key={b.id} onClick={() => onOpen(b.id)} className="w-full text-left flex items-center gap-3 py-2 border-b border-border last:border-0">
            <span className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg shrink-0 ${k.bg}`}>{k.emoji}</span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-bold leading-snug">{bookingTitle(b)}{who && <span className="ml-1.5 text-[10px] font-bold rounded-full px-1.5 py-0.5 bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">{who}</span>}</span>
              <span className="block text-[11px] text-primary font-semibold tabular-nums">{bookingWhen(b)}</span>
              <span className="block text-[11px] text-muted-foreground truncate">
                {b.kind === 'hotel' ? `${nights(b) ? `${nights(b)} 晚` : ''}${b.place && !b.place.lat ? ' · ⚠️ 没有位置' : ' · 每天自动当出发点'}` : [b.seats, b.ref && `订单 ${b.ref}`].filter(Boolean).join(' · ')}
              </span>
            </span>
          </button>
        );
      })}
      <button onClick={onAdd} className="mt-2 w-full rounded-xl border-[1.5px] border-dashed border-border py-2.5 text-sm font-bold text-primary">
        ＋ 加订单（贴确认信 / 截图）
      </button>
    </Card>
  );
}

/** 旅行中: today's stops, the next one big with directions from where I am (or the previous stop). */
function TodayPlan({ state, trip, onPlan, onOpen }) {
  const day = todayISO();
  const tl = timelineOf(state, trip, day);
  const stops = tl.stops;
  const [pos, setPos] = useState(null);
  useEffect(() => { myPosition().then(setPos).catch(() => {}); }, []);
  if (!stops.length) {
    return (
      <Card title="🗓 今天的行程" link="去排" onLink={onPlan}>
        <p className="text-sm text-muted-foreground">今天还没排地点。去行程挑几个，让 AI 排顺序。</p>
      </Card>
    );
  }
  const i = stops.findIndex((s) => !s.visited);
  const next = stops[i];
  const from = pos ? { ...pos, name: '我的位置' } : i > 0 ? stops[i - 1] : tl.settings.start;
  return (
    <Card title={`🗓 今天的行程 · ${stops.filter((s) => s.visited).length}/${stops.length}`} link="全部" onLink={onPlan}>
      {next ? (
        <div className="rounded-2xl bg-primary/5 border border-primary/30 p-3 mb-2">
          <p className="text-[11px] font-bold text-primary">下一站 · 约 {next.time}{next.meal ? ` · ${MEAL_LABEL[next.meal]}` : ''}</p>
          <button onClick={() => onOpen(next.id)} className="text-left">
            <p className="text-lg font-black leading-snug">{next.title}</p>
            {next.planReason && <p className="text-[11px] text-violet-700 dark:text-violet-300">✨ {next.planReason}</p>}
          </button>
          <div className="mt-2"><RouteButtons from={from} to={next} mode={tl.legs[i]?.mode} size="lg" /></div>
          <button onClick={() => actions.updateSave(next.id, { visited: true })} className="mt-2 w-full rounded-xl bg-primary text-primary-foreground py-2 text-sm font-bold flex items-center justify-center gap-1.5">
            <Check className="w-4 h-4" /> 去过了，下一站
          </button>
        </div>
      ) : <p className="text-sm font-bold text-emerald-600 mb-2">今天的都去过了 🎉</p>}
      {stops.map((s) => (
        <p key={s.id} className={`text-sm py-0.5 flex gap-2 ${s.visited ? 'text-muted-foreground line-through' : ''}`}>
          <span className="tabular-nums text-xs font-bold text-primary w-10 shrink-0 pt-0.5">{s.time}</span>{s.title}
        </p>
      ))}
    </Card>
  );
}

/** Inside a trip: what matters right now. Switches to 旅行中 automatically on the first day. */
export default function Overview() {
  const { state, trip, openSettings } = useOutletContext();
  const navigate = useNavigate();
  const [openId, setOpenId] = useState(null);
  const [bookingId, setBookingId] = useState(null); // 'new' or a booking id
  const base = `/t/${trip.id}`;
  const phase = tripPhase(trip);
  const today = todayISO();

  const saves = ofTrip(state.saves, trip);
  const tips = ofTrip(state.tips, trip).filter((t) => relevantToTrip(t, trip) && !notForMyPassport(t, myPassport()));
  const actionsList = tips.filter((t) => t.isAction);
  const doneCount = actionsList.filter((t) => isDone(t, state)).length;

  // 现在要处理: not done, overdue or due within 2 weeks (or anything undone if there are no dates yet).
  const now = actionsList
    .filter((t) => !isDone(t, state))
    .map((t) => ({ t, when: whenLabel(t, trip, today) }))
    .filter(({ when }) => !trip.startDate || !when?.date || when.late || when.date <= shiftDate(today, 14))
    .sort((a, b) => (a.when?.date || '9').localeCompare(b.when?.date || '9'))
    .slice(0, 5)
    .map(({ t }) => t);

  // During the trip, pre-departure tasks (book KTX a month ahead…) are moot: show knowledge and on-arrival things.
  const onTrip = tips.filter((t) => !t.isAction || (!isDone(t, state) && (t.offsetDays == null || t.offsetDays >= 0)));

  const byCat = CATEGORIES.map((c) => ({ ...c, n: saves.filter((s) => s.category === c.id && s.verdict !== 'avoid').length }));
  const avoid = saves.filter((s) => s.verdict === 'avoid').length;
  const openSave = saves.find((s) => s.id === openId) || null;
  const days = daysOf(trip);
  const bookingCount = ofTripBookings(state, trip).length;
  const unplannedCount = stopsOf(state, trip, UNPLANNED).length;

  return (
    <div className="px-4 pt-3 space-y-3">
      {/* Hero */}
      {phase.mode === 'during' ? (
        <div className="rounded-3xl p-5 text-white bg-gradient-to-br from-emerald-500 to-teal-600">
          <p className="text-xs opacity-90">旅行中</p>
          <p className="text-3xl font-black mt-0.5">第 {phase.day} 天</p>
          <p className="text-sm opacity-90 mt-1">{md(today)} {weekday(today)} · {trip.regions.join(' · ')}</p>
        </div>
      ) : phase.mode === 'after' ? (
        <div className="rounded-3xl p-5 text-white bg-gradient-to-br from-slate-500 to-slate-700">
          <p className="text-3xl font-black">旅行结束了 🎉</p>
          <p className="text-sm opacity-90 mt-1">收集了 {saves.length} 个地点、{tips.length} 条须知</p>
        </div>
      ) : (
        <div className={`rounded-3xl p-5 text-white bg-gradient-to-br ${tripCover(trip)}`}>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs opacity-90">{phase.mode === 'nodate' ? '还没定日期' : '距离出发'}</p>
              {phase.mode === 'before'
                ? <p className="text-5xl font-black leading-tight">{phase.daysLeft}<span className="text-lg font-bold ml-1">天</span></p>
                : <button onClick={openSettings} className="mt-2 rounded-full bg-white/25 px-4 py-1.5 text-sm font-bold">设定出发日期</button>}
            </div>
            <span className="text-4xl drop-shadow">{tripFlag(trip)}</span>
          </div>
          {actionsList.length > 0 && (
            <div className="flex gap-2 mt-3 text-[11px] font-bold">
              <span className="rounded-full bg-white/25 px-3 py-1">须知 {doneCount}/{actionsList.length} 完成</span>
              {bookingCount > 0 && <span className="rounded-full bg-white/25 px-3 py-1">订单 {bookingCount}</span>}
            </div>
          )}
        </div>
      )}

      {phase.mode === 'during' && (
        <>
          <TodayPlan state={state} trip={trip} onPlan={() => navigate(`${base}/plan`)} onOpen={setOpenId} />
          <Nearby state={state} trip={trip} onOpen={setOpenId} />
          {onTrip.length > 0 && (
            <Card title="📝 今天适用的须知" link="全部" onLink={() => navigate(`${base}/library/tips`)}>
              {onTrip.slice(0, 4).map((t) => (
                <p key={t.id} className="text-sm py-1">{t.isAction ? tipType(t.type).emoji : '💡'} {t.title}</p>
              ))}
            </Card>
          )}
        </>
      )}

      {phase.mode !== 'after' && <Bookings state={state} trip={trip} onOpen={setBookingId} onAdd={() => setBookingId('new')} />}

      {(phase.mode === 'before' || phase.mode === 'nodate') && (
        <Card title="⏰ 现在要处理" link="全部须知" onLink={() => navigate(`${base}/library/tips`)}>
          {now.length ? now.map((t) => <TaskLine key={t.id} tip={t} trip={trip} state={state} />)
            : <p className="text-sm text-muted-foreground">{actionsList.length ? '暂时没有要赶的事 🎉' : '收集交通、入境、订票的攻略，要做的事会整理到这里。'}</p>}
        </Card>
      )}

      {phase.mode === 'after' && (
        <Card title="📸 旅行报告">
          <p className="text-sm text-muted-foreground">之后会可以生成一份旅行报告（小红书多图），记录去过的地方和每天的路线。</p>
        </Card>
      )}

      <Card title="📚 攻略库" link="去看" onLink={() => navigate(`${base}/library`)}>
        <div className="grid grid-cols-5 gap-1.5 text-center">
          {byCat.map((c) => (
            <button key={c.id} onClick={() => navigate(`${base}/library`)} className="rounded-xl bg-muted py-2">
              <p className="text-lg font-black leading-none">{c.n}</p>
              <p className="text-[10px] font-semibold text-muted-foreground mt-1">{c.emoji} {c.label}</p>
            </button>
          ))}
          <button onClick={() => navigate(`${base}/library`)} className="rounded-xl bg-muted py-2">
            <p className="text-lg font-black leading-none">{avoid}</p>
            <p className="text-[10px] font-semibold text-muted-foreground mt-1">👎 避雷</p>
          </button>
        </div>
      </Card>

      {phase.mode !== 'during' && phase.mode !== 'after' && (
        <Card title="🗓 行程" link="去排" onLink={() => navigate(`${base}/plan`)}>
          {days.length ? (
            <div className="flex gap-1 flex-wrap">
              {days.map((d, i) => {
                const n = stopsOf(state, trip, d).length;
                return (
                  <button key={d} onClick={() => navigate(`${base}/plan?day=${d}`)}
                    className={`rounded-lg px-2 py-1 text-[11px] font-bold ${n ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    D{i + 1} {n ? `${n}站` : '空'}
                  </button>
                );
              })}
            </div>
          ) : <p className="text-sm text-muted-foreground">设好日期后，挑地点放进每一天，让 AI 帮你排怎么走。</p>}
          {unplannedCount > 0 && <p className="text-xs text-amber-600 font-semibold mt-2">还有 {unplannedCount} 个地点在待安排</p>}
        </Card>
      )}

      <SaveSheet save={openSave} onClose={() => setOpenId(null)} trip={trip} />
      <BookingSheet open={!!bookingId} onClose={() => setBookingId(null)} trip={trip}
        booking={bookingId && bookingId !== 'new' ? state.bookings.find((b) => b.id === bookingId) : null} />
    </div>
  );
}

