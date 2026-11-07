import React, { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Heart, Trash2, CalendarPlus, Sparkles, Loader2, MapPin } from 'lucide-react';
import { coordsOf } from '../lib/geo';
import MapLinks from './MapLinks';
import LocationSheet from './LocationSheet';
import { reanalyzeSave } from '../lib/reanalyze';
import { toast } from 'sonner';
import { actions, lodgingFor, ofTrip } from '../lib/store';
import { CATEGORIES } from '../lib/parse';
import { UNSORTED, areasOf } from '../lib/regions';
import { tripDates, md, weekday } from '../lib/dates';
import { Sheet, Chip, Field, Stars, PrimaryButton, inputCls } from './ui';

const DEFAULT_TIME = { food: '12:30', place: '10:00', experience: '14:30', shopping: '16:00' };

/** Pick a day + time for a save. Days where you sleep in the save's region come first. */
export function SchedulePicker({ state, trip, save, onDone }) {
  const lodgings = ofTrip(state.lodgings, trip);
  const days = tripDates(trip).map((d) => ({ date: d, region: lodgingFor(lodgings, d)?.region || '' }));
  const firstMatch = days.find((d) => d.region === save.region)?.date || days[0]?.date;
  const [date, setDate] = useState(firstMatch);
  const [time, setTime] = useState(DEFAULT_TIME[save.category] || '10:00');

  const add = () => {
    actions.addItem(trip.id, { date, time, title: save.title, kind: save.category, saveId: save.id, region: save.region, area: save.area });
    toast.success(`已排进 ${md(date)} ${time}`);
    onDone();
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1 pb-1">
        {days.map((d, i) => (
          <button key={d.date} onClick={() => setDate(d.date)}
            className={`shrink-0 rounded-xl border px-2.5 py-1.5 text-center min-w-[58px] ${date === d.date ? 'bg-foreground text-background border-foreground' : 'bg-card border-border'} ${d.region && d.region !== save.region && date !== d.date ? 'opacity-50' : ''}`}>
            <div className="text-[10px] font-semibold">D{i + 1} {weekday(d.date)}</div>
            <div className="text-sm font-bold">{md(d.date)}</div>
            <div className="text-[10px] truncate">{d.region || '—'}</div>
          </button>
        ))}
      </div>
      {save.region !== UNSORTED && !days.some((d) => d.region === save.region) && (
        <p className="text-[11px] text-amber-600">还没有住在{save.region}的晚上，可以先到「行程」填住宿。</p>
      )}
      <div className="flex gap-2">
        <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} aria-label="时间" />
        <PrimaryButton className="w-auto px-6 shrink-0" onClick={add}>排进去</PrimaryButton>
      </div>
    </div>
  );
}

export default function SaveSheet({ save, onClose, state, trip }) {
  const [draft, setDraft] = useState(save);
  const [scheduling, setScheduling] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  // Only reset when a different save is opened, so AI updates show up live.
  useEffect(() => { setDraft(save); setScheduling(false); }, [save?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!aiBusy && save) setDraft(save); }, [aiBusy]); // eslint-disable-line react-hooks/exhaustive-deps

  const scheduled = useMemo(() => (save ? state.items.filter((i) => i.saveId === save.id) : []), [state.items, save]);
  if (!save || !draft) return <Sheet open={false} onClose={onClose} />;

  const set = (p) => setDraft((d) => ({ ...d, ...p }));
  const commit = (p) => { set(p); actions.updateSave(save.id, p); };
  const close = () => { actions.updateSave(save.id, draft); onClose(); };

  const runAi = async () => {
    actions.updateSave(save.id, draft); // don't lose unsaved typing
    setAiBusy(true);
    try {
      const n = await reanalyzeSave({ ...save, ...draft }, trip);
      if (!n) toast('AI 没找到更具体的店名，保持原样');
      else toast.success(n > 1 ? `识别出 ${n} 个地方，多出来的已另存为收藏` : 'AI 已更新名称、地区和分类');
    } catch {
      toast.error('AI 暂时连不上，稍后再试');
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <Sheet open={!!save} onClose={close} title="收藏详情"
      footer={!scheduling && (
        <div className="flex gap-2">
          <button aria-label="删除" onClick={() => { if (window.confirm('删除这条收藏？')) { actions.deleteSave(save.id); onClose(); } }}
            className="w-12 shrink-0 rounded-xl border border-border text-muted-foreground hover:text-destructive flex items-center justify-center">
            <Trash2 className="w-4 h-4" />
          </button>
          <PrimaryButton onClick={() => setScheduling(true)} className="flex items-center justify-center gap-2">
            <CalendarPlus className="w-4 h-4" /> 安排进行程
          </PrimaryButton>
        </div>
      )}>
      {scheduling ? (
        <SchedulePicker state={state} trip={trip} save={draft} onDone={() => { actions.updateSave(save.id, draft); setScheduling(false); }} />
      ) : (
        <div className="space-y-4">
          <div className="flex gap-2 items-start">
            <input value={draft.title} onChange={(e) => set({ title: e.target.value })} className={`${inputCls} font-bold text-base`} aria-label="名称" />
            <button aria-label="想去指数" onClick={() => commit({ starred: !draft.starred })}
              className={`shrink-0 w-11 h-11 rounded-xl border flex items-center justify-center ${draft.starred ? 'border-rose-300 bg-rose-50 text-rose-500 dark:bg-rose-500/10' : 'border-border text-muted-foreground'}`}>
              <Heart className={`w-5 h-5 ${draft.starred ? 'fill-current' : ''}`} />
            </button>
          </div>

          {draft.nameLocal && <p className="-mt-2 px-1 text-xs text-muted-foreground">{draft.nameLocal}</p>}
          {draft.ai && (draft.note || draft.address) && (
            <p className="text-xs text-violet-700 dark:text-violet-300 leading-snug"><b>✨ AI</b>：{[draft.note, draft.address].filter(Boolean).join(' · ')}</p>
          )}

          <button onClick={runAi} disabled={aiBusy}
            className="w-full rounded-xl border border-violet-300/70 dark:border-violet-500/40 text-violet-700 dark:text-violet-300 py-2 text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60">
            {aiBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            {aiBusy ? 'AI 正在重新看这则内容…' : draft.ai ? '用 AI 重新识别' : '用 AI 识别店名、地区、分类'}
          </button>

          {draft.url && (
            <a href={draft.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 text-sm text-primary font-semibold">
              <ExternalLink className="w-4 h-4" /> 打开原视频{draft.platform ? `（${draft.platform}）` : ''}
            </a>
          )}

          <div className="rounded-2xl border border-border p-3 space-y-2.5">
            <div className="flex items-center gap-2">
              <MapPin className={`w-4 h-4 shrink-0 ${coordsOf(draft)?.precise ? 'text-primary' : 'text-muted-foreground'}`} />
              <p className="flex-1 text-xs">
                {coordsOf(draft)?.precise
                  ? <><b>已有确切位置</b>{draft.geo === 'ai' ? '（AI 找到的）' : draft.geo === 'manual' ? '（你设置的）' : ''}</>
                  : coordsOf(draft) ? <><b>大概位置</b>：只知道在{draft.area}</> : <b>还没有位置</b>}
                {draft.address ? <span className="block text-muted-foreground mt-0.5">{draft.address}</span> : null}
              </p>
              <button onClick={() => setLocating(true)} className="shrink-0 text-xs font-semibold text-primary">在地图上设置</button>
            </div>
            <MapLinks place={draft} />
          </div>

          {scheduled.length > 0 && (
            <div className="rounded-xl bg-primary/10 text-primary text-xs font-semibold px-3 py-2">
              已安排：{scheduled.map((i) => `${md(i.date)} ${i.time}`).join('、')}
            </div>
          )}

          <Field label="地区">
            <div className="flex flex-wrap gap-1.5">
              {[...new Set([...trip.regions, UNSORTED, draft.region])].map((r) => <Chip key={r} active={draft.region === r} onClick={() => set({ region: r, area: '' })}>{r}</Chip>)}
            </div>
          </Field>
          <Field label="区域 / 商圈">
            {areasOf(draft.region).length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {areasOf(draft.region).map((a) => <Chip key={a} active={draft.area === a} onClick={() => set({ area: draft.area === a ? '' : a })} className="py-1 text-[11px]">{a}</Chip>)}
              </div>
            )}
            <input value={draft.area || ''} onChange={(e) => set({ area: e.target.value })} className={inputCls} placeholder="或自己输入，例：望远洞" />
          </Field>
          <Field label="分类">
            <div className="grid grid-cols-4 gap-1.5">
              {CATEGORIES.map((c) => (
                <button key={c.id} onClick={() => set({ category: c.id })}
                  className={`rounded-xl py-2 text-xs font-semibold border ${draft.category === c.id ? `${c.color} border-transparent` : 'border-border text-muted-foreground'}`}>
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
          </Field>
          <Field label="笔记 / 推荐菜 / 地址">
            <textarea rows={3} value={draft.note || ''} onChange={(e) => set({ note: e.target.value })} className={`${inputCls} resize-none`} />
          </Field>

          <div className="rounded-2xl border border-border p-3 space-y-2">
            <label className="flex items-center justify-between">
              <span className="text-sm font-semibold">{draft.category === 'food' ? '吃到了' : '去过了'}</span>
              <input type="checkbox" checked={!!draft.done} onChange={(e) => commit({ done: e.target.checked })} className="w-5 h-5 accent-[hsl(var(--primary))]" />
            </label>
            {draft.done && (
              <>
                <Stars value={draft.rating} onChange={(n) => commit({ rating: n })} size="w-6 h-6" />
                <input value={draft.review || ''} onChange={(e) => set({ review: e.target.value })} className={inputCls} placeholder="一句话评价：值得排队吗？" />
              </>
            )}
          </div>
        </div>
      )}
      <LocationSheet open={locating} onClose={() => setLocating(false)} place={draft}
        onSave={(p) => { setDraft((d) => ({ ...d, ...p })); actions.updateSave(save.id, p); }} />
    </Sheet>
  );
}
