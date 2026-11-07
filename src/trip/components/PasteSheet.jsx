import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardPaste, Trash2, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { actions } from '../lib/store';
import { parseMany, CATEGORIES } from '../lib/parse';
import { aiExtract } from '../lib/ai';
import { UNSORTED, areasOf } from '../lib/regions';
import { Sheet, Chip, PrimaryButton, inputCls } from './ui';

const EXAMPLE = '弘大这家烤肉真的绝了🔥 一定要排队 #首尔美食 https://www.instagram.com/reel/xxxx';
const AI_KEY = 'trip_ai_enabled';

const readAiPref = () => {
  try { return localStorage.getItem(AI_KEY) !== '0'; } catch { return true; }
};

/**
 * Paste one or many social-media shares. Each snippet gets an instant keyword
 * guess, then AI reads it and replaces the guess (possibly with several
 * places). A card the user already edited is left alone.
 */
export default function PasteSheet({ open, onClose, trip }) {
  const [text, setText] = useState('');
  const [aiOn, setAiOn] = useState(readAiPref);
  const [ai, setAi] = useState({}); // raw → { status: 'loading'|'done'|'failed', drafts }
  const [edits, setEdits] = useState({}); // card key → patch
  const [removed, setRemoved] = useState(() => new Set());
  const regions = [...trip.regions, UNSORTED];

  useEffect(() => {
    if (open) { setText(''); setAi({}); setEdits({}); setRemoved(new Set()); }
  }, [open]);

  const chunks = useMemo(() => parseMany(text, trip.regions), [text, trip.regions]);

  // Ask AI about each new snippet once the paste settles.
  useEffect(() => {
    if (!aiOn || !chunks.length) return;
    const t = setTimeout(() => {
      for (const c of chunks) {
        if (ai[c.raw]) continue;
        setAi((m) => ({ ...m, [c.raw]: { status: 'loading', drafts: [] } }));
        aiExtract({ text: c.raw, url: c.url, tripRegions: trip.regions })
          .then(({ drafts }) => setAi((m) => ({ ...m, [c.raw]: { status: 'done', drafts } })))
          .catch(() => setAi((m) => ({ ...m, [c.raw]: { status: 'failed', drafts: [] } })));
      }
    }, 700);
    return () => clearTimeout(t);
  }, [chunks, aiOn]); // eslint-disable-line react-hooks/exhaustive-deps

  const cards = useMemo(() => chunks.flatMap((c) => {
    const a = aiOn ? ai[c.raw] : null;
    const userTouchedKeyword = Object.keys(edits).some((k) => k.startsWith(`${c.raw}#kw`));
    const useAi = a?.status === 'done' && a.drafts.length > 0 && !userTouchedKeyword;
    const list = useAi ? a.drafts : [c];
    return list.map((d, j) => {
      const key = `${c.raw}#${useAi ? 'ai' : 'kw'}#${j}`;
      return {
        key,
        status: a?.status,
        aiEmpty: a?.status === 'done' && !a.drafts.length,
        draft: { ...d, raw: c.raw, url: d.url || c.url, ...edits[key] },
      };
    });
  }).filter((c) => !removed.has(c.key)), [chunks, ai, aiOn, edits, removed]);

  const loading = cards.some((c) => c.status === 'loading');

  const readClipboard = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) setText((prev) => (prev ? `${prev}\n${t}` : t));
      else toast('剪贴板是空的');
    } catch {
      toast('浏览器不允许读取剪贴板，请长按输入框手动粘贴');
    }
  };

  const toggleAi = () => {
    const v = !aiOn;
    setAiOn(v);
    try { localStorage.setItem(AI_KEY, v ? '1' : '0'); } catch { /* ignore */ }
  };

  const patch = (key, p) => setEdits((e) => ({ ...e, [key]: { ...e[key], ...p } }));

  const save = () => {
    const list = cards.map((c) => ({ ...c.draft, raw: c.draft.raw.slice(0, 1000) })).filter((d) => d.title.trim());
    actions.addSaves(trip.id, list);
    toast.success(`已收藏 ${list.length} 个地方`);
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="粘贴收藏"
      footer={
        <PrimaryButton disabled={!cards.length} onClick={save}>
          {loading ? 'AI 识别中…也可以先收藏' : `收藏 ${cards.length || ''} 个地方`}
        </PrimaryButton>
      }>
      <div className="space-y-3">
        <div className="relative">
          <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} autoFocus
            placeholder={`在 IG / 小红书 / TikTok 点「分享 → 复制链接」，贴在这里。\n一次贴多条也可以。\n\n例：${EXAMPLE}`}
            className={`${inputCls} resize-none pr-12`} />
          <button onClick={readClipboard} aria-label="从剪贴板粘贴"
            className="absolute right-2 top-2 w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
            <ClipboardPaste className="w-4 h-4" />
          </button>
        </div>

        <button onClick={toggleAi} className="flex items-center gap-2 text-xs w-full">
          <span className={`relative shrink-0 w-9 h-5 rounded-full transition ${aiOn ? 'bg-violet-500' : 'bg-muted'}`}>
            <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-all ${aiOn ? 'left-[18px]' : 'left-0.5'}`} />
          </span>
          <Sparkles className="w-3.5 h-3.5 text-violet-500" />
          <span className="font-semibold whitespace-nowrap">AI 识别</span>
          <span className="text-muted-foreground truncate">读懂文案、上网查店名，一则影片多家店会拆开</span>
        </button>

        {cards.length > 0 && (
          <p className="text-xs text-muted-foreground">识别到 {cards.length} 个地方，地区和分类可以点选修改：</p>
        )}

        {cards.map(({ key, draft: d, status, aiEmpty }) => (
          <div key={key} className={`rounded-2xl border bg-card p-3 space-y-2.5 ${d.ai ? 'border-violet-300/70 dark:border-violet-500/40' : 'border-border'}`}>
            <div className="flex gap-2 items-start">
              {d.thumbnail && <img src={d.thumbnail} alt="" className="w-12 h-16 rounded-lg object-cover shrink-0 bg-muted" />}
              <div className="flex-1 min-w-0 space-y-1">
                <input value={d.title} onChange={(e) => patch(key, { title: e.target.value })} className={`${inputCls} py-2 font-semibold`} aria-label="名称" />
                {d.nameLocal && <p className="text-[11px] text-muted-foreground px-1">{d.nameLocal}</p>}
              </div>
              <button onClick={() => setRemoved((s) => new Set(s).add(key))} aria-label="移除" className="shrink-0 w-10 h-10 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {status === 'loading' && (
              <p className="flex items-center gap-1.5 text-[11px] text-violet-600 dark:text-violet-300 font-semibold">
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> AI 正在看这则内容…（下面是先用关键词猜的）
              </p>
            )}
            {d.ai && (
              <p className="text-[11px] text-violet-700 dark:text-violet-300 leading-snug">
                <span className="font-bold">✨ AI</span>{d.note ? `：${d.note}` : ' 已识别'}{d.address ? ` · ${d.address}` : ''}
              </p>
            )}
            {status === 'failed' && <p className="text-[11px] text-muted-foreground">AI 暂时连不上，先用关键词分类，之后可在详情里重新识别。</p>}
            {aiEmpty && <p className="text-[11px] text-muted-foreground">AI 没找到具体店名，先用关键词分类。</p>}

            {(d.platform || d.url) && (
              <p className="text-[11px] text-muted-foreground truncate">{d.platform && <b className="mr-1">{d.platform}</b>}{d.url}</p>
            )}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
              {[...new Set([...regions, d.region])].map((r) => (
                <Chip key={r} active={d.region === r} onClick={() => patch(key, { region: r, area: '' })}>{r}</Chip>
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
      </div>
    </Sheet>
  );
}
