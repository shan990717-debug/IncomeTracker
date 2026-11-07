import React, { useEffect, useState } from 'react';
import { ExternalLink, Trash2, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { actions, STATUSES } from '../lib/store';
import { reanalyzeSave } from '../lib/reanalyze';
import { CATEGORIES } from '../lib/parse';
import { UNSORTED, areasOf } from '../lib/regions';
import { tripDates, md, weekday } from '../lib/dates';
import { Sheet, Chip, Field, Stars, inputCls } from './ui';
import MapLinks from './MapLinks';

export default function SaveSheet({ save, onClose, trip }) {
  const [draft, setDraft] = useState(save);
  const [aiBusy, setAiBusy] = useState(false);
  // Reset only when another save opens; refresh after AI rewrites this one.
  useEffect(() => { setDraft(save); }, [save?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!aiBusy && save) setDraft(save); }, [aiBusy]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!save || !draft) return <Sheet open={false} onClose={onClose} />;

  const set = (p) => setDraft((d) => ({ ...d, ...p }));
  const commit = (p) => { set(p); actions.updateSave(save.id, p); };
  // Opening and closing a ⚠️ card counts as having checked it.
  const close = () => { actions.updateSave(save.id, { ...draft, unsure: false }); onClose(); };

  const runAi = async () => {
    actions.updateSave(save.id, draft);
    setAiBusy(true);
    try {
      const r = await reanalyzeSave({ ...save, ...draft }, trip);
      if (!r.places && !r.tasks) toast('AI 没找到更具体的内容，保持原样');
      else toast.success([r.places && (r.places > 1 ? `识别出 ${r.places} 个地点` : '已更新名称和分类'), r.tasks && `出发准备 +${r.tasks}`].filter(Boolean).join(' · '));
    } catch {
      toast.error('AI 暂时连不上，稍后再试');
    } finally {
      setAiBusy(false);
    }
  };

  return (
    <Sheet open onClose={close} title="攻略详情"
      footer={
        <button onClick={() => { if (window.confirm('删除这条攻略？')) { actions.deleteSave(save.id); onClose(); } }}
          className="w-full rounded-xl border border-border py-2.5 text-sm font-semibold text-muted-foreground hover:text-destructive flex items-center justify-center gap-1.5">
          <Trash2 className="w-4 h-4" /> 删除
        </button>
      }>
      <div className="space-y-4">
        <div>
          <input value={draft.title} onChange={(e) => set({ title: e.target.value })} className={`${inputCls} font-bold text-base`} aria-label="名称" />
          {draft.nameLocal && <p className="mt-1 px-1 text-xs text-muted-foreground">{draft.nameLocal}</p>}
          {draft.ai && (draft.note || draft.address) && (
            <p className="mt-2 text-xs text-violet-700 dark:text-violet-300 leading-snug"><b>✨</b> {[draft.note, draft.address].filter(Boolean).join(' · ')}</p>
          )}
        </div>

        {/* Status: the whole point of the 攻略库 is deciding what goes into the trip. */}
        <div className="grid grid-cols-3 gap-1.5 rounded-2xl bg-muted p-1">
          {STATUSES.map((s) => (
            <button key={s.id} onClick={() => commit({ status: s.id })}
              className={`rounded-xl py-2 text-sm font-bold transition ${draft.status === s.id ? 'bg-card shadow text-foreground' : 'text-muted-foreground'}`}>
              {s.label}
            </button>
          ))}
        </div>
        {draft.status === 'going' && (
          <Field label="打算哪天去（可不填）">
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
              <Chip active={!draft.day} onClick={() => commit({ day: '' })}>还没定</Chip>
              {tripDates(trip).map((d, i) => (
                <Chip key={d} active={draft.day === d} onClick={() => commit({ day: d })}>D{i + 1} {md(d)} {weekday(d)}</Chip>
              ))}
            </div>
          </Field>
        )}
        {draft.status === 'done' && (
          <div className="rounded-2xl border border-border p-3 space-y-2">
            <Stars value={draft.rating} onChange={(n) => commit({ rating: n })} size="w-7 h-7" />
            <input value={draft.review || ''} onChange={(e) => set({ review: e.target.value })} className={inputCls} placeholder="一句话评价：值得排队吗？" />
          </div>
        )}

        <div className="space-y-2">
          <MapLinks place={draft} />
          {draft.url && (
            <a href={draft.url} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-xl border border-border py-2 text-xs font-bold">
              <ExternalLink className="w-3.5 h-3.5" /> 看原帖{draft.platform ? `（${draft.platform}）` : ''}
            </a>
          )}
        </div>

        <Field label="城市">
          <div className="flex flex-wrap gap-1.5">
            {[...new Set([...trip.regions, UNSORTED, draft.region])].map((r) => <Chip key={r} active={draft.region === r} onClick={() => set({ region: r, area: '' })}>{r}</Chip>)}
          </div>
        </Field>
        <Field label="商圈">
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
        <Field label="笔记">
          <textarea rows={3} value={draft.note || ''} onChange={(e) => set({ note: e.target.value })} className={`${inputCls} resize-none`} placeholder="推荐菜、营业时间、要不要预约…" />
        </Field>

        <button onClick={runAi} disabled={aiBusy}
          className="w-full rounded-xl border border-violet-300/70 dark:border-violet-500/40 text-violet-700 dark:text-violet-300 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60">
          {aiBusy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {aiBusy ? 'AI 正在重新看这则内容…' : '用 AI 重新识别'}
        </button>
      </div>
    </Sheet>
  );
}
