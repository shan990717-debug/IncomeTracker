import React, { useEffect, useMemo, useState } from 'react';
import { Check } from 'lucide-react';
import { toast } from 'sonner';
import { actions, ofTrip } from '../lib/store';
import { suggestDay } from '../lib/suggest';
import { md, weekday } from '../lib/dates';
import { cn } from '@/lib/utils';
import { Sheet, PrimaryButton, inputCls } from './ui';
import { kindOf } from './ItemSheet';

export default function SuggestSheet({ open, onClose, state, trip, date, onNeedLodging }) {
  const result = useMemo(
    () => (open ? suggestDay({ date, lodgings: ofTrip(state.lodgings, trip), items: ofTrip(state.items, trip), saves: ofTrip(state.saves, trip) }) : null),
    [open, date, state, trip],
  );
  const [picked, setPicked] = useState({});
  const [times, setTimes] = useState({});

  useEffect(() => {
    if (!result) return;
    setPicked(Object.fromEntries(result.suggestions.map((s) => [s.key, true])));
    setTimes(Object.fromEntries(result.suggestions.map((s) => [s.key, s.time])));
  }, [result]);

  const chosen = result?.suggestions.filter((s) => picked[s.key]) || [];
  const add = () => {
    chosen.forEach((s) => actions.addItem(trip.id, { ...s.draft, date, time: times[s.key] || s.time }));
    toast.success(`已加入 ${chosen.length} 个行程`);
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={`智能安排 · ${md(date)} ${weekday(date)}`}
      footer={result?.suggestions.length ? <PrimaryButton disabled={!chosen.length} onClick={add}>加入 {chosen.length} 个</PrimaryButton> : null}>
      {result && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {result.lodging
              ? <>住在 <b className="text-foreground">{result.lodging.name}</b>（{result.lodging.region}{result.lodging.area ? ` · ${result.lodging.area}` : ''}），从你收藏的{result.region}清单里挑同区、顺路的，按时段排好。可以取消勾选或改时间。</>
              : result.region ? `按${result.region}的收藏推荐。` : ''}
          </p>

          {result.hint && (
            <div className="rounded-xl bg-muted px-3 py-3 text-sm">
              {result.hint}
              {!result.lodging && <button onClick={onNeedLodging} className="block mt-2 text-primary font-semibold">去填住宿 →</button>}
            </div>
          )}

          {result.suggestions.map((s) => {
            const k = kindOf(s.draft.kind);
            const on = !!picked[s.key];
            return (
              <div key={s.key} className={`flex items-start gap-3 rounded-2xl border p-3 transition ${on ? 'border-primary bg-primary/5' : 'border-border bg-card opacity-60'}`}>
                <button onClick={() => setPicked((p) => ({ ...p, [s.key]: !on }))} aria-label={on ? '取消' : '选择'}
                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 ${on ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/40'}`}>
                  {on && <Check className="w-3.5 h-3.5" />}
                </button>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <p className="font-semibold text-sm leading-snug line-clamp-2">{k.emoji} {s.draft.title}</p>
                  <p className="text-[11px] text-muted-foreground truncate">{s.reason}{s.draft.area && !s.reason.includes(s.draft.area) ? ` · ${s.draft.area}` : ''}</p>
                  <input type="time" value={times[s.key] || ''} onChange={(e) => setTimes((t) => ({ ...t, [s.key]: e.target.value }))}
                    className={cn(inputCls, 'w-36 px-2 py-1 text-xs')} aria-label="时间" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Sheet>
  );
}
