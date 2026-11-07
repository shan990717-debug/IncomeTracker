import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { BedDouble, Sparkles, Plus, Bell, Check, Bookmark, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { actions, itemStatus, lodgingFor, ofTrip } from '../lib/store';
import { tripDates, md, weekday, todayISO, toMinutes } from '../lib/dates';
import { categoryOf } from '../lib/parse';
import { Stars, Sheet, Empty } from '../components/ui';
import ItemSheet, { kindOf } from '../components/ItemSheet';
import LodgingSheet from '../components/LodgingSheet';
import SuggestSheet from '../components/SuggestSheet';

const DEFAULT_TIME = { food: '12:30', place: '10:00', experience: '14:30', shopping: '16:00' };

export function TimelineItem({ item, state, onOpen, highlight }) {
  const k = kindOf(item.kind);
  const st = itemStatus(state, item);
  return (
    <div className={`relative flex gap-3 ${highlight ? 'rounded-2xl bg-primary/5 -mx-2 px-2 py-1' : ''}`}>
      <div className="w-12 shrink-0 text-right pt-3">
        <span className={`text-sm font-bold tabular-nums ${st.done ? 'text-muted-foreground' : ''}`}>{item.time || '—'}</span>
      </div>
      <div className="flex-1 min-w-0 rounded-2xl border border-border bg-card p-3 flex gap-3 items-start">
        <button className="flex-1 min-w-0 text-left" onClick={() => onOpen(item)}>
          <p className={`font-semibold leading-snug ${st.done ? 'line-through text-muted-foreground decoration-muted-foreground/50' : ''}`}>
            <span className="mr-1">{k.emoji}</span>{item.title}
          </p>
          <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground flex-wrap">
            {item.area && <span>{item.area}</span>}
            {item.important && <span className="inline-flex items-center gap-0.5 text-amber-600 font-semibold"><Bell className="w-3 h-3" />提前 {item.remindMin >= 60 ? `${item.remindMin / 60} 小时` : `${item.remindMin} 分`}</span>}
            {item.saveId && <span className="inline-flex items-center gap-0.5"><Bookmark className="w-3 h-3" />收藏</span>}
            {item.note && <span className="truncate max-w-[180px]">{item.note}</span>}
          </div>
          {st.done && <div className="mt-1.5" onClick={(e) => e.stopPropagation()}><Stars value={st.rating} onChange={(n) => actions.setItemStatus(item, { rating: n })} size="w-4 h-4" /></div>}
        </button>
        <button onClick={() => actions.setItemStatus(item, { done: !st.done })} aria-label={st.done ? '取消打卡' : '打卡'}
          className={`w-7 h-7 rounded-full border-2 flex items-center justify-center shrink-0 transition ${st.done ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/30 hover:border-primary'}`}>
          {st.done && <Check className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
}

function PickSaveSheet({ open, onClose, state, trip, date, region }) {
  const scheduled = new Set(state.items.map((i) => i.saveId).filter(Boolean));
  const list = ofTrip(state.saves, trip)
    .filter((s) => !scheduled.has(s.id) && !s.done)
    .sort((a, b) => (b.region === region) - (a.region === region) || b.starred - a.starred);

  const pick = (s) => {
    actions.addItem(trip.id, { date, time: DEFAULT_TIME[s.category], title: s.title, kind: s.category, saveId: s.id, region: s.region, area: s.area });
    toast.success(`已加入 ${DEFAULT_TIME[s.category]}，点它可改时间`);
  };

  return (
    <Sheet open={open} onClose={onClose} title={`从收藏加入 · ${md(date)}`}>
      {!list.length ? <Empty emoji="📭" title="没有未安排的收藏" /> : (
        <div className="space-y-2">
          {list.map((s) => (
            <button key={s.id} onClick={() => pick(s)}
              className={`w-full text-left rounded-2xl border border-border bg-card p-3 flex items-center gap-3 ${region && s.region !== region ? 'opacity-55' : ''}`}>
              <span className="text-lg">{categoryOf(s.category).emoji}</span>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate">{s.title}</p>
                <p className="text-[11px] text-muted-foreground">{s.region}{s.area ? ` · ${s.area}` : ''}{s.starred ? ' · ❤️' : ''}</p>
              </div>
              <Plus className="w-4 h-4 text-primary" />
            </button>
          ))}
        </div>
      )}
    </Sheet>
  );
}

export default function Plan() {
  const { state, trip } = useOutletContext();
  const [params, setParams] = useSearchParams();
  const dates = tripDates(trip);
  const initial = params.get('d') || (dates.includes(todayISO()) ? todayISO() : dates[0]);
  const [date, setDate] = useState(initial);
  const [editing, setEditing] = useState(null);
  const [sheet, setSheet] = useState(null); // 'lodging' | 'suggest' | 'pick'
  const pillRef = useRef(null);

  useEffect(() => { if (!dates.includes(date)) setDate(dates[0]); }, [trip.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    pillRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ inline: 'center', block: 'nearest' });
  }, [date]);

  const lodgings = ofTrip(state.lodgings, trip);
  const items = ofTrip(state.items, trip);
  const lodging = lodgingFor(lodgings, date);
  const dayItems = useMemo(() => items.filter((i) => i.date === date).sort((a, b) => toMinutes(a.time) - toMinutes(b.time)), [items, date]);
  const doneCount = items.filter((i) => itemStatus(state, i).done).length;
  const region = lodging?.region || dayItems.find((i) => i.region)?.region || '';

  const choose = (d) => { setDate(d); setParams({ d }, { replace: true }); };

  return (
    <div className="pt-3">
      <div ref={pillRef} className="flex gap-1.5 overflow-x-auto no-scrollbar px-4 pb-1">
        {dates.map((d, i) => {
          const n = items.filter((x) => x.date === d).length;
          const r = lodgingFor(lodgings, d)?.region;
          return (
            <button key={d} data-active={d === date} onClick={() => choose(d)}
              className={`shrink-0 rounded-2xl border px-2.5 py-2 min-w-[60px] text-center ${d === date ? 'bg-foreground text-background border-foreground' : 'bg-card border-border'}`}>
              <div className="text-[10px] font-semibold opacity-70">D{i + 1} {weekday(d)}</div>
              <div className="text-base font-extrabold leading-tight">{md(d)}</div>
              <div className="text-[10px] truncate">{r || ' '}</div>
              <div className="flex justify-center gap-0.5 mt-1 h-1">{Array.from({ length: Math.min(n, 5) }).map((_, j) => <span key={j} className="w-1 h-1 rounded-full bg-primary" />)}</div>
            </button>
          );
        })}
      </div>

      <div className="px-4 pt-3 space-y-3">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>全程已打卡 <b className="text-foreground">{doneCount}</b> / {items.length}</span>
          <span>第 {dates.indexOf(date) + 1} 天 / 共 {dates.length} 天</span>
        </div>

        <button onClick={() => setSheet('lodging')} className="w-full rounded-2xl border border-border bg-card p-3 flex items-center gap-3 text-left">
          <div className="w-10 h-10 rounded-xl bg-indigo-100 text-indigo-600 dark:bg-indigo-500/15 dark:text-indigo-300 flex items-center justify-center shrink-0"><BedDouble className="w-5 h-5" /></div>
          <div className="flex-1 min-w-0">
            {lodging ? (
              <>
                <p className="text-[11px] text-muted-foreground">今晚住 · {lodging.region}{lodging.area ? ` · ${lodging.area}` : ''}</p>
                <p className="font-semibold truncate">{lodging.name}</p>
              </>
            ) : (
              <>
                <p className="font-semibold">还没填这晚住哪</p>
                <p className="text-[11px] text-muted-foreground">填了住宿，才能按区域推荐顺路的收藏</p>
              </>
            )}
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </button>

        <button onClick={() => setSheet('suggest')}
          className="w-full rounded-2xl p-3 flex items-center gap-3 text-left bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white shadow-md shadow-fuchsia-500/20">
          <Sparkles className="w-5 h-5 shrink-0" />
          <div className="flex-1">
            <p className="font-bold text-sm">智能安排这一天</p>
            <p className="text-[11px] opacity-90">按住宿位置、时段和你的收藏{region ? `（${region}）` : ''}推荐</p>
          </div>
          <ChevronRight className="w-4 h-4" />
        </button>

        <div className="space-y-2 pt-1">
          {dayItems.length ? dayItems.map((it) => <TimelineItem key={it.id} item={it} state={state} onOpen={setEditing} />) : (
            <p className="text-center text-sm text-muted-foreground py-6">这天还是空的</p>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 pt-1">
          <button onClick={() => setSheet('pick')} className="rounded-xl border border-dashed border-border py-3 text-sm font-semibold text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5">
            <Bookmark className="w-4 h-4" /> 从收藏加入
          </button>
          <button onClick={() => setEditing({ date, time: '', title: '', kind: 'transport', region, area: '', note: '', important: false, remindMin: 30 })}
            className="rounded-xl border border-dashed border-border py-3 text-sm font-semibold text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5">
            <Plus className="w-4 h-4" /> 自己加
          </button>
        </div>
      </div>

      <ItemSheet item={editing} onClose={() => setEditing(null)} state={state} trip={trip} />
      <LodgingSheet open={sheet === 'lodging'} onClose={() => setSheet(null)} state={state} trip={trip} date={date} />
      <SuggestSheet open={sheet === 'suggest'} onClose={() => setSheet(null)} state={state} trip={trip} date={date} onNeedLodging={() => setSheet('lodging')} />
      <PickSaveSheet open={sheet === 'pick'} onClose={() => setSheet(null)} state={state} trip={trip} date={date} region={region} />
    </div>
  );
}

