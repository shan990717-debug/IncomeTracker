import React, { useMemo, useState } from 'react';
import { Check, Plus } from 'lucide-react';
import { actions, useTripState, ofTrip } from '../lib/store';
import { categoryOf } from '../lib/parse';
import { md } from '../lib/dates';
import { km, fmtKm } from '../lib/geo';
import { Sheet, Chip, PrimaryButton } from './ui';

/**
 * Pick places from 攻略库 for one day. 待安排 ones come first; then the
 * closest to the day's start point. 避雷 places are not offered.
 */
export default function AddStopsSheet({ open, onClose, trip, day, from }) {
  const state = useTripState();
  const [city, setCity] = useState('all');
  const [cat, setCat] = useState('all');
  const all = ofTrip(state.saves, trip).filter((s) => s.verdict !== 'avoid');
  const cities = [...new Set(all.map((s) => s.region).filter(Boolean))];

  const list = useMemo(() => all
    .filter((s) => (city === 'all' || s.region === city) && (cat === 'all' || s.category === cat))
    .map((s) => ({ s, d: from ? km(from, s) : null }))
    .sort((a, b) => ((b.s.inPlan && !b.s.planDay) - (a.s.inPlan && !a.s.planDay))
      || ((a.d ?? 9999) - (b.d ?? 9999))), [all, city, cat, from]);

  if (!open) return <Sheet open={false} onClose={onClose} />;
  const toggle = (s) => (s.inPlan && s.planDay === day ? actions.removeFromPlan(s.id) : actions.addToPlan(s.id, day));
  const count = all.filter((s) => s.inPlan && s.planDay === day).length;

  return (
    <Sheet open onClose={onClose} title={`加地点到 ${md(day)}`} footer={<PrimaryButton onClick={onClose}>好了{count ? `（这天 ${count} 站）` : ''}</PrimaryButton>}>
      <div className="space-y-2 pb-2">
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-5 px-5">
          <Chip active={city === 'all'} onClick={() => setCity('all')}>全部城市</Chip>
          {cities.map((c) => <Chip key={c} active={city === c} onClick={() => setCity(c)}>{c}</Chip>)}
        </div>
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-5 px-5">
          {['all', 'food', 'place', 'experience', 'shopping'].map((c) => (
            <Chip key={c} active={cat === c} onClick={() => setCat(c)}>{c === 'all' ? '全部' : `${categoryOf(c).emoji} ${categoryOf(c).label}`}</Chip>
          ))}
        </div>
        {!list.length && <p className="text-sm text-muted-foreground py-6 text-center">这里没有地点</p>}
        {list.map(({ s, d }) => {
          const here = s.inPlan && s.planDay === day;
          const elsewhere = s.inPlan && s.planDay && s.planDay !== day;
          return (
            <button key={s.id} onClick={() => toggle(s)}
              className={`w-full text-left rounded-2xl border p-3 flex items-center gap-3 ${here ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}>
              <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${here ? 'bg-primary text-primary-foreground' : 'border-2 border-border text-muted-foreground'}`}>
                {here ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-bold truncate">{categoryOf(s.category).emoji} {s.title}</span>
                <span className="block text-[11px] text-muted-foreground truncate">
                  {s.subtype || categoryOf(s.category).label} · {s.area || s.region || '—'}
                  {s.inPlan && !s.planDay && <b className="text-amber-600"> · 待安排</b>}
                  {elsewhere && <b className="text-primary"> · 已排在 {md(s.planDay)}（点了会移过来）</b>}
                </span>
              </span>
              {d != null && <span className="text-xs font-bold text-primary tabular-nums shrink-0">{fmtKm(d)}</span>}
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
