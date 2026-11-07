import React, { useEffect, useMemo, useState } from 'react';
import { ClipboardPaste, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { actions } from '../lib/store';
import { parseMany, CATEGORIES } from '../lib/parse';
import { UNSORTED, areasOf } from '../lib/regions';
import { Sheet, Chip, PrimaryButton, inputCls } from './ui';

const EXAMPLE = '弘大这家烤肉真的绝了🔥 一定要排队 #首尔美食 https://www.instagram.com/reel/xxxx';

/** Paste one or many social-media shares; each becomes an editable draft. */
export default function PasteSheet({ open, onClose, trip }) {
  const [text, setText] = useState('');
  const [drafts, setDrafts] = useState([]);
  const regions = [...trip.regions, UNSORTED];

  useEffect(() => {
    if (open) { setText(''); setDrafts([]); }
  }, [open]);

  // Re-parse as the user types/pastes, but keep manual edits to existing drafts.
  const parsed = useMemo(() => parseMany(text, trip.regions), [text, trip.regions]);
  useEffect(() => setDrafts(parsed), [parsed]);

  const readClipboard = async () => {
    try {
      const t = await navigator.clipboard.readText();
      if (t) setText((prev) => (prev ? `${prev}\n${t}` : t));
      else toast('剪贴板是空的');
    } catch {
      toast('浏览器不允许读取剪贴板，请长按输入框手动粘贴');
    }
  };

  const patch = (i, p) => setDrafts((d) => d.map((x, j) => (j === i ? { ...x, ...p } : x)));

  const save = () => {
    const list = drafts.filter((d) => d.title.trim());
    actions.addSaves(trip.id, list);
    toast.success(`已收藏 ${list.length} 条`);
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title="粘贴收藏"
      footer={<PrimaryButton disabled={!drafts.length} onClick={save}>收藏 {drafts.length || ''} 条</PrimaryButton>}>
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

        {drafts.length > 0 && (
          <p className="text-xs text-muted-foreground">识别到 {drafts.length} 条，地区和分类可以点选修改：</p>
        )}

        {drafts.map((d, i) => (
          <div key={i} className="rounded-2xl border border-border bg-card p-3 space-y-2.5">
            <div className="flex gap-2">
              <input value={d.title} onChange={(e) => patch(i, { title: e.target.value })} className={`${inputCls} py-2 font-semibold`} aria-label="名称" />
              <button onClick={() => setDrafts((x) => x.filter((_, j) => j !== i))} aria-label="移除" className="shrink-0 w-10 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/10 flex items-center justify-center">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
            {(d.platform || d.url) && (
              <p className="text-[11px] text-muted-foreground truncate">{d.platform && <b className="mr-1">{d.platform}</b>}{d.url}</p>
            )}
            <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
              {regions.map((r) => (
                <Chip key={r} active={d.region === r} onClick={() => patch(i, { region: r, area: '' })}>{r}</Chip>
              ))}
            </div>
            {areasOf(d.region).length > 0 && (
              <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-1 px-1">
                {areasOf(d.region).map((a) => (
                  <Chip key={a} active={d.area === a} onClick={() => patch(i, { area: d.area === a ? '' : a })} className="py-1 text-[11px]">{a}</Chip>
                ))}
              </div>
            )}
            <div className="grid grid-cols-4 gap-1.5">
              {CATEGORIES.map((c) => (
                <button key={c.id} onClick={() => patch(i, { category: c.id })}
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
