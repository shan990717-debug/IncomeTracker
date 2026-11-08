import React, { useEffect, useRef, useState } from 'react';
import { ImagePlus, Loader2, Sparkles, Trash2, X, MapPin, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { actions } from '../lib/store';
import { readBookings } from '../lib/ai';
import { KINDS, kindOf } from '../lib/bookings';
import { hasCoords } from '../lib/geo';
import { Sheet, Field, Chip, PrimaryButton, inputCls } from './ui';
import AnchorSheet from './AnchorSheet';

const EMPTY = { kind: 'flight', title: '', number: '', ref: '', startDate: '', startTime: '', endDate: '', endTime: '', from: null, to: null, place: null, seats: '', note: '', forAll: true };
const small = `${inputCls} py-2 text-[13px]`;

/** One booking's fields; what's shown depends on the kind. */
function BookingForm({ b, onChange, onRemove, korea }) {
  const [picking, setPicking] = useState(null); // 'from' | 'to' | 'place'
  const set = (p) => onChange({ ...b, ...p });
  const k = b.kind;
  const move = k === 'flight' || k === 'train';
  const pointInput = (key, label) => (
    <div className="flex gap-1.5">
      <input value={b[key]?.name || ''} onChange={(e) => set({ [key]: { ...(b[key] || {}), name: e.target.value } })} className={small} placeholder={label} aria-label={label} />
      <button onClick={() => setPicking(key)} aria-label={`${label}位置`} className={`shrink-0 w-10 rounded-xl border flex items-center justify-center ${hasCoords(b[key]) ? 'border-primary text-primary' : 'border-border text-muted-foreground'}`}>
        <MapPin className="w-4 h-4" />
      </button>
    </div>
  );
  const dt = (dk, tk, label) => (
    <div className="grid grid-cols-[1fr_auto] gap-1.5">
      <input type="date" value={b[dk] || ''} onChange={(e) => set({ [dk]: e.target.value })} className={small} aria-label={`${label}日期`} />
      <input type="time" value={b[tk] || ''} onChange={(e) => set({ [tk]: e.target.value })} className={`${small} w-28`} aria-label={`${label}时间`} />
    </div>
  );
  return (
    <div className="rounded-2xl border border-border bg-card p-3 space-y-2.5">
      <div className="flex gap-1.5 items-center">
        {Object.entries(KINDS).map(([id, x]) => <Chip key={id} active={k === id} onClick={() => set({ kind: id })}>{x.emoji} {x.label}</Chip>)}
        {onRemove && <button onClick={onRemove} aria-label="不要这笔" className="ml-auto p-1.5 text-muted-foreground"><X className="w-4 h-4" /></button>}
      </div>
      {move ? (
        <>
          <input value={b.number} onChange={(e) => set({ number: e.target.value })} className={small} placeholder={k === 'flight' ? '航班号，例：KE 672' : '车次，例：KTX 105'} aria-label="班次" />
          <div className="grid grid-cols-2 gap-1.5">{pointInput('from', '出发地')}{pointInput('to', '目的地')}</div>
          <Field label="出发">{dt('startDate', 'startTime', '出发')}</Field>
          <Field label="抵达">{dt('endDate', 'endTime', '抵达')}</Field>
          <input value={b.seats} onChange={(e) => set({ seats: e.target.value })} className={small} placeholder={k === 'flight' ? '座位（可不填）' : '车厢座位，例：4 号车厢 12A'} aria-label="座位" />
        </>
      ) : (
        <>
          <div className="flex gap-1.5">
            <input value={b.title} onChange={(e) => set({ title: e.target.value, ...(k === 'hotel' ? { place: { ...(b.place || {}), name: e.target.value } } : {}) })}
              className={`${small} font-semibold`} placeholder={k === 'hotel' ? '酒店名称' : '名称，例：乐天世界门票'} aria-label="名称" />
            {k === 'hotel' && (
              <button onClick={() => setPicking('place')} aria-label="酒店位置" className={`shrink-0 w-10 rounded-xl border flex items-center justify-center ${hasCoords(b.place) ? 'border-primary text-primary' : 'border-border text-muted-foreground'}`}>
                <MapPin className="w-4 h-4" />
              </button>
            )}
          </div>
          {k === 'hotel' && <p className={`text-[11px] ${hasCoords(b.place) ? 'text-primary' : 'text-amber-600'}`}>{hasCoords(b.place) ? `📍 ${b.place.address || '已找到位置'}` : '还没有位置：按 📍 搜酒店，行程才能从酒店出发'}</p>}
          <Field label={k === 'hotel' ? '入住' : '日期'}>{dt('startDate', 'startTime', k === 'hotel' ? '入住' : '日期')}</Field>
          {k === 'hotel' && <Field label="退房">{dt('endDate', 'endTime', '退房')}</Field>}
          {k === 'hotel' && <input value={b.seats} onChange={(e) => set({ seats: e.target.value })} className={small} placeholder="房型（可不填）" aria-label="房型" />}
        </>
      )}
      <input value={b.ref} onChange={(e) => set({ ref: e.target.value })} className={small} placeholder="订单号 / 确认号" aria-label="订单号" />
      <input value={b.note} onChange={(e) => set({ note: e.target.value })} className={small} placeholder="备注：行李、早餐、取消期限…" aria-label="备注" />
      <div className="grid grid-cols-2 gap-1.5 rounded-xl bg-muted p-1 text-xs font-bold">
        {[[true, '👥 全员'], [false, '🙋 只有我']].map(([v, label]) => (
          <button key={label} onClick={() => set({ forAll: v })} className={`rounded-lg py-1.5 ${b.forAll === v ? 'bg-card shadow text-foreground' : 'text-muted-foreground'}`}>{label}</button>
        ))}
      </div>
      <AnchorSheet open={!!picking} onClose={() => setPicking(null)} korea={korea} title={picking === 'place' ? '酒店在哪里？' : '车站 / 机场在哪里？'} meHint="用现在的位置"
        onPick={(p) => {
          const pt = { name: p.name, address: p.address || '', lat: p.lat, lng: p.lng };
          if (picking === 'place') set({ place: { ...pt, name: b.title || p.name }, title: b.title || p.name });
          else set({ [picking]: { ...(b[picking] || {}), ...pt, name: b[picking]?.name || p.name } });
        }} />
    </div>
  );
}

/** Add bookings (paste / screenshot → AI, or by hand), or edit one. */
export default function BookingSheet({ open, onClose, trip, booking }) {
  const [text, setText] = useState('');
  const [images, setImages] = useState([]);
  const [drafts, setDrafts] = useState([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);
  const korea = trip.regions.some((r) => /首尔|釜山|济州|庆州|江陵|韩国/.test(r));
  useEffect(() => {
    if (!open) return;
    setText(''); setImages([]); setBusy(false);
    setDrafts(booking ? [{ ...EMPTY, ...booking }] : []);
  }, [open, booking?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!open) return <Sheet open={false} onClose={onClose} />;

  const read = async () => {
    setBusy(true);
    try {
      const list = await readBookings({ text, images: images.map((i) => i.file), regions: trip.regions, year: (trip.startDate || '').slice(0, 4) || undefined });
      if (!list.length) toast('没读到订单，可以手动填');
      setDrafts((d) => [...d, ...list.map((b) => ({ ...EMPTY, ...b }))]);
    } catch (e) { toast.error(e.message || 'AI 暂时连不上'); }
    setBusy(false);
  };
  const save = () => {
    const ok = drafts.filter((d) => d.title || d.number || d.from?.name || d.to?.name || d.place?.name);
    if (booking) actions.updateBooking(booking.id, ok[0] || drafts[0]);
    else if (ok.length) { actions.addBookings(trip.id, ok); toast.success(`存了 ${ok.length} 笔订单`); }
    onClose();
  };

  return (
    <Sheet open onClose={onClose} title={booking ? '订单' : '加订单'}
      footer={
        <div className="space-y-2">
          <PrimaryButton onClick={save} disabled={!drafts.length}>{booking ? '存好' : drafts.length ? `存进订单（${drafts.length}）` : '先贴确认信或手动填'}</PrimaryButton>
          {booking && (
            <button onClick={() => { if (window.confirm('删除这笔订单？')) { actions.deleteBooking(booking.id); onClose(); } }}
              className="w-full py-2 text-sm font-semibold text-muted-foreground hover:text-destructive flex items-center justify-center gap-1.5">
              <Trash2 className="w-4 h-4" /> 删除
            </button>
          )}
        </div>
      }>
      <div className="space-y-3 pb-2">
        {!booking && (
          <>
            <div className="relative">
              <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className={`${inputCls} resize-none pr-12`}
                placeholder={'贴订单确认信的内容（Agoda、Booking、Trip.com、航空公司、Korail…）\n一次贴好几张也可以'} />
              <button onClick={() => fileRef.current?.click()} aria-label="加订单截图" className="absolute right-2 top-2 w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
                <ImagePlus className="w-4 h-4" />
              </button>
              <input ref={fileRef} type="file" accept="image/*" multiple className="hidden"
                onChange={(e) => { const f = [...(e.target.files || [])].slice(0, 4 - images.length).map((file) => ({ file, url: URL.createObjectURL(file) })); setImages((x) => [...x, ...f]); e.target.value = ''; }} />
            </div>
            {images.length > 0 && (
              <div className="flex gap-2">
                {images.map((img, i) => (
                  <div key={img.url} className="relative">
                    <img src={img.url} alt="订单截图" className="w-14 h-20 rounded-lg object-cover border border-border" />
                    <button onClick={() => setImages((x) => x.filter((_, j) => j !== i))} aria-label="移除截图" className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-foreground text-background flex items-center justify-center"><X className="w-3 h-3" /></button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={read} disabled={busy || (!text.trim() && !images.length)}
                className="flex-1 rounded-xl bg-violet-600 text-white py-2.5 text-sm font-bold flex items-center justify-center gap-1.5 disabled:opacity-40">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}{busy ? 'AI 正在读…' : 'AI 读订单'}
              </button>
              <button onClick={() => setDrafts((d) => [...d, { ...EMPTY }])} className="rounded-xl border border-border px-3 text-sm font-bold flex items-center gap-1">
                <Plus className="w-4 h-4" />手动填
              </button>
            </div>
          </>
        )}
        {drafts.map((d, i) => (
          <BookingForm key={i} b={d} korea={korea}
            onChange={(nb) => setDrafts((x) => x.map((y, j) => (j === i ? nb : y)))}
            onRemove={booking ? null : () => setDrafts((x) => x.filter((_, j) => j !== i))} />
        ))}
        {!booking && drafts.length > 0 && <p className="text-[11px] text-muted-foreground text-center">{kindOf('hotel').emoji} 酒店会自动当住那几天的出发点；{kindOf('train').emoji} 车票会排进当天行程</p>}
      </div>
    </Sheet>
  );
}
