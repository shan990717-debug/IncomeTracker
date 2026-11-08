import React, { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Check, ChevronDown, Plus } from 'lucide-react';
import { actions, ofTrip, myPassport } from '../lib/store';
import { TIP_TYPES, relevantToTrip, notForMyPassport, isDone, whenLabel } from '../lib/tips';
import { todayISO } from '../lib/dates';
import { Chip, Empty } from '../components/ui';
import TipSheet from '../components/TipSheet';

function TipRow({ tip, trip, state, onOpen }) {
  const done = tip.isAction && isDone(tip, state);
  const when = whenLabel(tip, trip, todayISO());
  const members = state.members.filter((m) => m.tripId === trip.id).length;
  const otherPassport = notForMyPassport(tip, myPassport());
  return (
    <div className={`rounded-2xl border border-border bg-card p-3 flex gap-3 items-start ${otherPassport ? 'opacity-60' : ''}`}>
      {tip.isAction ? (
        <button onClick={() => actions.toggleTip(tip)} aria-label={done ? '取消完成' : '完成'}
          className={`mt-0.5 w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition ${done ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/40'}`}>
          {done && <Check className="w-3.5 h-3.5" />}
        </button>
      ) : <span className="mt-0.5 w-6 text-center text-base shrink-0">💡</span>}
      <button className="flex-1 min-w-0 text-left" onClick={() => onOpen(tip)}>
        <p className={`text-sm font-bold leading-snug ${done ? 'line-through text-muted-foreground' : ''}`}>{tip.title}</p>
        <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground flex-wrap">
          {when && !done && <span className={`font-bold ${when.late ? 'text-destructive' : 'text-primary'}`}>{when.text}</span>}
          {when && !done && !tip.offsetFromPost && <span className="text-violet-600 dark:text-violet-300">AI 建议</span>}
          <span className="rounded-full bg-muted px-2 py-0.5 font-semibold">{tip.cities.length ? tip.cities.join(' · ') : '全国'}</span>
          {tip.isAction && tip.personal && members > 1 && <span>👤 {tip.doneBy.length}/{members} 人完成</span>}
          {otherPassport && <span className="font-semibold">可能不适用你的护照（{tip.nationalities.join('、')}）</span>}
          {tip.sources.length > 0 && <span className="text-violet-600 dark:text-violet-300 font-semibold">📌 {tip.sources.length > 1 ? `${tip.sources.length} 篇贴文` : tip.sources[0].platform || '贴文'}</span>}
        </div>
      </button>
    </div>
  );
}

export default function Tips() {
  const { state, trip, openCollect } = useOutletContext();
  const [type, setType] = useState('all');
  const [showOther, setShowOther] = useState(false);
  const [open, setOpen] = useState(null);

  const all = ofTrip(state.tips, trip);
  const relevant = all.filter((t) => relevantToTrip(t, trip));
  const elsewhere = all.filter((t) => !relevantToTrip(t, trip));
  const shown = relevant.filter((t) => type === 'all' || t.type === type);
  const actionsList = relevant.filter((t) => t.isAction && !notForMyPassport(t, myPassport()));
  const doneCount = actionsList.filter((t) => isDone(t, state)).length;

  const groups = useMemo(() => TIP_TYPES.map((tt) => ({
    ...tt,
    // Undone first, then by how soon they're due.
    list: shown.filter((t) => t.type === tt.id).sort((a, b) => isDone(a, state) - isDone(b, state) || (a.offsetDays ?? 0) - (b.offsetDays ?? 0)),
  })).filter((g) => g.list.length), [shown, state]);

  if (state.tipsMissing) {
    return <Empty emoji="🛠️" title="资料库还没更新">请在 Supabase 的 SQL Editor 跑一次 <b>migrations/003_tips.sql</b>，须知才能存。</Empty>;
  }

  return (
    <div className="pt-3 px-4 space-y-3">
      {!myPassport() && (
        <p className="rounded-xl bg-muted px-3 py-2 text-[11px] text-muted-foreground">💡 在右上角「我的账号」填护照国家，入境须知就会标出适不适用你。</p>
      )}

      {actionsList.length > 0 && (
        <div className="rounded-2xl border border-border bg-card p-3">
          <div className="flex justify-between text-xs font-bold">要做的事<span className="text-primary">{doneCount} / {actionsList.length} 完成</span></div>
          <div className="h-2 rounded-full bg-muted mt-2 overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${(doneCount / actionsList.length) * 100}%` }} /></div>
        </div>
      )}

      {relevant.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4">
          <Chip active={type === 'all'} onClick={() => setType('all')}>全部</Chip>
          {TIP_TYPES.map((t) => {
            const n = relevant.filter((x) => x.type === t.id).length;
            return n ? <Chip key={t.id} active={type === t.id} onClick={() => setType(type === t.id ? 'all' : t.id)}>{t.emoji} {t.label} {n}</Chip> : null;
          })}
        </div>
      )}

      {!all.length ? (
        <Empty emoji="📝" title="还没有须知">
          <p>收集交通、入境、订票这类攻略时，AI 会把要注意、要做的事整理到这里。</p>
          <button onClick={openCollect} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-bold">
            <Plus className="w-4 h-4" /> 收集攻略
          </button>
        </Empty>
      ) : (
        groups.map((g) => (
          <section key={g.id}>
            <h3 className="text-sm font-extrabold mb-2">{g.emoji} {g.label} <span className="text-xs font-semibold text-muted-foreground">· {g.list.length}</span></h3>
            <div className="space-y-2">{g.list.map((t) => <TipRow key={t.id} tip={t} trip={trip} state={state} onOpen={setOpen} />)}</div>
          </section>
        ))
      )}

      {elsewhere.length > 0 && (
        <section>
          <button onClick={() => setShowOther(!showOther)} className="flex items-center gap-1 text-xs font-bold text-muted-foreground py-1">
            这次行程用不到 · {elsewhere.length} <ChevronDown className={`w-3.5 h-3.5 transition ${showOther ? 'rotate-180' : ''}`} />
          </button>
          {showOther && (
            <div className="space-y-2 mt-2 opacity-60">
              {elsewhere.map((t) => <TipRow key={t.id} tip={t} trip={trip} state={state} onOpen={setOpen} />)}
            </div>
          )}
        </section>
      )}

      <button onClick={() => setOpen({ title: '', type: 'other', points: [], cities: [], nationalities: [], isAction: true, personal: false, offsetDays: null, offsetFromPost: false, sources: [], doneBy: [] })}
        className="w-full rounded-xl border border-dashed border-border py-3 text-sm font-semibold text-muted-foreground flex items-center justify-center gap-1.5">
        <Plus className="w-4 h-4" /> 自己加一条
      </button>
      <p className="text-[11px] text-muted-foreground text-center pb-4">入境、签证规定会变，以官网为准。</p>

      <TipSheet tip={open} onClose={() => setOpen(null)} trip={trip} state={state} />
    </div>
  );
}

