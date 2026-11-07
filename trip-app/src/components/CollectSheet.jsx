import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardPaste, ImagePlus, Trash2, Sparkles, Loader2, X, Check } from 'lucide-react';
import { toast } from 'sonner';
import { actions } from '../lib/store';
import { parseMany, CATEGORIES } from '../lib/parse';
import { aiExtract } from '../lib/ai';
import { TASK_GROUPS, dueFromOffset } from '../lib/prep';
import { UNSORTED, areasOf } from '../lib/regions';
import { md } from '../lib/dates';
import { Sheet, Chip, PrimaryButton, inputCls } from './ui';

const AI_KEY = 'trip_ai_enabled';
const readAiPref = () => { try { return localStorage.getItem(AI_KEY) !== '0'; } catch { return true; } };

/**
 * One entry point for everything found on IG / 小红书:
 *   paste link + caption (one or many), and/or add screenshots.
 * Instant keyword guess first; AI then splits the post into places (攻略库)
 * and prep tasks (出发准备). Cards the user already edited are left alone.
 */
export default function CollectSheet({ open, onClose, trip, initialText = '' }) {
  const [text, setText] = useState('');
  const [images, setImages] = useState([]); // { id, file, url }
  const [aiOn, setAiOn] = useState(readAiPref);
  const [ai, setAi] = useState({}); // job key → { status, places, tasks }
  const [edits, setEdits] = useState({});
  const [removed, setRemoved] = useState(() => new Set());
  const [skipTasks, setSkipTasks] = useState(() => new Set());
  const fileRef = useRef(null);
  const regions = [...trip.regions, UNSORTED];

  useEffect(() => {
    if (!open) return;
    setText(initialText); setAi({}); setEdits({}); setRemoved(new Set()); setSkipTasks(new Set());
    setImages((imgs) => { imgs.forEach((i) => URL.revokeObjectURL(i.url)); return []; });
  }, [open]);

  const chunks = useMemo(() => parseMany(text, trip.regions), [text, trip.regions]);

  // Screenshots belong to the pasted post, so with images it's one combined job.
  const jobs = useMemo(() => {
    if (images.length) {
      const key = `img:${images.map((i) => i.id).join(',')}|${text}`;
      return [{ key, text, url: chunks[0]?.url || '', images: images.map((i) => i.file), kw: chunks.length === 1 ? [chunks[0]] : [] }];
    }
    return chunks.map((c) => ({ key: c.raw, text: c.raw, url: c.url, images: [], kw: [c] }));
  }, [chunks, images, text]);

  useEffect(() => {
    if (!aiOn || !jobs.length) return;
    const t = setTimeout(() => {
      for (const j of jobs) {
        if (ai[j.key]) continue;
        setAi((m) => ({ ...m, [j.key]: { status: 'loading', places: [], tasks: [] } }));
        aiExtract({ text: j.text, url: j.url, images: j.images, tripRegions: trip.regions })
          .then((r) => setAi((m) => ({ ...m, [j.key]: { status: 'done', ...r } })))
          .catch(() => setAi((m) => ({ ...m, [j.key]: { status: 'failed', places: [], tasks: [] } })));
      }
    }, 800);
    return () => clearTimeout(t);
  }, [jobs, aiOn]); // eslint-disable-line react-hooks/exhaustive-deps

  const { cards, tasks, loading } = useMemo(() => {
    const cards = [];
    const tasks = [];
    let loading = false;
    for (const j of jobs) {
      const a = aiOn ? ai[j.key] : null;
      if (a?.status === 'loading') loading = true;
      const touchedKw = Object.keys(edits).some((k) => k.startsWith(`${j.key}#kw`));
      const useAi = a?.status === 'done' && a.places.length > 0 && !touchedKw;
      (useAi ? a.places : j.kw).forEach((d, i) => {
        const key = `${j.key}#${useAi ? 'ai' : 'kw'}#${i}`;
        if (removed.has(key)) return;
        cards.push({ key, status: a?.status, aiEmpty: a?.status === 'done' && !a.places.length, draft: { ...d, raw: j.text, url: d.url || j.url, ...edits[key] } });
      });
      (a?.status === 'done' ? a.tasks : []).forEach((t, i) => tasks.push({ key: `${j.key}#t${i}`, ...t, dueDate: dueFromOffset(trip.startDate, t.offset) }));
    }
    return { cards, tasks, loading };
  }, [jobs, ai, aiOn, edits, removed, trip.startDate]);

  const chosenTasks = tasks.filter((t) => !skipTasks.has(t.key));
  const total = cards.length + chosenTasks.length;
  const waitingForImages = images.length > 0 && !cards.length && loading;

  const readClipboard = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) setText((prev) => (prev ? `${prev}\n${t}` : t));
      else toast('剪贴板是空的');
    } catch {
      toast('浏览器不允许读取剪贴板，请长按输入框手动粘贴');
    }
  };

  const addImages = (files) => {
    const list = [...files].filter((f) => f.type.startsWith('image/')).slice(0, 6 - images.length);
    setImages((imgs) => [...imgs, ...list.map((file) => ({ id: Math.random().toString(36).slice(2, 8), file, url: URL.createObjectURL(file) }))]);
  };

  const toggleAi = () => {
    const v = !aiOn;
    setAiOn(v);
    try { localStorage.setItem(AI_KEY, v ? '1' : '0'); } catch { /* ignore */ }
  };

  const patch = (key, p) => setEdits((e) => ({ ...e, [key]: { ...e[key], ...p } }));

  const save = () => {
    const places = cards.map(({ draft }) => ({ ...draft, raw: (draft.raw || '').slice(0, 1000) })).filter((d) => d.title.trim());
    const n = places.length ? actions.addSaves(trip.id, places) : 0;
    const m = chosenTasks.length ? actions.addTasks(trip.id, chosenTasks.map(({ key, offset, ...t }) => t)) : 0; // eslint-disable-line no-unused-vars
    const merged = chosenTasks.length - m; // same tip already on the list → merged into it
    toast.success([n && `攻略库 +${n}`, m && `出发准备 +${m}`, merged > 0 && `${merged} 件已在清单里，已补上来源`].filter(Boolean).join(' · ') || '没有新内容');
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="收集攻略"
      footer={
        <PrimaryButton disabled={!total} onClick={save}>
          {loading ? 'AI 识别中…也可以先存' : total ? `存进来（${[cards.length && `${cards.length} 个地点`, chosenTasks.length && `${chosenTasks.length} 件准备事项`].filter(Boolean).join('、')}）` : '先贴内容或加截图'}
        </PrimaryButton>
      }>
      <div className="space-y-3">
        <div className="relative">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4}
            placeholder={'在 IG / 小红书 点「分享 → 复制链接」，贴在这里（可以一次贴多条）。\n小红书重点写在图片里的，直接加截图更准。'}
            className={`${inputCls} resize-none pr-12`} />
          <div className="absolute right-2 top-2 flex flex-col gap-1.5">
            <button onClick={readClipboard} aria-label="从剪贴板粘贴" className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <ClipboardPaste className="w-4 h-4" />
            </button>
            <button onClick={() => fileRef.current?.click()} aria-label="加截图" className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <ImagePlus className="w-4 h-4" />
            </button>
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { addImages(e.target.files || []); e.target.value = ''; }} />
        </div>

        {images.length > 0 && (
          <div className="flex gap-2 overflow-x-auto no-scrollbar">
            {images.map((img) => (
              <div key={img.id} className="relative shrink-0">
                <img src={img.url} alt="截图" className="w-16 h-24 rounded-lg object-cover border border-border" />
                <button onClick={() => setImages((x) => x.filter((i) => i.id !== img.id))} aria-label="移除截图"
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-foreground text-background flex items-center justify-center"><X className="w-3 h-3" /></button>
              </div>
            ))}
          </div>
        )}

        <button onClick={toggleAi} className="flex items-center gap-2 text-xs w-full">
          <span className={`relative shrink-0 w-9 h-5 rounded-full transition ${aiOn ? 'bg-violet-500' : 'bg-muted'}`}>
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${aiOn ? 'left-[18px]' : 'left-0.5'}`} />
          </span>
          <Sparkles className="w-3.5 h-3.5 text-violet-500 shrink-0" />
          <span className="font-semibold whitespace-nowrap">AI 识别</span>
          <span className="text-muted-foreground truncate">分出地点和准备事项，一篇多家店会拆开</span>
        </button>
        {images.length > 0 && !aiOn && <p className="text-[11px] text-amber-600">截图需要开启 AI 才能读。</p>}

        {waitingForImages && (
          <div className="rounded-2xl border border-violet-300/70 bg-violet-50 dark:bg-violet-500/10 p-4 flex items-center gap-2 text-sm text-violet-700 dark:text-violet-300">
            <Loader2 className="w-4 h-4 animate-spin" /> AI 正在读截图…
          </div>
        )}

        {cards.length > 0 && <h3 className="text-xs font-bold text-muted-foreground pt-1">📍 地点 · {cards.length}</h3>}
        {cards.map(({ key, draft: d, status, aiEmpty }) => (
          <div key={key} className={`rounded-2xl border bg-card p-3 space-y-2.5 ${d.unsure ? 'border-amber-300' : d.ai ? 'border-violet-300/70 dark:border-violet-500/40' : 'border-border'}`}>
            <div className="flex gap-2 items-start">
              {d.thumbnail && <img src={d.thumbnail} alt="" className="w-12 h-16 rounded-lg object-cover shrink-0 bg-muted" />}
              <div className="flex-1 min-w-0 space-y-1">
                <input value={d.title} onChange={(e) => patch(key, { title: e.target.value, unsure: false })} className={`${inputCls} py-2 font-semibold`} aria-label="名称" />
                {d.nameLocal && <p className="text-[11px] text-muted-foreground px-1">{d.nameLocal}</p>}
              </div>
              <button onClick={() => setRemoved((s) => new Set(s).add(key))} aria-label="移除" className="shrink-0 w-10 h-10 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {status === 'loading' && (
              <p className="flex items-center gap-1.5 text-[11px] text-violet-600 dark:text-violet-300 font-semibold">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> AI 正在看…（下面是先用关键词猜的）
              </p>
            )}
            {d.unsure && <p className="text-[11px] font-semibold text-amber-600">⚠️ AI 不太确定，请确认名称和地区</p>}
            {d.ai && d.note && <p className="text-[11px] text-violet-700 dark:text-violet-300 leading-snug"><b>✨</b> {d.note}</p>}
            {status === 'failed' && <p className="text-[11px] text-muted-foreground">AI 暂时连不上，先用关键词分类，之后可在详情里重新识别。</p>}
            {aiEmpty && <p className="text-[11px] text-muted-foreground">AI 没找到具体店名，先用关键词分类。</p>}

            <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
              {[...new Set([...regions, d.region])].map((r) => (
                <Chip key={r} active={d.region === r} onClick={() => patch(key, { region: r, area: '', unsure: false })}>{r}</Chip>
              ))}
            </div>
            {areasOf(d.region).length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
                {[...new Set([...areasOf(d.region), ...(d.area ? [d.area] : [])])].map((a) => (
                  <Chip key={a} active={d.area === a} onClick={() => patch(key, { area: d.area === a ? '' : a })} className="py-1 text-[11px]">{a}</Chip>
                ))}
              </div>
            )}
            <div className="grid grid-cols-4 gap-1.5">
              {CATEGORIES.map((c) => (
                <button key={c.id} onClick={() => patch(key, { category: c.id })}
                  className={`rounded-xl py-1.5 text-xs font-semibold border transition ${d.category === c.id ? `${c.color} border-transparent` : 'border-border text-muted-foreground'}`}>
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
          </div>
        ))}

        {tasks.length > 0 && (
          <>
            <h3 className="text-xs font-bold text-muted-foreground pt-2">☑️ 出发准备 · AI 从帖子里找到 {tasks.length} 件事</h3>
            <div className="rounded-2xl border border-border bg-card divide-y divide-border">
              {tasks.map((t) => {
                const on = !skipTasks.has(t.key);
                const g = TASK_GROUPS.find((x) => x.id === t.group);
                return (
                  <button key={t.key} onClick={() => setSkipTasks((s) => { const n = new Set(s); if (n.has(t.key)) n.delete(t.key); else n.add(t.key); return n; })}
                    className={`w-full text-left flex items-start gap-3 p-3 ${on ? '' : 'opacity-50'}`}>
                    <span className={`mt-0.5 w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${on ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/40'}`}>
                      {on && <Check className="w-3 h-3" />}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold">{g?.emoji} {t.title}</span>
                      {t.note && <span className="block text-[11px] text-muted-foreground leading-snug mt-0.5">{t.note}</span>}
                      {t.dueDate && <span className="block text-[11px] text-primary font-semibold mt-0.5">建议 {md(t.dueDate)} 前完成</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}
