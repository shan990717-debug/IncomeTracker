import React, { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { ofTrip } from '../lib/store';
import { reanalyzeSave } from '../lib/reanalyze';
import { CATEGORIES } from '../lib/parse';
import { UNSORTED, regionEmoji } from '../lib/regions';
import { md } from '../lib/dates';
import { Chip, CategoryBadge, Stars, Empty } from '../components/ui';
import SaveSheet from '../components/SaveSheet';

const STATUS_FILTERS = [
  { id: 'saved', label: '收藏' },
  { id: 'going', label: '⭐ 要去' },
  { id: 'done', label: '✓ 去过' },
];

function StatusPill({ s }) {
  if (s.status === 'going') return <span className="text-[11px] font-bold text-amber-600">⭐ 要去{s.day ? ` · ${md(s.day)}` : ''}</span>;
  if (s.status === 'done') return <span className="text-[11px] font-bold text-primary">✓ 去过</span>;
  return null;
}

export default function Saves() {
  const { state, trip, openCollect } = useOutletContext();
  const [region, setRegion] = useState('all');
  const [cat, setCat] = useState('all');
  const [status, setStatus] = useState('all');
  const [openId, setOpenId] = useState(null);
  const [tidying, setTidying] = useState(null);

  const saves = ofTrip(state.saves, trip);
  const inRegion = (s, r) => (r === UNSORTED ? !trip.regions.includes(s.region) : s.region === r);
  const unsorted = saves.filter((s) => !trip.regions.includes(s.region));

  const regionList = useMemo(() => {
    const names = [...trip.regions, ...(unsorted.length ? [UNSORTED] : [])];
    return names.map((r) => ({ name: r, count: saves.filter((s) => inRegion(s, r)).length, going: saves.filter((s) => inRegion(s, r) && s.status === 'going').length }));
  }, [saves, trip.regions]); // eslint-disable-line react-hooks/exhaustive-deps

  const filtered = saves.filter((s) =>
    (region === 'all' || inRegion(s, region)) && (cat === 'all' || s.category === cat) && (status === 'all' || (s.status || 'saved') === status));

  // Region → area, so places that are near each other sit together.
  const groups = useMemo(() => {
    const g = new Map();
    for (const s of filtered) {
      const key = `${s.region}｜${s.area || '其他'}`;
      if (!g.has(key)) g.set(key, []);
      g.get(key).push(s);
    }
    const order = { going: 0, saved: 1, done: 2 };
    const rank = (r) => (trip.regions.includes(r) ? trip.regions.indexOf(r) : 99);
    return [...g.entries()]
      .map(([k, list]) => ({ key: k, region: k.split('｜')[0], area: k.split('｜')[1], list: list.sort((a, b) => (order[a.status] ?? 1) - (order[b.status] ?? 1)) }))
      .sort((a, b) => rank(a.region) - rank(b.region) || b.list.length - a.list.length);
  }, [filtered, trip.regions]);

  const tidyUnsorted = async () => {
    const list = [...unsorted];
    let fixed = 0;
    setTidying({ done: 0, total: list.length });
    for (const [i, s] of list.entries()) {
      try { if ((await reanalyzeSave(s, trip)).places) fixed += 1; } catch { /* keep going */ }
      setTidying({ done: i + 1, total: list.length });
    }
    setTidying(null);
    toast[fixed ? 'success' : 'message'](fixed ? `AI 整理好 ${fixed} 条` : 'AI 也认不出这些，可以手动分类');
  };

  const openSave = saves.find((s) => s.id === openId) || null;
  const goingCount = saves.filter((s) => s.status === 'going').length;
  const doneCount = saves.filter((s) => s.status === 'done').length;

  return (
    <div className="pt-3">
      <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 pb-1">
        <button onClick={() => setRegion('all')}
          className={`shrink-0 rounded-2xl px-4 py-2.5 text-left border ${region === 'all' ? 'bg-foreground text-background border-foreground' : 'bg-card border-border'}`}>
          <div className="text-[11px] opacity-70">全部</div>
          <div className="text-lg font-extrabold leading-tight">{saves.length}</div>
        </button>
        {regionList.map((r) => (
          <button key={r.name} onClick={() => setRegion(r.name)}
            className={`shrink-0 rounded-2xl px-4 py-2.5 text-left border min-w-[88px] ${region === r.name ? 'bg-foreground text-background border-foreground' : 'bg-card border-border'}`}>
            <div className="text-[11px] opacity-70">{regionEmoji(r.name)} {r.name}</div>
            <div className="text-lg font-extrabold leading-tight">{r.count}{r.going > 0 && <span className="text-[11px] font-bold opacity-70 ml-1">⭐{r.going}</span>}</div>
          </button>
        ))}
      </div>

      <div className="flex gap-1.5 overflow-x-auto no-scrollbar px-4 pt-3">
        <Chip active={cat === 'all'} onClick={() => setCat('all')}>全部</Chip>
        {CATEGORIES.map((c) => <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>{c.emoji} {c.label}</Chip>)}
      </div>
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar px-4 pt-2">
        {STATUS_FILTERS.map((s) => <Chip key={s.id} active={status === s.id} onClick={() => setStatus(status === s.id ? 'all' : s.id)}>{s.label}</Chip>)}
        <span className="ml-auto self-center text-[11px] text-muted-foreground shrink-0 pl-2">已定要去 {goingCount} · 去过 {doneCount}</span>
      </div>

      {unsorted.length > 0 && (
        <div className="mx-4 mt-3 rounded-2xl border border-violet-300/70 dark:border-violet-500/40 bg-violet-50 dark:bg-violet-500/10 p-3 flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-violet-500 shrink-0" />
          <p className="flex-1 text-xs">{tidying ? `AI 整理中 ${tidying.done}/${tidying.total}…` : <><b>{unsorted.length} 条</b>还没分到城市，让 AI 看一看？</>}</p>
          <button onClick={tidyUnsorted} disabled={!!tidying}
            className="shrink-0 rounded-xl bg-violet-500 text-white text-xs font-bold px-3 py-2 flex items-center gap-1 disabled:opacity-70">
            {tidying && <Loader2 className="w-3.5 h-3.5 animate-spin" />}AI 整理
          </button>
        </div>
      )}

      {!saves.length ? (
        <Empty emoji="📚" title="把收藏的攻略放进来">
          <p>IG、小红书看到想吃想去的，点分享 → 复制链接，或者直接截图，按下面的「＋」。AI 会自动分城市和类别。</p>
          <button onClick={openCollect} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-bold">
            <Plus className="w-4 h-4" /> 收集第一条
          </button>
        </Empty>
      ) : !filtered.length ? (
        <Empty emoji="🔍" title="没有符合的攻略" />
      ) : (
        <div className="px-4 pt-4 space-y-5">
          {groups.map((g) => (
            <section key={g.key}>
              <h3 className="text-xs font-bold text-muted-foreground mb-2">
                {region === 'all' && `${g.region} · `}{g.area} <span className="font-normal">({g.list.length})</span>
              </h3>
              <div className="space-y-2">
                {g.list.map((s) => (
                  <button key={s.id} onClick={() => setOpenId(s.id)}
                    className={`w-full text-left rounded-2xl border bg-card p-3 flex gap-3 items-start active:scale-[0.99] transition ${s.status === 'going' ? 'border-amber-300/80' : 'border-border'} ${s.status === 'done' ? 'opacity-75' : ''}`}>
                    {s.thumbnail && <img src={s.thumbnail} alt="" loading="lazy" className="w-12 h-16 rounded-lg object-cover shrink-0 bg-muted" />}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <p className="font-semibold leading-snug line-clamp-2">{s.title}</p>
                      {(s.nameLocal || (s.ai && s.note)) && (
                        <p className="text-[11px] text-muted-foreground truncate">{[s.nameLocal, s.ai && s.note].filter(Boolean).join(' · ')}</p>
                      )}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <CategoryBadge id={s.category} />
                        <StatusPill s={s} />
                        {s.unsure && <span className="text-[11px] font-bold text-amber-600">待确认</span>}
                        {s.platform && <span className="text-[11px] text-muted-foreground">{s.platform}</span>}
                      </div>
                      {s.status === 'done' && s.rating > 0 && (
                        <div className="flex items-center gap-2">
                          <Stars value={s.rating} size="w-3.5 h-3.5" />
                          {s.review && <span className="text-xs text-muted-foreground truncate">“{s.review}”</span>}
                        </div>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <SaveSheet save={openSave} onClose={() => setOpenId(null)} trip={trip} />
    </div>
  );
}
