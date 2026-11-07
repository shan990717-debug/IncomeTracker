import React, { useEffect, useState } from 'react';
import { Bell, Trash2 } from 'lucide-react';
import { actions, itemStatus } from '../lib/store';
import { CATEGORIES } from '../lib/parse';
import { tripDates, md, weekday } from '../lib/dates';
import { Sheet, Field, Stars, PrimaryButton, inputCls } from './ui';
import MapLinks from './MapLinks';

export const KINDS = [
  ...CATEGORIES.map((c) => ({ id: c.id, label: c.label.replace('想', ''), emoji: c.emoji })),
  { id: 'transport', label: '交通', emoji: '🚄' },
  { id: 'flight', label: '航班', emoji: '✈️' },
  { id: 'note', label: '提醒', emoji: '📌' },
];
export const kindOf = (id) => KINDS.find((k) => k.id === id) || KINDS[1];

const REMIND = [
  { v: 15, label: '15 分钟前' }, { v: 30, label: '30 分钟前' }, { v: 60, label: '1 小时前' },
  { v: 120, label: '2 小时前' }, { v: 180, label: '3 小时前' },
];

/** Create (item.id undefined) or edit an itinerary stop. */
export default function ItemSheet({ item, onClose, state, trip }) {
  const [d, setD] = useState(item);
  useEffect(() => setD(item), [item]);
  if (!item || !d) return <Sheet open={false} onClose={onClose} />;

  const isNew = !item.id;
  const status = isNew ? { done: false, rating: 0, review: '' } : itemStatus(state, item);
  const set = (p) => setD((x) => ({ ...x, ...p }));

  const save = () => {
    const { id, ...rest } = d;
    if (isNew) actions.addItem(trip.id, rest);
    else actions.updateItem(id, rest);
    onClose();
  };

  return (
    <Sheet open onClose={onClose} title={isNew ? '加入行程' : '行程详情'}
      footer={
        <div className="flex gap-2">
          {!isNew && (
            <button aria-label="删除" onClick={() => { actions.deleteItem(item.id); onClose(); }}
              className="w-12 shrink-0 rounded-xl border border-border text-muted-foreground hover:text-destructive flex items-center justify-center">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          <PrimaryButton disabled={!d.title?.trim() || !d.date} onClick={save}>{isNew ? '加入' : '保存'}</PrimaryButton>
        </div>
      }>
      <div className="space-y-4">
        <Field label="名称"><input value={d.title} onChange={(e) => set({ title: e.target.value })} className={`${inputCls} font-semibold`} placeholder="例：KTX 首尔 → 釜山" autoFocus={isNew} /></Field>

        <div className="grid grid-cols-4 gap-1.5">
          {KINDS.map((k) => (
            <button key={k.id} onClick={() => set({ kind: k.id })}
              className={`rounded-xl py-2 text-xs font-semibold border ${d.kind === k.id ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground'}`}>
              {k.emoji} {k.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label="日期">
            <select value={d.date} onChange={(e) => set({ date: e.target.value })} className={inputCls}>
              {tripDates(trip).map((x, i) => <option key={x} value={x}>D{i + 1} · {md(x)} {weekday(x)}</option>)}
            </select>
          </Field>
          <Field label="时间"><input type="time" value={d.time || ''} onChange={(e) => set({ time: e.target.value })} className={inputCls} /></Field>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label="地区">
            <select value={d.region || ''} onChange={(e) => set({ region: e.target.value })} className={inputCls}>
              <option value="">—</option>
              {trip.regions.map((r) => <option key={r}>{r}</option>)}
            </select>
          </Field>
          <Field label="区域"><input value={d.area || ''} onChange={(e) => set({ area: e.target.value })} className={inputCls} placeholder="例：海云台" /></Field>
        </div>

        {d.title?.trim() && !['transport', 'flight', 'note'].includes(d.kind) && (
          <MapLinks place={{ ...d, ...(state.saves.find((x) => x.id === d.saveId) || {}) }} />
        )}

        <Field label="备注"><textarea rows={2} value={d.note || ''} onChange={(e) => set({ note: e.target.value })} className={`${inputCls} resize-none`} placeholder="订位号、车厢座位、集合地点…" /></Field>

        <div className="rounded-2xl border border-border p-3 space-y-2">
          <label className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 text-sm font-semibold"><Bell className="w-4 h-4 text-amber-500" />重要时间点，当天提醒我</span>
            <input type="checkbox" checked={!!d.important} onChange={(e) => set({ important: e.target.checked })} className="w-5 h-5 accent-[hsl(var(--primary))]" />
          </label>
          {d.important && (
            <select value={d.remindMin || 30} onChange={(e) => set({ remindMin: Number(e.target.value) })} className={inputCls}>
              {REMIND.map((r) => <option key={r.v} value={r.v}>{r.label}</option>)}
            </select>
          )}
        </div>

        {!isNew && (
          <div className="rounded-2xl border border-border p-3 space-y-2">
            <label className="flex items-center justify-between">
              <span className="text-sm font-semibold">完成打卡</span>
              <input type="checkbox" checked={status.done} onChange={(e) => actions.setItemStatus(item, { done: e.target.checked })} className="w-5 h-5 accent-[hsl(var(--primary))]" />
            </label>
            {status.done && (
              <>
                <Stars value={status.rating} onChange={(n) => actions.setItemStatus(item, { rating: n })} size="w-6 h-6" />
                <input defaultValue={status.review} onBlur={(e) => actions.setItemStatus(item, { review: e.target.value })} className={inputCls} placeholder="一句话评价" />
              </>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}
