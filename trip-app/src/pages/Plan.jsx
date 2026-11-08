import React, { useEffect, useRef, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { Sparkles, Loader2, Plus, ChevronUp, ChevronDown, Home, Flag, Settings2, Check, MoreHorizontal, AlertTriangle, Inbox } from 'lucide-react';
import { toast } from 'sonner';
import { actions, memberName } from '../lib/store';
import { orderDay } from '../lib/autoPlan';
import TripPlanSheet from '../components/TripPlanSheet';
import { daysOf, stopsOf, planned, timelineOf, routeLinks, MEAL_LABEL, fmtMin, UNPLANNED } from '../lib/plan';
import { bookingsForDay } from '../lib/bookings';
import { tripPhase } from '../lib/tripInfo';
import { todayISO, md, weekday } from '../lib/dates';
import { categoryOf } from '../lib/parse';
import { hasCoords } from '../lib/geo';
import { Sheet, Chip, Field, Empty } from '../components/ui';
import DaySettingsSheet from '../components/DaySettingsSheet';
import AddStopsSheet from '../components/AddStopsSheet';
import AddToPlanSheet from '../components/AddToPlanSheet';
import SaveSheet from '../components/SaveSheet';

const STAYS = [30, 45, 60, 90, 120, 180, 240];

/** Naver / Kakao / Google directions for one leg. */
export function RouteButtons({ from, to, mode, size = 'sm' }) {
  const l = routeLinks(from, to, mode);
  const cls = size === 'lg'
    ? 'flex-1 rounded-xl py-2.5 text-xs font-bold flex items-center justify-center gap-1.5'
    : 'w-7 h-7 rounded-lg text-[11px] font-black flex items-center justify-center';
  return (
    <div className={size === 'lg' ? 'flex gap-2' : 'flex gap-1'}>
      {l.naver && <a href={l.naver} className={`${cls} bg-[#03C75A] text-white`} aria-label="Naver 路线">N{size === 'lg' && ' Naver'}</a>}
      {l.kakao && <a href={l.kakao} target="_blank" rel="noreferrer" className={`${cls} bg-[#FEE500] text-black`} aria-label="Kakao 路线">K{size === 'lg' && ' Kakao'}</a>}
      <a href={l.google} target="_blank" rel="noreferrer" className={`${cls} bg-card border border-border`} aria-label="Google 路线">G{size === 'lg' && ' Google'}</a>
    </div>
  );
}

function Leg({ leg, from, to }) {
  if (!leg) return null;
  const walk = leg.mode === 'walk';
  return (
    <div className="flex items-center gap-2 pl-[15px]">
      <div className="w-0.5 self-stretch border-l-2 border-dashed border-border" />
      <div className="flex-1 flex items-center gap-2 py-2 pl-3">
        <span className="text-xs text-muted-foreground flex-1">
          {walk ? '🚶 步行' : leg.mode === 'transit' ? '🚇 搭车约' : '🚇 约'} <b className="text-foreground">{leg.minutes} 分</b>
          {leg.km != null && ` · ${leg.km} km`}
          {leg.mode === 'unknown' && '（没有位置，先估 20 分）'}
        </span>
        <RouteButtons from={from} to={to} mode={leg.mode} />
      </div>
    </div>
  );
}

function EndPoint({ icon: Icon, name, time, sub }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0"><Icon className="w-4 h-4 text-muted-foreground" /></span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate">{name}</p>
        {sub && <p className="text-[11px] text-muted-foreground">{sub}</p>}
      </div>
      <span className="text-sm font-black tabular-nums">{time}</span>
    </div>
  );
}

function StopCard({ s, i, n, onMove, onMore, onOpen, state, trip }) {
  const cat = categoryOf(s.category);
  const by = s.addedBy && s.addedBy !== state.user?.id ? memberName(state, trip.id, s.addedBy) : '';
  return (
    <div className={`flex gap-3 items-start ${s.visited ? 'opacity-60' : ''}`}>
      <button onClick={() => actions.updateSave(s.id, { visited: !s.visited })} aria-label={s.visited ? '取消去过' : '去过了'}
        className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 text-xs font-black ${s.visited ? 'bg-emerald-500 text-white' : 'bg-primary text-primary-foreground'}`}>
        {s.visited ? <Check className="w-4 h-4" /> : i + 1}
      </button>
      <div className="flex-1 min-w-0 rounded-2xl border border-border bg-card p-3">
        <div className="flex items-start gap-2">
          <button onClick={onOpen} className="flex-1 min-w-0 text-left">
            <p className="text-[11px] font-bold text-primary tabular-nums">{s.time} <span className="text-muted-foreground font-semibold">· 待 {fmtMin(s.stay)}</span></p>
            <p className={`font-bold leading-snug truncate ${s.visited ? 'line-through' : ''}`}>{cat.emoji} {s.title}</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1 text-[11px] text-muted-foreground">
              {s.meal && <span className="rounded-full px-2 py-0.5 font-bold bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-200">{MEAL_LABEL[s.meal]}</span>}
              <span>{s.subtype || cat.label}</span>
              {(s.area || s.region) && <span>📍{s.area || s.region}</span>}
              {!hasCoords(s) && <span className="text-amber-600">没有位置</span>}
              {by && <span>· {by} 加的</span>}
            </div>
            {s.planReason && <p className="text-[11px] text-violet-700 dark:text-violet-300 mt-1">✨ {s.planReason}</p>}
          </button>
          <div className="flex flex-col -my-1 -mr-1">
            <button onClick={() => onMove(-1)} disabled={i === 0} aria-label="往前" className="p-1 text-muted-foreground disabled:opacity-20"><ChevronUp className="w-4 h-4" /></button>
            <button onClick={onMore} aria-label="更多" className="p-1 text-muted-foreground"><MoreHorizontal className="w-4 h-4" /></button>
            <button onClick={() => onMove(1)} disabled={i === n - 1} aria-label="往后" className="p-1 text-muted-foreground disabled:opacity-20"><ChevronDown className="w-4 h-4" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** A booked train / flight: fixed time, can't be moved. */
function FixedCard({ s }) {
  return (
    <div className="flex gap-3 items-start">
      <span className="w-8 h-8 rounded-full bg-orange-100 dark:bg-orange-500/20 flex items-center justify-center shrink-0 text-base">{s.kind === 'flight' ? '✈️' : '🚄'}</span>
      <div className="flex-1 min-w-0 rounded-2xl border-[1.5px] border-orange-300 bg-orange-50 dark:bg-orange-500/10 p-3">
        <p className="text-[11px] font-bold text-orange-700 dark:text-orange-300 tabular-nums">{s.time}{s.endTime ? ` → ${s.endTime}` : ''} · 订单（固定）</p>
        <p className="font-bold leading-snug">{s.title}</p>
        {s.seats && <p className="text-[11px] text-muted-foreground mt-0.5">{s.seats}</p>}
        {s.late && <p className="text-[11px] font-bold text-destructive mt-1">⚠️ 可能赶不上：要提早 {s.ready} 分钟到，前面少排一站</p>}
      </div>
    </div>
  );
}

/** A flight shown for reference at the start / end of the day (arrival, departure, connections). */
function FlightRow({ f, sub }) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="w-8 h-8 rounded-full bg-sky-100 dark:bg-sky-500/20 flex items-center justify-center shrink-0">✈️</span>
      <div className="flex-1 min-w-0 rounded-xl border border-sky-200 dark:border-sky-500/30 bg-sky-50 dark:bg-sky-500/10 px-3 py-1.5">
        <p className="text-[11px] font-bold text-sky-700 dark:text-sky-300 tabular-nums">{f.startTime}{f.endTime ? ` → ${f.endTime}` : ''}{sub ? ` · ${sub}` : ''}</p>
        <p className="text-sm font-bold truncate">{f.number} {f.from?.name} → {f.to?.name}</p>
      </div>
    </div>
  );
}

/** Stay length, meal, move to another day, remove. */
function StopSheet({ stop, onClose, onMoveDay }) {
  if (!stop) return <Sheet open={false} onClose={onClose} />;
  return (
    <Sheet open onClose={onClose} title={stop.title}>
      <div className="space-y-4 pb-2">
        <Field label="大概待多久">
          <div className="flex flex-wrap gap-1.5">
            {STAYS.map((m) => <Chip key={m} active={stop.stay === m} onClick={() => actions.updateSave(stop.id, { planStay: m })}>{fmtMin(m)}</Chip>)}
          </div>
        </Field>
        <Field label="是不是正餐" hint="正餐会等到用餐时间才去">
          <div className="flex gap-1.5">
            {[['', '不是'], ['lunch', MEAL_LABEL.lunch], ['dinner', MEAL_LABEL.dinner]].map(([v, label]) => (
              <Chip key={v} active={(stop.meal || '') === v} onClick={() => actions.updateSave(stop.id, { planMeal: v })}>{label}</Chip>
            ))}
          </div>
        </Field>
        <button onClick={onMoveDay} className="w-full rounded-xl border border-border py-2.5 text-sm font-semibold">换到别天 / 移出行程</button>
      </div>
    </Sheet>
  );
}

export default function Plan() {
  const { state, trip, openSettings } = useOutletContext();
  const days = daysOf(trip);
  const [params, setParams] = useSearchParams();
  const phase = tripPhase(trip);
  const fallbackDay = phase.mode === 'during' && days.includes(todayISO()) ? todayISO() : days[0] ?? UNPLANNED;
  const day = params.get('day') != null && (params.get('day') === UNPLANNED || days.includes(params.get('day'))) ? params.get('day') : fallbackDay;
  const pick = (d) => setParams(d === fallbackDay ? {} : { day: d }, { replace: true });

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [moreId, setMoreId] = useState(null);
  const [moveId, setMoveId] = useState(null);
  const [openId, setOpenId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [tripPlanOpen, setTripPlanOpen] = useState(false);
  const pills = useRef(null);

  // Keep the chosen day's pill in view.
  useEffect(() => { pills.current?.querySelector('[data-on="1"]')?.scrollIntoView({ inline: 'center', block: 'nearest' }); }, [day]);

  const unplanned = stopsOf(state, trip, UNPLANNED);
  const tl = day ? timelineOf(state, trip, day) : null;
  const set = tl?.settings;
  const stops = tl?.stops || [];
  const userStops = stops.filter((s) => !s.fixed);
  const korea = trip.regions.some((r) => /首尔|釜山|济州|庆州|江陵|韩国/.test(r)) || planned(state, trip).some((s) => s.geo === 'kakao');

  const move = (i, dir) => {
    const list = userStops.map((s) => s.id);
    const j = i + dir;
    [list[i], list[j]] = [list[j], list[i]];
    actions.setDayStops(list.map((id, k) => ({ id, planOrder: k + 1, planReason: '' })));
  };

  const runAI = async () => {
    setBusy(true);
    try {
      const r = await orderDay(trip, day);
      toast[r.aiUsed ? 'success' : 'message'](r.aiUsed ? '排好了，可以再手动调整' : r.summary);
    } catch (e) { toast.error(e.message || 'AI 暂时连不上'); }
    setBusy(false);
  };

  const moreStop = stops.find((s) => s.id === moreId) || null;
  const moveSave = state.saves.find((s) => s.id === moveId) || null;
  const openSave = state.saves.find((s) => s.id === openId) || null;
  const pointOf = (id) => {
    if (id === 'start') return set.start;
    if (id === 'end') return set.end;
    const s = stops.find((x) => x.id === id);
    return s?.after || s;
  };

  return (
    <div className="pt-3 pb-4 space-y-3">
      {state.planMissing && (
        <div className="mx-4 rounded-2xl border border-amber-300 bg-amber-50 dark:bg-amber-500/10 p-3 text-xs">
          🛠️ 资料库还没更新：请在 Supabase 的 SQL Editor 跑一次 <b>migrations/004_plan.sql</b>，行程才能存。
        </div>
      )}

      {/* Day pills */}
      <div ref={pills} className="flex gap-1.5 overflow-x-auto no-scrollbar px-4">
        <button onClick={() => pick(UNPLANNED)} data-on={day === UNPLANNED ? '1' : '0'}
          className={`shrink-0 rounded-2xl border px-3 py-1.5 text-center ${day === UNPLANNED ? 'bg-foreground text-background border-foreground' : 'bg-card border-border'}`}>
          <p className="text-[11px] font-bold flex items-center gap-1"><Inbox className="w-3 h-3" />待安排</p>
          <p className={`text-[10px] ${day === UNPLANNED ? 'opacity-70' : 'text-muted-foreground'}`}>{unplanned.length} 个</p>
        </button>
        {days.map((d, i) => {
          const on = d === day;
          const n = stopsOf(state, trip, d).length;
          const bk = bookingsForDay(state, trip, d);
          const icons = `${bk.arrival || bk.departure ? '✈️' : ''}${bk.fixed.map((f) => (f.kind === 'flight' ? '✈️' : '🚄')).join('')}`;
          return (
            <button key={d} onClick={() => pick(d)} data-on={on ? '1' : '0'}
              className={`shrink-0 rounded-2xl border px-3 py-1.5 text-center min-w-[64px] ${on ? 'bg-foreground text-background border-foreground' : d === todayISO() ? 'bg-emerald-50 border-emerald-300 dark:bg-emerald-500/10' : 'bg-card border-border'}`}>
              <p className="text-[11px] font-bold">D{i + 1} · {md(d)}{icons && ` ${icons}`}</p>
              <p className={`text-[10px] ${on ? 'opacity-70' : 'text-muted-foreground'}`}>{weekday(d)} · {n ? `${n} 站` : '空'}</p>
            </button>
          );
        })}
      </div>

      {days.length > 0 && (
        <div className="px-4">
          <button onClick={() => setTripPlanOpen(true)}
            className="w-full rounded-2xl border border-violet-300/70 dark:border-violet-500/40 bg-violet-50 dark:bg-violet-500/10 px-3 py-2.5 flex items-center gap-2 text-left">
            <Sparkles className="w-4 h-4 text-violet-600 shrink-0" />
            <span className="flex-1 text-sm font-bold text-violet-800 dark:text-violet-200">AI 帮我排整个旅行</span>
            <span className="text-[11px] text-violet-700/80 dark:text-violet-300/80">攻略库 + 订单 + 必去 ›</span>
          </button>
        </div>
      )}

      {!days.length && (
        <div className="mx-4 rounded-2xl border border-border bg-card p-3 flex items-center gap-3 text-sm">
          <span className="flex-1">旅行还没设定日期，设好就能按天排。</span>
          <button onClick={openSettings} className="rounded-xl bg-primary text-primary-foreground px-3 py-2 text-xs font-bold">设定日期</button>
        </div>
      )}

      {day === UNPLANNED ? (
        <div className="px-4 space-y-2">
          <p className="text-xs text-muted-foreground">想去但还没决定哪天的。到攻略库点地点 →「加入行程」也会放这里。</p>
          {!unplanned.length && <Empty emoji="🧺" title="待安排是空的" />}
          {unplanned.map((s) => (
            <div key={s.id} className="rounded-2xl border border-border bg-card p-3 flex items-center gap-3">
              <button onClick={() => setOpenId(s.id)} className="flex-1 min-w-0 text-left">
                <p className="font-bold truncate">{categoryOf(s.category).emoji} {s.title}</p>
                <p className="text-[11px] text-muted-foreground truncate">{s.subtype || categoryOf(s.category).label} · {s.area || s.region || '—'}</p>
              </button>
              <button onClick={() => setMoveId(s.id)} className="shrink-0 rounded-xl bg-primary/10 text-primary px-3 py-2 text-xs font-bold">排到哪天</button>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-4 space-y-3">
          {/* Day settings */}
          <button onClick={() => setSettingsOpen(true)} className="w-full rounded-2xl border border-border bg-card p-3 flex items-center gap-3 text-left">
            <Settings2 className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0 text-xs">
              <p className="font-bold text-sm truncate">{set.start ? `🏠 ${set.startLabel}` : '先设定从哪里出发（酒店）'}{set.startSource === 'booking' && <span className="ml-1 text-[10px] font-bold text-violet-600">订单</span>}</p>
              {set.end && set.endSource !== 'back' && <p className="text-muted-foreground truncate">→ 🏁 {set.endLabel}</p>}
              <p className="text-muted-foreground truncate">{set.startTime} 出门 → {set.endTime} 前结束 · 午餐 {set.lunch.split('-')[0]} · 晚餐 {set.dinner.split('-')[0]}</p>
            </div>
            <span className="text-xs font-bold text-primary shrink-0">改</span>
          </button>

          {(set.bookings.arrival || set.bookings.departure) && (
            <div className="rounded-2xl bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/30 px-3 py-2 text-xs space-y-0.5">
              {set.bookings.arrival && <p>✈️ <b>{set.bookings.arrival.number}</b> {set.bookings.arrival.endTime} 落地，出关后约 {set.bookings.startTime} 开始</p>}
              {set.bookings.departure && <p>✈️ <b>{set.bookings.departure.number}</b> {set.bookings.departure.startTime} 起飞 → <b>{set.bookings.endTime}</b> 前到机场（提早 3 小时）{set.leaveBy && <> → 到机场约 {set.toAirport} 分，<b>最晚 {set.leaveBy} 出门</b></>}</p>}
            </div>
          )}

          {/* AI */}
          <div className="rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white p-3">
            <div className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-extrabold">AI 帮我排</p>
                <p className="text-[11px] opacity-90">按距离、用餐时间和贴文写的营业时间排顺序，估每站待多久</p>
              </div>
              <button onClick={runAI} disabled={busy || userStops.length < 2}
                className="shrink-0 rounded-xl bg-white text-violet-700 px-3 py-2 text-xs font-black flex items-center gap-1 disabled:opacity-60">
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                {busy ? '排序中…' : set.plannedAt ? '重新排' : '开始排'}
              </button>
            </div>
            {userStops.length < 2 && <p className="text-[11px] mt-2 opacity-90">这天加 2 个以上地点就可以排</p>}
            {set.bookings.fixed.length > 0 && userStops.length >= 2 && <p className="text-[11px] mt-2 opacity-90">会避开订单的 {set.bookings.fixed.map((f) => f.fixed).join('、')}，前后分开排</p>}
            {set.summary && userStops.length >= 2 && <p className="text-xs mt-2 bg-white/15 rounded-xl px-3 py-2 whitespace-pre-line">{set.summary}</p>}
          </div>

          {/* Timeline */}
          {stops.length > 0 || set.bookings.departure || set.bookings.arrival ? (
            <div className="space-y-0">
              {[...set.bookings.connections.filter((c) => c !== set.bookings.departure && set.bookings.arrival && `${c.startDate}${c.startTime}` < `${set.bookings.arrival.startDate}${set.bookings.arrival.startTime}`), ...(set.bookings.arrival ? [set.bookings.arrival] : [])]
                .map((f) => <FlightRow key={f.id} f={f} />)}
              <EndPoint icon={Home} name={set.start ? set.startLabel : '出发点（还没设定）'} time={set.startTime} sub={set.leaveBy ? `最晚 ${set.leaveBy} 出门` : '出门'} />
              {stops.map((s, i) => {
                const j = userStops.indexOf(s);
                return (
                  <React.Fragment key={s.id}>
                    <Leg leg={tl.legs[i]} from={pointOf(tl.legs[i].from)} to={s} />
                    {s.fixed ? <FixedCard s={s} /> : (
                      <StopCard s={s} i={j} n={userStops.length} state={state} trip={trip}
                        onMove={(dir) => move(j, dir)} onMore={() => setMoreId(s.id)} onOpen={() => setOpenId(s.id)} />
                    )}
                  </React.Fragment>
                );
              })}
              {set.end && tl.legs[stops.length] && (
                <>
                  <Leg leg={tl.legs[stops.length]} from={pointOf(tl.legs[stops.length].from)} to={set.end} />
                  <EndPoint icon={set.endSource === 'back' ? Home : Flag} name={set.endSource === 'back' ? set.end.name : set.endLabel} time={tl.endTime} sub={set.bookings.departure ? `要在 ${set.endTime} 前到` : '结束'} />
                </>
              )}
              {set.bookings.departure && [set.bookings.departure, ...set.bookings.connections.filter((c) => `${c.startDate}${c.startTime}` >= `${set.bookings.departure.startDate}${set.bookings.departure.startTime}`)]
                .map((f, i) => <FlightRow key={f.id} f={f} sub={i ? '转机' : '回程'} />)}
              <p className="text-[11px] text-muted-foreground pt-3 text-center">
                步行 {fmtMin(tl.walkMin)} · 搭车 {fmtMin(tl.transitMin)} · 大约 {tl.endTime} 结束（交通时间按直线距离估算）
              </p>
              {tl.late && (
                <p className="mt-2 rounded-xl bg-amber-50 dark:bg-amber-500/10 text-amber-800 dark:text-amber-200 text-xs px-3 py-2 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0" />比 {set.endTime} 晚，可以把一两站移到别天
                </p>
              )}
            </div>
          ) : (
            <Empty emoji="🗺️" title="这天还没有地点">
              <p>从攻略库挑想去的地方，再让 AI 排顺序。</p>
            </Empty>
          )}

          <button onClick={() => setAddOpen(true)} className="w-full rounded-2xl border-2 border-dashed border-border py-3 text-sm font-bold text-primary flex items-center justify-center gap-1.5">
            <Plus className="w-4 h-4" /> 从攻略库加地点{unplanned.length ? `（待安排 ${unplanned.length}）` : ''}
          </button>
        </div>
      )}

      {day && (
        <>
          <DaySettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} trip={trip} day={day} settings={set} korea={korea} />
          <AddStopsSheet open={addOpen} onClose={() => setAddOpen(false)} trip={trip} day={day} from={set.start} />
        </>
      )}
      <TripPlanSheet open={tripPlanOpen} onClose={() => setTripPlanOpen(false)} trip={trip} />
      <StopSheet stop={moreStop} onClose={() => setMoreId(null)} onMoveDay={() => { setMoveId(moreId); setMoreId(null); }} />
      <AddToPlanSheet save={moveSave} trip={trip} onClose={() => setMoveId(null)} />
      <SaveSheet save={openSave} onClose={() => setOpenId(null)} trip={trip} />
    </div>
  );
}
