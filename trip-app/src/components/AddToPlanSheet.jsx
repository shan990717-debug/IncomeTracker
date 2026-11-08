import React from 'react';
import { CalendarPlus, Inbox, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { actions, useTripState } from '../lib/store';
import { daysOf, dayTitle, stopsOf, UNPLANNED } from '../lib/plan';
import { md } from '../lib/dates';
import { Sheet } from './ui';

/** 加入行程: pick a day (or 待安排). 避雷 places can't be added. */
export default function AddToPlanSheet({ save, trip, onClose, onDone }) {
  const state = useTripState();
  if (!save) return <Sheet open={false} onClose={onClose} />;
  const days = daysOf(trip);
  const pick = (day) => {
    actions.addToPlan(save.id, day);
    toast.success(day ? `已加入 ${md(day)}` : '已放进待安排');
    onDone?.(day);
    onClose();
  };
  const row = 'w-full rounded-2xl border p-3 flex items-center gap-3 text-left';
  return (
    <Sheet open onClose={onClose} title={`「${save.title}」放哪一天？`}>
      <div className="space-y-2 pb-2">
        {!days.length && <p className="text-xs text-muted-foreground">旅行还没设定日期，先放进「待安排」，设好日期再排。</p>}
        {days.map((d) => {
          const n = stopsOf(state, trip, d).filter((s) => s.id !== save.id).length;
          const here = save.inPlan && save.planDay === d;
          return (
            <button key={d} onClick={() => pick(d)} className={`${row} ${here ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}>
              <CalendarPlus className="w-4 h-4 text-primary shrink-0" />
              <span className="flex-1 text-sm font-bold">{dayTitle(trip, d)}</span>
              <span className="text-xs text-muted-foreground">{here ? '现在在这天' : n ? `已有 ${n} 站` : '还没排'}</span>
            </button>
          );
        })}
        <button onClick={() => pick(UNPLANNED)} className={`${row} ${save.inPlan && !save.planDay ? 'border-primary bg-primary/5' : 'border-dashed border-border'}`}>
          <Inbox className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="flex-1 text-sm font-bold">先放「待安排」</span>
          <span className="text-xs text-muted-foreground">想去，还没决定哪天</span>
        </button>
        {save.inPlan && (
          <button onClick={() => { actions.removeFromPlan(save.id); toast('已移出行程'); onDone?.(null); onClose(); }}
            className="w-full py-2.5 text-sm font-semibold text-muted-foreground hover:text-destructive flex items-center justify-center gap-1.5">
            <Trash2 className="w-4 h-4" /> 移出行程
          </button>
        )}
      </div>
    </Sheet>
  );
}
