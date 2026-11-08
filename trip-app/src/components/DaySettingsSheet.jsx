import React, { useEffect, useState } from 'react';
import { Home, Flag, ChevronRight } from 'lucide-react';
import { actions } from '../lib/store';
import { Sheet, Field, PrimaryButton, inputCls } from './ui';
import AnchorSheet from './AnchorSheet';

const split = (w) => String(w || '').split('-');

/** 每天设定: start / end point, times, meal windows. */
export default function DaySettingsSheet({ open, onClose, trip, day, settings, korea }) {
  const [d, setD] = useState(settings);
  const [picking, setPicking] = useState(null); // 'start' | 'end'
  useEffect(() => { if (open) setD(settings); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!open || !d) return <Sheet open={false} onClose={onClose} />;
  const set = (p) => setD((x) => ({ ...x, ...p }));
  const endMode = d.endPlace?.none ? 'none' : d.endPlace ? 'other' : 'back';
  const [l1, l2] = split(d.lunch);
  const [d1, d2] = split(d.dinner);
  const pt = (p) => ({ name: p.name, address: p.address || '', lat: p.lat, lng: p.lng });

  const save = () => {
    actions.updatePlanDay(trip.id, day, {
      startPlace: d.startPlace, endPlace: d.endPlace, startTime: d.startTime, endTime: d.endTime, lunch: d.lunch, dinner: d.dinner,
    });
    onClose();
  };
  const placeBtn = 'w-full rounded-xl border border-border bg-card px-3 py-2.5 flex items-center gap-2 text-left text-sm';
  const time = (v, on, label) => <input type="time" value={v || ''} onChange={(e) => on(e.target.value)} aria-label={label} className={`${inputCls} tabular-nums`} />;

  return (
    <>
      <Sheet open onClose={onClose} title="这天的设定" footer={<PrimaryButton onClick={save}>好了</PrimaryButton>}>
        <div className="space-y-4">
          <Field label="从哪里出发（通常是酒店）" hint={settings.inherited && d.startPlace === settings.startPlace ? '沿用前一天的出发点' : ''}>
            <button onClick={() => setPicking('start')} className={placeBtn}>
              <Home className="w-4 h-4 text-primary shrink-0" />
              <span className={`flex-1 truncate ${d.startPlace ? 'font-semibold' : 'text-muted-foreground'}`}>{d.startPlace?.name || '选酒店 / 车站 / 我的位置'}</span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
          </Field>
          <Field label="最后去哪里">
            <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-muted p-1 text-xs font-bold">
              {[['back', '回出发点'], ['other', '别的地方'], ['none', '不用回去']].map(([v, label]) => (
                <button key={v} onClick={() => (v === 'other' ? setPicking('end') : set({ endPlace: v === 'none' ? { none: true } : null }))}
                  className={`rounded-xl py-2 ${endMode === v ? 'bg-card shadow text-foreground' : 'text-muted-foreground'}`}>{label}</button>
              ))}
            </div>
            {endMode === 'other' && (
              <button onClick={() => setPicking('end')} className={placeBtn}>
                <Flag className="w-4 h-4 text-primary shrink-0" /><span className="flex-1 truncate font-semibold">{d.endPlace.name}</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="几点出门">{time(d.startTime, (v) => set({ startTime: v }), '几点出门')}</Field>
            <Field label="几点前结束">{time(d.endTime, (v) => set({ endTime: v }), '几点前结束')}</Field>
          </div>
          <Field label="🍱 午餐时间">
            <div className="flex items-center gap-2">{time(l1, (v) => set({ lunch: `${v}-${l2}` }), '午餐开始')}<span>–</span>{time(l2, (v) => set({ lunch: `${l1}-${v}` }), '午餐结束')}</div>
          </Field>
          <Field label="🍽 晚餐时间">
            <div className="flex items-center gap-2">{time(d1, (v) => set({ dinner: `${v}-${d2}` }), '晚餐开始')}<span>–</span>{time(d2, (v) => set({ dinner: `${d1}-${v}` }), '晚餐结束')}</div>
          </Field>
        </div>
      </Sheet>
      <AnchorSheet open={!!picking} onClose={() => setPicking(null)} korea={korea}
        title={picking === 'start' ? '从哪里出发？' : '最后去哪里？'} meHint="用现在的位置"
        onPick={(p) => set(picking === 'start' ? { startPlace: pt(p) } : { endPlace: pt(p) })} />
    </>
  );
}
