import React, { useEffect, useState } from 'react';
import { ExternalLink, Trash2, Sparkles, Loader2, MapPin, Copy, Search } from 'lucide-react';
import { toast } from 'sonner';
import { actions } from '../lib/store';
import { reanalyzeSave } from '../lib/reanalyze';
import { locatePlace } from '../lib/ai';
import { CATEGORIES, SUBTYPES } from '../lib/parse';
import { UNSORTED, areasOf } from '../lib/regions';
import { hasCoords, km, fmtKm } from '../lib/geo';
import { Sheet, Chip, Field, inputCls } from './ui';
import MapLinks from './MapLinks';

const GEO_LABEL = { kakao: 'Kakao 地图找到的位置', osm: 'OpenStreetMap 找到的位置', manual: '确切位置' };

export default function SaveSheet({ save, onClose, trip, anchor }) {
  const [draft, setDraft] = useState(save);
  const [busy, setBusy] = useState('');
  const [query, setQuery] = useState('');
  // Reset only when another save opens; refresh after AI/lookup rewrites this one.
  useEffect(() => { setDraft(save); setQuery(''); }, [save?.id]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (!busy && save) setDraft(save); }, [busy]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!save || !draft) return <Sheet open={false} onClose={onClose} />;

  const set = (p) => setDraft((d) => ({ ...d, ...p }));
  // Opening and closing a ⚠️ card counts as having checked it.
  const close = () => { actions.updateSave(save.id, { ...draft, unsure: false }); onClose(); };

  const runAi = async () => {
    actions.updateSave(save.id, draft);
    setBusy('ai');
    try {
      const n = await reanalyzeSave({ ...save, ...draft }, trip);
      if (!n) toast('AI 没认出更具体的店名，保持原样');
      else toast.success(n > 1 ? `认出 ${n} 个地方，多的已另外存好` : '已更新');
    } catch (e) { toast.error(e.message || 'AI 暂时连不上'); }
    setBusy('');
  };

  const relocate = async () => {
    actions.updateSave(save.id, draft);
    setBusy('loc');
    try {
      const p = await locatePlace({ ...save, ...draft }, query.trim());
      if (!p) { toast('还是找不到，试试输入韩文店名或地址'); }
      else {
        actions.updateSave(save.id, { lat: p.lat, lng: p.lng, geo: p.source, address: p.address || draft.address, placeUrl: p.placeUrl || '' });
        toast.success(`找到了：${p.matchedName || p.address}`);
      }
    } catch (e) { toast.error(e.message); }
    setBusy('');
  };

  const dist = anchor ? km(anchor, draft) : null;
  const subs = SUBTYPES[draft.category] || [];

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
          <input value={draft.nameLocal || ''} onChange={(e) => set({ nameLocal: e.target.value })}
            className="mt-1.5 w-full bg-transparent px-1 text-sm text-muted-foreground outline-none" placeholder="当地名称（韩文店名，地图搜索用）" />
          {draft.note && <p className="mt-2 text-xs text-violet-700 dark:text-violet-300 leading-snug"><b>✨</b> {draft.note}</p>}
        </div>

        {/* Decide whether to go: reviews, map, the original post */}
        <MapLinks place={draft} />
        {draft.url && (
          <a href={draft.url} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-2 rounded-xl bg-primary/10 text-primary py-2.5 text-sm font-bold">
            <ExternalLink className="w-4 h-4" /> 看原贴文{draft.platform ? `（${draft.platform}）` : ''}
          </a>
        )}

        {/* Location */}
        <div className="rounded-2xl border border-border bg-card p-3 space-y-2">
          <div className="flex items-start gap-2">
            <MapPin className={`w-4 h-4 mt-0.5 shrink-0 ${hasCoords(draft) ? 'text-primary' : 'text-muted-foreground'}`} />
            <div className="flex-1 min-w-0 text-xs">
              <p className="font-bold">{hasCoords(draft) ? GEO_LABEL[draft.geo] || '已有位置' : '还没有位置'}{dist != null && <span className="text-primary"> · 距离 {anchor.name} {fmtKm(dist)}</span>}</p>
              {draft.address && <p className="text-muted-foreground mt-0.5 break-words">{draft.address}</p>}
            </div>
            {draft.address && (
              <button aria-label="复制地址" onClick={() => navigator.clipboard?.writeText(draft.address).then(() => toast.success('地址已复制'))} className="p-1 text-muted-foreground">
                <Copy className="w-4 h-4" />
              </button>
            )}
          </div>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); relocate(); }}>
            <input value={query} onChange={(e) => setQuery(e.target.value)} className={`${inputCls} py-2 text-xs`}
              placeholder={hasCoords(draft) ? '位置不对？输入店名或地址重新找' : '输入韩文店名或地址来找位置'} />
            <button type="submit" disabled={busy === 'loc'} aria-label="找位置"
              className="shrink-0 w-11 rounded-xl border border-border flex items-center justify-center">
              {busy === 'loc' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </button>
          </form>
        </div>

        <Field label="分类">
          <div className="grid grid-cols-4 gap-1.5">
            {CATEGORIES.map((c) => (
              <button key={c.id} onClick={() => set({ category: c.id, subtype: '' })}
                className={`rounded-xl py-2 text-xs font-semibold border ${draft.category === c.id ? `${c.color} border-transparent` : 'border-border text-muted-foreground'}`}>
                {c.emoji} {c.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-1.5 mt-2">
            {subs.map((s) => <Chip key={s} active={draft.subtype === s} onClick={() => set({ subtype: s })} className="py-1 text-[11px]">{s}</Chip>)}
          </div>
        </Field>

        <Field label="城市 · 商圈">
          <div className="flex flex-wrap gap-1.5">
            {[...new Set([...trip.regions, draft.region || UNSORTED])].map((r) => <Chip key={r} active={draft.region === r} onClick={() => set({ region: r, area: '' })}>{r}</Chip>)}
          </div>
          {areasOf(draft.region).length > 0 && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {areasOf(draft.region).map((a) => <Chip key={a} active={draft.area === a} onClick={() => set({ area: draft.area === a ? '' : a })} className="py-1 text-[11px]">{a}</Chip>)}
            </div>
          )}
          <input value={draft.area || ''} onChange={(e) => set({ area: e.target.value })} className={`${inputCls} mt-2`} placeholder="商圈，例：望远洞" />
        </Field>

        <Field label="笔记">
          <textarea rows={2} value={draft.note || ''} onChange={(e) => set({ note: e.target.value })} className={`${inputCls} resize-none`} placeholder="推荐菜、营业时间、要不要预约…" />
        </Field>

        <button onClick={runAi} disabled={busy === 'ai'}
          className="w-full rounded-xl border border-violet-300/70 dark:border-violet-500/40 text-violet-700 dark:text-violet-300 py-2.5 text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-60">
          {busy === 'ai' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {busy === 'ai' ? 'AI 正在重新看这则贴文…' : '用 AI 重新识别'}
        </button>
      </div>
    </Sheet>
  );
}
