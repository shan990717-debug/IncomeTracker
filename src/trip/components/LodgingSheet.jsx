import React, { useEffect, useState } from 'react';
import { Trash2, BedDouble, MapPin } from 'lucide-react';
import { coordsOf } from '../lib/geo';
import LocationSheet from './LocationSheet';
import { actions, ofTrip } from '../lib/store';
import { areasOf } from '../lib/regions';
import { md } from '../lib/dates';
import { Sheet, Field, Chip, PrimaryButton, inputCls } from './ui';

/** Lodging decides each day's region, which drives the smart suggestions. */
export default function LodgingSheet({ open, onClose, state, trip, date }) {
  const lodgings = ofTrip(state.lodgings, trip).sort((a, b) => a.checkIn.localeCompare(b.checkIn));
  const blank = { name: '', region: trip.regions[0], area: '', checkIn: date || trip.startDate, checkOut: trip.endDate };
  const [form, setForm] = useState(blank);
  useEffect(() => { if (open) setForm(blank); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const [locating, setLocating] = useState(false);
  const set = (p) => setForm((f) => ({ ...f, ...p }));
  const valid = form.name.trim() && form.checkIn < form.checkOut;

  return (
    <Sheet open={open} onClose={onClose} title="住宿"
      footer={<PrimaryButton disabled={!valid} onClick={() => { actions.upsertLodging(trip.id, form); setForm(blank); }}>{form.id ? '保存修改' : '＋ 加入住宿'}</PrimaryButton>}>
      <div className="space-y-4">
        {lodgings.length > 0 && (
          <div className="space-y-2">
            {lodgings.map((l) => (
              <div key={l.id} className={`flex items-center gap-3 rounded-2xl border p-3 ${form.id === l.id ? 'border-primary' : 'border-border'} bg-card`}>
                <BedDouble className="w-5 h-5 text-muted-foreground shrink-0" />
                <button className="flex-1 text-left min-w-0" onClick={() => setForm(l)}>
                  <p className="font-semibold truncate">{l.name}</p>
                  <p className="text-xs text-muted-foreground">{md(l.checkIn)} – {md(l.checkOut)} · {l.region}{l.area ? ` · ${l.area}` : ''}{coordsOf(l)?.precise ? ' · 📍' : ''}</p>
                </button>
                <button aria-label="删除住宿" onClick={() => actions.deleteLodging(l.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 className="w-4 h-4" /></button>
              </div>
            ))}
          </div>
        )}

        <div className="space-y-3">
          <p className="text-xs font-bold text-muted-foreground">{form.id ? '编辑住宿' : '新增住宿'}</p>
          <Field label="名称"><input value={form.name} onChange={(e) => set({ name: e.target.value })} className={inputCls} placeholder="酒店 / 民宿名称" /></Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="入住"><input type="date" value={form.checkIn} min={trip.startDate} max={trip.endDate} onChange={(e) => set({ checkIn: e.target.value })} className={inputCls} /></Field>
            <Field label="退房"><input type="date" value={form.checkOut} min={form.checkIn} max={trip.endDate} onChange={(e) => set({ checkOut: e.target.value })} className={inputCls} /></Field>
          </div>
          <Field label="地区">
            <div className="flex flex-wrap gap-1.5">{trip.regions.map((r) => <Chip key={r} active={form.region === r} onClick={() => set({ region: r, area: '' })}>{r}</Chip>)}</div>
          </Field>
          <Field label="区域（用来推荐附近的收藏）">
            {areasOf(form.region).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {areasOf(form.region).map((a) => <Chip key={a} active={form.area === a} onClick={() => set({ area: a })} className="py-1 text-[11px]">{a}</Chip>)}
              </div>
            )}
            <input value={form.area} onChange={(e) => set({ area: e.target.value })} className={inputCls} placeholder="例：弘大" />
          </Field>
          <button type="button" onClick={() => setLocating(true)}
            className="w-full rounded-xl border border-border py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5">
            <MapPin className={`w-3.5 h-3.5 ${coordsOf(form)?.precise ? 'text-primary' : ''}`} />
            {coordsOf(form)?.precise ? '已标出确切位置 · 修改' : '在地图上标出住宿（推荐距离会更准）'}
          </button>
        </div>
      </div>
      <LocationSheet open={locating} onClose={() => setLocating(false)} place={{ ...form, title: form.name }} kind="hotel"
        onSave={(p) => { set(p); if (form.id) actions.upsertLodging(trip.id, { id: form.id, ...p }); }} />
    </Sheet>
  );
}
