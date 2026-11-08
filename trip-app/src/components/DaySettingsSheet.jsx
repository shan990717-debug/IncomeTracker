import React, { useEffect, useState } from 'react';
import { Home, Flag, ChevronRight, RotateCcw } from 'lucide-react';
import { actions } from '../lib/store';
import { Sheet, Field, PrimaryButton, inputCls } from './ui';
import AnchorSheet from './AnchorSheet';

const split = (w) => String(w || '').split('-');
const SOURCE = { booking: '来自订单', prev: '沿用前一天的出发点', manual: '' };

/**
 * 每天设定: start / end point, times, meal windows. Only what the user
 * actually changes is saved for the day, so points that come from 订单 keep
 * following the bookings.
 */
export default function DaySettingsSheet({ open, onClose, trip, day, settings, korea }) {
  const init = () => ({
    start: settings.start, startManual: settings.startSource === 'manual',
    end: settings.endSource === 'manual' ? settings.end : null, endMode: settings.endSource === 'manual' ? 'other' : settings.endSource === 'none' ? 'none' : 'auto',
    startTime: settings.startTime, endTime: settings.endTime, lunch: settings.lunch, dinner: settings.dinner,
  });
  const [d, setD] = useState(init);
  const [picking, setPicking] = useState(null); // 'start' | 'end'
  useEffect(() => { if (open) setD(init()); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!open || !d) return <Sheet open={false} onClose={onClose} />;
  const set = (p) => setD((x) => ({ ...x, ...p }));
  const [l1, l2] = split(d.lunch);
  const [d1, d2] = split(d.dinner);
  const pt = (p) => ({ name: p.name, address: p.address || '', lat: p.lat, lng: p.lng });
  const autoEnd = settings.endSource === 'booking' ? settings.endLabel : settings.start ? `回出发点` : '回出发点';

  const save = () => {
    const patch = {
      startPlace: d.startManual ? d.start : null,
      endPlace: d.endMode === 'none' ? { none: true } : d.endMode === 'other' ? d.end : null,
      lunch: d.lunch, dinner: d.dinner,
    };
    // Times that the bookings moved aren't saved back unless edited.
    if (d.startTime !== settings.startTime) patch.startTime = d.startTime;
    if (d.endTime !== settings.endTime) patch.endTime = d.endTime;
    actions.updatePlanDay(trip.id, day, patch);
    onClose();
  };
  const placeBtn = 'w-full rounded-xl border border-border bg-card px-3 py-2.5 flex items-center gap-2 text-left text-sm';
  const time = (v, on, label) => <input type="time" value={v || ''} onChange={(e) => on(e.target.value)} aria-label={label} className={`${inputCls} tabular-nums`} />;

  return (
    <>
      <Sheet open onClose={onClose} title="这天的设定" footer={<PrimaryButton onClick={save}>好了</PrimaryButton>}>
        <div className="space-y-4">
          <Field label="从哪里出发（通常是酒店）" hint={!d.startManual ? SOURCE[settings.startSource] : ''}>
            <button onClick={() => setPicking('start')} className={placeBtn}>
              <Home className="w-4 h-4 text-primary shrink-0" />
              <span className={`flex-1 truncate ${d.start ? 'font-semibold' : 'text-muted-foreground'}`}>
                {d.start ? (!d.startManual ? settings.startLabel : d.start.name) : '选酒店 / 车站 / 我的位置'}
              </span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </button>
            {d.startManual && settings.bookings.start && (
              <button onClick={() => set({ start: settings.bookings.start, startManual: false })} className="text-xs font-semibold text-primary flex items-center gap-1">
                <RotateCcw className="w-3 h-3" /> 改回订单的「{settings.bookings.start.name}」
              </button>
            )}
          </Field>
          <Field label="最后去哪里">
            <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-muted p-1 text-xs font-bold">
              {[['auto', settings.endSource === 'booking' || (settings.endSource === 'manual' && settings.bookings.end) ? '按订单' : '回出发点'], ['other', '别的地方'], ['none', '不用回去']].map(([v, label]) => (
                <button key={v} onClick={() => (v === 'other' ? setPicking('end') : set({ endMode: v }))}
                  className={`rounded-xl py-2 ${d.endMode === v ? 'bg-card shadow text-foreground' : 'text-muted-foreground'}`}>{label}</button>
              ))}
            </div>
            {d.endMode === 'auto' && <p className="text-[11px] text-muted-foreground">{settings.bookings.end ? `${settings.bookings.end.label ? `${settings.bookings.end.label} · ` : ''}${settings.bookings.end.name}` : autoEnd}</p>}
            {d.endMode === 'other' && d.end && (
              <button onClick={() => setPicking('end')} className={placeBtn}>
                <Flag className="w-4 h-4 text-primary shrink-0" /><span className="flex-1 truncate font-semibold">{d.end.name}</span>
                <ChevronRight className="w-4 h-4 text-muted-foreground" />
              </button>
            )}
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="几点出门">{time(d.startTime, (v) => set({ startTime: v }), '几点出门')}</Field>
            <Field label="几点前结束">{time(d.endTime, (v) => set({ endTime: v }), '几点前结束')}</Field>
          </div>
          {(settings.bookings.startTime || settings.bookings.endTime) && (
            <p className="text-[11px] text-violet-700 dark:text-violet-300 -mt-2">
              ✈️ 按订单：{settings.bookings.startTime && `落地后 ${settings.bookings.startTime} 开始`}{settings.bookings.startTime && settings.bookings.endTime && '，'}{settings.bookings.endTime && `${settings.bookings.endTime} 前要往机场`}
            </p>
          )}
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
        onPick={(p) => set(picking === 'start' ? { start: pt(p), startManual: true } : { end: pt(p), endMode: 'other' })} />
    </>
  );
}
