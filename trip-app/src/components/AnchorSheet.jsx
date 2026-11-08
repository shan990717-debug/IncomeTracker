import React, { useEffect, useState } from 'react';
import { LocateFixed, Search, Loader2, MapPin } from 'lucide-react';
import { toast } from 'sonner';
import { searchPoints } from '../lib/ai';
import { myPosition } from '../lib/geo';
import { Sheet, inputCls } from './ui';

const RECENT = 'tripaa_recent_points';
const readRecent = () => { try { return JSON.parse(localStorage.getItem(RECENT) || '[]'); } catch { return []; } };

/**
 * Where to measure 距离 from: the phone's current location, or a searched
 * point such as the hotel. Recent points are remembered on this device.
 */
export default function AnchorSheet({ open, onClose, onPick, korea }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [busy, setBusy] = useState('');
  const [recent, setRecent] = useState(readRecent);
  useEffect(() => { if (open) { setResults([]); setRecent(readRecent()); } }, [open]);

  const pick = (p) => {
    const next = [p, ...recent.filter((r) => r.name !== p.name)].slice(0, 5);
    try { localStorage.setItem(RECENT, JSON.stringify(next)); } catch { /* ignore */ }
    onPick({ type: 'point', ...p });
    onClose();
  };

  const useMe = async () => {
    setBusy('me');
    try { onPick({ type: 'me', name: '我的位置', ...(await myPosition()) }); onClose(); } catch (e) { toast.error(e.message); }
    setBusy('');
  };

  const search = async () => {
    if (!query.trim()) return;
    setBusy('search');
    try {
      const r = await searchPoints(query.trim(), korea);
      setResults(r);
      if (!r.length) toast('找不到这个地方，换个关键字试试（韩国的地方用韩文最准）');
    } catch (e) { toast.error(e.message); }
    setBusy('');
  };

  return (
    <Sheet open={open} onClose={onClose} title="从哪里算距离？">
      <div className="space-y-4 pb-2">
        <button onClick={useMe} disabled={busy === 'me'}
          className="w-full rounded-2xl border border-primary/40 bg-primary/5 p-3 flex items-center gap-3 text-left">
          {busy === 'me' ? <Loader2 className="w-5 h-5 text-primary animate-spin" /> : <LocateFixed className="w-5 h-5 text-primary" />}
          <span>
            <span className="block font-bold text-sm">我现在的位置</span>
            <span className="block text-[11px] text-muted-foreground">到了当地，找附近有什么</span>
          </span>
        </button>

        <div>
          <p className="text-xs font-semibold text-muted-foreground mb-1.5">或搜一个地方（例如酒店、车站）</p>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); search(); }}>
            <input value={query} onChange={(e) => setQuery(e.target.value)} className={inputCls} placeholder="例：弘大 L7 酒店" />
            <button type="submit" disabled={!query.trim() || busy === 'search'} aria-label="搜索"
              className="shrink-0 w-12 rounded-xl bg-primary text-primary-foreground flex items-center justify-center disabled:opacity-40">
              {busy === 'search' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </button>
          </form>
        </div>

        {[['搜索结果', results], ['最近用过', results.length ? [] : recent]].map(([label, list]) => list.length > 0 && (
          <div key={label}>
            <p className="text-xs font-semibold text-muted-foreground mb-1.5">{label}</p>
            <div className="rounded-2xl border border-border bg-card divide-y divide-border">
              {list.map((p, i) => (
                <button key={`${p.name}-${i}`} onClick={() => pick(p)} className="w-full text-left p-3 flex items-start gap-2.5">
                  <MapPin className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold truncate">{p.name}</span>
                    {p.address && <span className="block text-[11px] text-muted-foreground truncate">{p.address}</span>}
                  </span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Sheet>
  );
}
