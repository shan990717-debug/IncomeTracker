import React, { useEffect, useState } from 'react';
import { Trash2, ExternalLink, Check } from 'lucide-react';
import { actions, memberName } from '../lib/store';
import { TIP_TYPES, isDone, whenLabel, me } from '../lib/tips';
import { todayISO } from '../lib/dates';
import { Sheet, Chip, Field, PrimaryButton, inputCls } from './ui';

/** One 须知: key points, when to do it, where it came from, tick for me. Also used to add one by hand. */
export default function TipSheet({ tip, onClose, trip, state }) {
  const [d, setD] = useState(tip);
  useEffect(() => setD(tip), [tip?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!tip || !d) return <Sheet open={false} onClose={onClose} />;

  const isNew = !tip.id;
  const live = state.tips.find((t) => t.id === tip.id) || d; // ticks come from the store
  const set = (p) => setD((x) => ({ ...x, ...p }));
  const save = () => {
    if (!d.title?.trim()) { onClose(); return; } // closing an empty new tip just cancels
    // doneBy is left out: ticks only change through toggleTip, never by saving this form.
    const { doneBy, ...rest } = d; // eslint-disable-line no-unused-vars
    const clean = { ...rest, title: d.title.trim(), points: (d.points || []).map((p) => p.trim()).filter(Boolean) };
    if (isNew) actions.addTips(trip.id, [{ ...clean, doneBy: [] }]);
    else actions.updateTip(tip.id, clean);
    onClose();
  };
  const when = whenLabel(d, trip, todayISO());
  const members = state.members.filter((m) => m.tripId === trip.id);
  const done = isDone(live, state);

  return (
    <Sheet open onClose={save} title={isNew ? '新增须知' : '须知详情'}
      footer={
        <div className="flex gap-2">
          {!isNew && (
            <button aria-label="删除" onClick={() => { if (window.confirm('删除这条须知？')) { actions.deleteTip(tip.id); onClose(); } }}
              className="w-12 shrink-0 rounded-xl border border-border text-muted-foreground hover:text-destructive flex items-center justify-center">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          {!isNew && d.isAction ? (
            <PrimaryButton onClick={() => actions.toggleTip(live)} className={done ? 'bg-muted text-foreground' : ''}>
              {done ? '取消完成' : '✓ 标记完成'}{d.personal ? '（我）' : ''}
            </PrimaryButton>
          ) : (
            <PrimaryButton disabled={!d.title?.trim()} onClick={save}>{isNew ? '加入' : '完成'}</PrimaryButton>
          )}
        </div>
      }>
      <div className="space-y-4">
        <textarea rows={2} value={d.title} onChange={(e) => set({ title: e.target.value })} autoFocus={isNew}
          className={`${inputCls} font-bold text-base resize-none`} placeholder="例：KTX 首尔→釜山 提前一个月订" />

        <div className="flex flex-wrap gap-1.5">
          {TIP_TYPES.map((t) => <Chip key={t.id} active={d.type === t.id} onClick={() => set({ type: t.id })} className="py-1 text-[11px]">{t.emoji} {t.label}</Chip>)}
        </div>

        <Field label="重点（一行一个）">
          <textarea rows={4} value={(d.points || []).join('\n')} onChange={(e) => set({ points: e.target.value.split('\n') })}
            className={`${inputCls} resize-none text-sm leading-relaxed`} placeholder={'在哪里订\n价格\n要注意什么'} />
        </Field>

        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => set({ isAction: !d.isAction })}
            className={`rounded-xl border py-2.5 text-xs font-bold ${d.isAction ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
            {d.isAction ? '☑️ 要做的事' : '💡 只是知识'}
          </button>
          <button onClick={() => set({ personal: !d.personal })} disabled={!d.isAction}
            className={`rounded-xl border py-2.5 text-xs font-bold disabled:opacity-40 ${d.personal ? 'border-primary bg-primary/10 text-primary' : 'border-border text-muted-foreground'}`}>
            {d.personal ? '👤 每人各自做' : '👥 一人帮大家做'}
          </button>
        </div>

        {d.isAction && (
          <Field label="建议什么时候做">
            <div className="flex items-center gap-2 text-sm">
              出发前
              <input type="number" min={0} max={120} value={Number.isFinite(d.offsetDays) ? -d.offsetDays : ''}
                onChange={(e) => set({ offsetDays: e.target.value === '' ? null : -Math.abs(Number(e.target.value)), offsetFromPost: false })}
                className={`${inputCls} w-20 py-1.5 text-center`} />
              天
              <span className={`ml-auto text-[11px] font-semibold rounded-full px-2 py-0.5 ${d.offsetFromPost ? 'bg-primary/10 text-primary' : 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300'}`}>
                {d.offsetFromPost ? '贴文写的' : 'AI 建议'}
              </span>
            </div>
            {when && <p className={`text-xs font-semibold mt-1 ${when.late ? 'text-destructive' : 'text-primary'}`}>{when.text}</p>}
          </Field>
        )}

        {!isNew && d.isAction && d.personal && members.length > 1 && (
          <Field label={`谁做好了（${live.doneBy.length}/${members.length}）`}>
            <div className="flex flex-wrap gap-1.5">
              {members.map((m) => {
                const ok = live.doneBy.includes(m.userId);
                return (
                  <span key={m.userId} className={`rounded-full px-3 py-1 text-xs font-semibold flex items-center gap-1 ${ok ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                    {ok && <Check className="w-3 h-3" />}{memberName(state, trip.id, m.userId) || '旅伴'}{m.userId === me(state) ? '（我）' : ''}
                  </span>
                );
              })}
            </div>
          </Field>
        )}

        <Field label="适用城市（不选 = 整个国家）">
          <div className="flex flex-wrap gap-1.5">
            {[...new Set([...trip.regions, ...(d.cities || [])])].map((c) => {
              const on = (d.cities || []).includes(c);
              return <Chip key={c} active={on} onClick={() => set({ cities: on ? d.cities.filter((x) => x !== c) : [...(d.cities || []), c] })}>{c}</Chip>;
            })}
          </div>
          {(d.nationalities || []).length > 0 && <p className="text-[11px] text-muted-foreground mt-1.5">只适用护照：{d.nationalities.join('、')}</p>}
        </Field>

        {(d.sources || []).length > 0 && (
          <Field label="来源">
            <div className="space-y-1.5">
              {d.sources.map((s) => (
                <a key={s.url} href={s.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-xs">
                  <span className="flex-1 truncate">{s.platform === '小红书' ? '📕' : s.platform === 'Instagram' ? '📸' : '🔗'} {s.title || s.url}</span>
                  <span className="text-primary font-bold shrink-0 flex items-center gap-1">看原帖 <ExternalLink className="w-3 h-3" /></span>
                </a>
              ))}
            </div>
          </Field>
        )}
        <p className="text-[11px] text-muted-foreground">入境、签证规定会变，以官网为准。</p>
      </div>
    </Sheet>
  );
}
