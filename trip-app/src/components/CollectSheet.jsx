import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ClipboardPaste, ImagePlus, Trash2, Sparkles, Loader2, X, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { actions, uid } from '../lib/store';
import { finishInBackground } from '../lib/background';
import { parseMany, CATEGORIES, SUBTYPES } from '../lib/parse';
import { aiExtract, resolvePost } from '../lib/ai';
import { postKey, isShortLink, alreadyCollected, withPostMark, describeCollected } from '../lib/dedupe';
import { UNSORTED, areasOf } from '../lib/regions';
import { Sheet, Chip, PrimaryButton, inputCls } from './ui';
import { hasCoords } from '../lib/geo';
import { tipType, relevantToTrip, whenLabel } from '../lib/tips';
import { todayISO } from '../lib/dates';

const AI_KEY = 'trip_ai_enabled';
const readAiPref = () => { try { return localStorage.getItem(AI_KEY) !== '0'; } catch { return true; } };

/**
 * One entry point for everything found on IG / 小红书:
 *   paste link + caption (one or many), and/or add screenshots.
 * Instant keyword guess first; AI then splits the post into places (攻略库)
 * with its 种类 and location. Cards the user already edited are left alone.
 */
export default function CollectSheet({ open, onClose, trip, initialText = '' }) {
  const [text, setText] = useState('');
  const [images, setImages] = useState([]); // { id, file, url }
  const [aiOn, setAiOn] = useState(readAiPref);
  const [ai, setAi] = useState({}); // job key → { status, places, error }
  const [edits, setEdits] = useState({});
  const [removed, setRemoved] = useState(() => new Set());
  const [removedTips, setRemovedTips] = useState(() => new Set());
  const [forced, setForced] = useState(() => new Set()); // posts to read again even though they were collected before
  const fileRef = useRef(null);
  const requests = useRef({}); // job key → running AI request, handed to the background on save
  const regions = [...trip.regions, UNSORTED];

  useEffect(() => {
    if (!open) {
      // Clearing the input cancels a not-yet-started AI read (the background owns saved ones).
      setText(''); setImages([]); requests.current = {};
      return;
    }
    setText(initialText); setAi({}); setEdits({}); setRemoved(new Set()); setRemovedTips(new Set()); setForced(new Set());
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
        setAi((m) => ({ ...m, [j.key]: { status: 'loading', places: [] } }));
        const force = forced.has(j.key);
        // Same post already collected? Checked before AI (free); 小红书 short links are resolved first.
        const req = (async () => {
          let key = postKey(j.url);
          if (j.url && isShortLink(j.url)) key = (await resolvePost(j.url).catch(() => '')) || key;
          const found = !force && alreadyCollected(trip.id, key);
          if (found) return { dup: found, postKey: key, places: [], tips: [] };
          const r = await aiExtract({ text: j.text, url: j.url, images: j.images, tripRegions: trip.regions });
          const real = r.post?.postKey || key;
          return { ...r, postKey: real, dup: (!force && real !== key && alreadyCollected(trip.id, real)) || null };
        })();
        requests.current[j.key] = req;
        req.then((r) => setAi((m) => ({ ...m, [j.key]: { status: r.dup ? 'dup' : 'done', ...r } })))
          .catch((e) => setAi((m) => ({ ...m, [j.key]: { status: 'failed', places: [], error: e.message } })));
      }
    }, 800);
    return () => clearTimeout(t);
  }, [jobs, aiOn, forced]); // eslint-disable-line react-hooks/exhaustive-deps

  /** 「还是要重新识别」: keep an AI result we already have, otherwise read it again. */
  const redo = (jobKey) => {
    const a = ai[jobKey];
    if (a?.places?.length || a?.tips?.length) { setAi((m) => ({ ...m, [jobKey]: { ...a, status: 'done', dup: null } })); return; }
    setForced((f) => new Set(f).add(jobKey));
    setAi((m) => { const n = { ...m }; delete n[jobKey]; return n; });
  };

  const { cards, tips, loading, dups } = useMemo(() => {
    const cards = [];
    const tips = [];
    const dups = [];
    let loading = false;
    for (const j of jobs) {
      const a = aiOn ? ai[j.key] : null;
      if (a?.status === 'loading') loading = true;
      if (a?.status === 'dup') { dups.push({ jobKey: j.key, ...a.dup }); continue; }
      const touchedKw = Object.keys(edits).some((k) => k.startsWith(`${j.key}#kw`));
      const useAi = a?.status === 'done' && a.places.length > 0 && !touchedKw;
      // A post that is only 须知 (e.g. a KTX guide) shouldn't also make a 「待识别」 place.
      const tipsOnly = a?.status === 'done' && !a.places.length && (a.tips || []).length > 0;
      (useAi ? a.places : tipsOnly ? [] : j.kw).forEach((d, i) => {
        const key = `${j.key}#${useAi ? 'ai' : 'kw'}#${i}`;
        if (removed.has(key)) return;
        cards.push({
          key, status: a?.status, error: a?.error, aiEmpty: a?.status === 'done' && !a.places.length,
          post: i === 0 ? a?.post : null, // show once per post: did the link give us the full text?
          draft: { ...d, raw: j.text, url: d.url || j.url, ...edits[key] },
        });
      });
      (a?.status === 'done' ? a.tips || [] : []).forEach((t, i) => {
        const key = `${j.key}#t${i}`;
        if (!removedTips.has(key)) tips.push({ key, ...t });
      });
    }
    return { cards, tips, loading, dups };
  }, [jobs, ai, aiOn, edits, removed, removedTips]);

  const total = cards.length + tips.length;
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
    // Posts whose AI read hasn't finished: save the keyword guess now as a
    // placeholder and let the background swap in the real result later.
    const later = [];
    const pendingJob = (j) => {
      const a = ai[j.key];
      const touched = Object.keys(edits).some((k) => k.startsWith(`${j.key}#kw`));
      return aiOn && !touched && (!a || a.status === 'loading');
    };
    const placeholders = [];
    for (const j of jobs.filter(pendingJob)) {
      const first = cards.find((c) => c.key.startsWith(`${j.key}#kw`));
      const id = uid();
      const draft = first
        ? { ...first.draft, raw: (first.draft.raw || '').slice(0, 1000) }
        : { title: '截图识别中…', category: 'place', region: UNSORTED, area: '', platform: '截图', url: j.url, raw: j.text.slice(0, 1000) };
      placeholders.push({ ...draft, id, unsure: true });
      later.push({ placeholderId: id, promise: requests.current[j.key] || null, text: j.text, url: j.url, images: j.images });
    }
    const laterKeys = new Set(jobs.filter(pendingJob).map((j) => j.key));
    const ready = cards.filter((c) => ![...laterKeys].some((k) => c.key.startsWith(`${k}#`)));

    const markOf = (cardKey) => ai[jobs.find((j) => cardKey.startsWith(`${j.key}#`))?.key]?.postKey;
    const places = ready.map(({ key, draft }) => ({ ...draft, raw: withPostMark((draft.raw || '').slice(0, 1000), markOf(key), draft.url) })).filter((d) => d.title.trim());
    const n = places.length ? actions.addSaves(trip.id, places) : 0;
    const samePlace = places.length - n; // already in 攻略库 → merged
    if (placeholders.length) actions.addSaves(trip.id, placeholders);
    const m = tips.length ? actions.addTips(trip.id, tips.map(({ key, ...t }) => t)) : 0; // eslint-disable-line no-unused-vars
    const merged = tips.length - m;
    later.forEach((job) => finishInBackground({ ...job, tripId: trip.id, tripRegions: trip.regions }));

    toast.success([
      n && `地点 +${n}`, samePlace > 0 && `${samePlace} 个地点已经有了，已合并`, m && `须知 +${m}`,
      merged > 0 && `${merged} 条须知已经有了，补上来源`, later.length && `${later.length} 条 AI 在后台识别中…`,
    ].filter(Boolean).join(' · ') || '没有可以存的内容');
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="收集攻略"
      footer={
        <PrimaryButton disabled={!total && !loading} onClick={save}>
          {loading ? '先存进来（AI 会在后台继续识别）' : !total && dups.length ? '都收过了' : total ? `存进来（${[cards.length && `${cards.length} 个地点`, tips.length && `${tips.length} 条须知`].filter(Boolean).join('、')}）` : '先贴链接或加截图'}
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
          <span className="text-muted-foreground truncate">认店名、分类、找位置，一篇多家店会拆开</span>
        </button>
        {images.length > 0 && !aiOn && <p className="text-[11px] text-amber-600">截图需要开启 AI 才能读。</p>}

        {waitingForImages && (
          <div className="rounded-2xl border border-violet-300/70 bg-violet-50 dark:bg-violet-500/10 p-4 flex items-center gap-2 text-sm text-violet-700 dark:text-violet-300">
            <Loader2 className="w-4 h-4 animate-spin" /> AI 正在读截图…
          </div>
        )}

        {dups.map((d) => (
          <div key={d.jobKey} className="rounded-2xl border border-emerald-300 bg-emerald-50 dark:bg-emerald-500/10 p-3 space-y-1">
            <p className="text-sm font-bold text-emerald-800 dark:text-emerald-200">✅ 这篇之前收过了，不会重复加</p>
            <p className="text-xs text-muted-foreground">已经有：{describeCollected(d)}</p>
            <button onClick={() => redo(d.jobKey)} className="text-xs font-semibold text-primary">还是要重新识别</button>
          </div>
        ))}

        {cards.length > 0 && <h3 className="text-xs font-bold text-muted-foreground pt-1">📍 地点 · {cards.length}（有错可以点一下改）</h3>}
        {cards.map(({ key, draft: d, status, aiEmpty, error, post }) => (
          <div key={key} className={`rounded-2xl border bg-card p-3 space-y-2.5 ${d.unsure ? 'border-amber-300' : d.ai ? 'border-violet-300/70 dark:border-violet-500/40' : 'border-border'}`}>
            <div className="flex gap-2 items-start">
              {d.thumbnail && <img src={d.thumbnail} alt="" referrerPolicy="no-referrer" onError={(e) => { e.currentTarget.style.display = 'none'; }} className="w-12 h-16 rounded-lg object-cover shrink-0 bg-muted" />}
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
            {post && (post.ok
              ? <p className="text-[11px] text-primary font-semibold">📖 已打开链接读到贴文{post.textLength ? `（内文 ${post.textLength} 字）` : ''}</p>
              : <p className="text-[11px] text-amber-600 font-semibold">⚠️ 读不到贴文内容：{post.reason || '平台挡住了'}。可以把有店名的画面截图加进来。</p>)}
            {status === 'failed' && <p className="text-[11px] text-muted-foreground">AI 没成功（{error || '连不上'}），先用关键词分类，之后可以重新识别。</p>}
            {d.ai && (
              <p className={`text-[11px] flex items-center gap-1 ${hasCoords(d) ? 'text-primary' : 'text-muted-foreground'}`}>
                <MapPin className="w-3 h-3" />{hasCoords(d) ? `已找到位置${d.address ? `：${d.address}` : ''}` : '没找到位置（存好后可以在详情里再找）'}
              </p>
            )}
            {aiEmpty && <p className="text-[11px] text-muted-foreground">AI 没找到具体店名，先用关键词分类。</p>}

            <div className="flex items-center gap-1.5">
              {[['recommend', '👍 推荐'], ['avoid', '👎 避雷']].map(([v, label]) => (
                <Chip key={v} active={(d.verdict || 'recommend') === v} onClick={() => patch(key, { verdict: v })}
                  className={`py-1 text-[11px] ${v === 'avoid' && d.verdict === 'avoid' ? '!bg-destructive !border-destructive' : ''}`}>{label}</Chip>
              ))}
              {d.verdict === 'avoid' && d.verdictReason && <span className="text-[11px] text-destructive truncate">{d.verdictReason}</span>}
            </div>
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
                <button key={c.id} onClick={() => patch(key, { category: c.id, subtype: '' })}
                  className={`rounded-xl py-1.5 text-xs font-semibold border transition ${d.category === c.id ? `${c.color} border-transparent` : 'border-border text-muted-foreground'}`}>
                  {c.emoji} {c.label}
                </button>
              ))}
            </div>
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
              {(SUBTYPES[d.category] || []).map((t) => (
                <Chip key={t} active={d.subtype === t} onClick={() => patch(key, { subtype: t })} className="py-1 text-[11px]">{t}</Chip>
              ))}
            </div>
          </div>
        ))}

        {tips.length > 0 && (
          <>
            <h3 className="text-xs font-bold text-muted-foreground pt-2">📝 须知 · {tips.length}</h3>
            <div className="rounded-2xl border border-border bg-card divide-y divide-border">
              {tips.map((t) => {
                const tt = tipType(t.type);
                const when = whenLabel(t, trip, todayISO());
                const fits = relevantToTrip(t, trip);
                return (
                  <div key={t.key} className={`flex items-start gap-2.5 p-3 ${fits ? '' : 'opacity-60'}`}>
                    <span className="text-base leading-5">{t.isAction ? tt.emoji : '💡'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold leading-snug">{t.title}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {tt.label} · {t.cities.length ? t.cities.join('·') : '全国'}
                        {when ? ` · ${when.text.split('（')[0]}${t.offsetFromPost ? '' : '（AI 建议）'}` : ''}
                        {t.personal ? ' · 每人各自做' : ''}
                        {!fits ? ' · 这次行程用不到' : ''}
                      </p>
                    </div>
                    <button onClick={() => setRemovedTips((s) => new Set(s).add(t.key))} aria-label="不要这条"
                      className="shrink-0 w-8 h-8 rounded-lg text-muted-foreground hover:text-destructive flex items-center justify-center"><X className="w-4 h-4" /></button>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </Sheet>
  );
}
