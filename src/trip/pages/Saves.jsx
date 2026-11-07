import React, { useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Heart, CheckCircle2, CalendarCheck, ClipboardPaste, Sparkles, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { reanalyzeSave } from '../lib/reanalyze';
import { ofTrip } from '../lib/store';
import { CATEGORIES } from '../lib/parse';
import { UNSORTED, regionEmoji } from '../lib/regions';
import { md } from '../lib/dates';
import { Chip, CategoryBadge, Stars, Empty } from '../components/ui';
import SaveSheet from '../components/SaveSheet';

const STATUS = [
  { id: 'all', label: '全部' },
  { id: 'todo', label: '未安排' },
  { id: 'planned', label: '已安排' },
  { id: 'done', label: '已打卡' },
];

export default function Saves() {
  const { state, trip, openPaste } = useOutletContext();
  const [region, setRegion] = useState('all');
  const [cat, setCat] = useState('all');
  const [status, setStatus] = useState('all');
  const [openId, setOpenId] = useState(null);
  const [tidying, setTidying] = useState(null); // { done, total } while AI sorts unsorted saves

  const saves = ofTrip(state.saves, trip);
  const plannedOn = useMemo(() => {
    const m = {};
    state.items.forEach((i) => i.saveId && (m[i.saveId] = m[i.saveId] || i.date));
    return m;
  }, [state.items]);

  const regionList = useMemo(() => {
    const names = [...trip.regions];
    if (saves.some((s) => !names.includes(s.region))) names.push(UNSORTED);
    return names.map((r) => ({ name: r, count: saves.filter((s) => (r === UNSORTED ? !trip.regions.includes(s.region) : s.region === r)).length }));
  }, [saves, trip.regions]);

  const filtered = saves.filter((s) => {
    if (region !== 'all' && (region === UNSORTED ? trip.regions.includes(s.region) : s.region !== region)) return false;
    if (cat !== 'all' && s.category !== cat) return false;
    if (status === 'todo' && (plannedOn[s.id] || s.done)) return false;
    if (status === 'planned' && !plannedOn[s.id]) return false;
    if (status === 'done' && !s.done) return false;
    return true;
  });

  // Group by region → area so nearby places sit together.
  const groups = useMemo(() => {
    const g = new Map();
    for (const s of filtered) {
      const key = `${s.region}｜${s.area || '其他'}`;
      if (!g.has(key)) g.set(key, []);
      g.get(key).push(s);
    }
    const rank = (r) => (trip.regions.includes(r) ? trip.regions.indexOf(r) : 99); // 未分类 last
    return [...g.entries()]
      .map(([k, list]) => ({ key: k, region: k.split('｜')[0], area: k.split('｜')[1], list: list.sort((a, b) => b.starred - a.starred) }))
      .sort((a, b) => rank(a.region) - rank(b.region) || b.list.length - a.list.length);
  }, [filtered, trip.regions]);

  const openSave = saves.find((s) => s.id === openId) || null;
  const unsorted = saves.filter((s) => !trip.regions.includes(s.region));

  // One at a time keeps it gentle on the AI quota and shows progress.
  const tidyUnsorted = async () => {
    const list = [...unsorted];
    let fixed = 0;
    setTidying({ done: 0, total: list.length });
    for (const [i, s] of list.entries()) {
      try { if (await reanalyzeSave(s, trip)) fixed += 1; } catch { /* keep going */ }
      setTidying({ done: i + 1, total: list.length });
    }
    setTidying(null);
    toast[fixed ? 'success' : 'message'](fixed ? `AI 整理好 ${fixed} 条` : 'AI 也认不出这些，可以手动分类');
  };

  return (
    <div className="pt-3">
      {/* Region tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar px-4 pb-1">
        <button onClick={() => setRegion('all')}
          className={`shrink-0 rounded-2xl px-4 py-2.5 text-left border ${region === 'all' ? 'bg-foreground text-background border-foreground' : 'bg-card border-border'}`}>
          <div className="text-[11px] opacity-70">全部</div>
          <div className="text-lg font-extrabold leading-tight">{saves.length}</div>
        </button>
        {regionList.map((r) => (
          <button key={r.name} onClick={() => setRegion(r.name)}
            className={`shrink-0 rounded-2xl px-4 py-2.5 text-left border min-w-[84px] ${region === r.name ? 'bg-foreground text-background border-foreground' : 'bg-card border-border'}`}>
            <div className="text-[11px] opacity-70">{regionEmoji(r.name)} {r.name}</div>
            <div className="text-lg font-extrabold leading-tight">{r.count}</div>
          </button>
        ))}
      </div>

      <div className="flex gap-1.5 overflow-x-auto no-scrollbar px-4 pt-3">
        <Chip active={cat === 'all'} onClick={() => setCat('all')}>全部</Chip>
        {CATEGORIES.map((c) => <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>{c.emoji} {c.label}</Chip>)}
        <span className="w-px bg-border mx-1 shrink-0" />
        {STATUS.slice(1).map((s) => <Chip key={s.id} active={status === s.id} onClick={() => setStatus(status === s.id ? 'all' : s.id)}>{s.label}</Chip>)}
      </div>

      {unsorted.length > 0 && (
        <div className="mx-4 mt-3 rounded-2xl border border-violet-300/70 dark:border-violet-500/40 bg-violet-50 dark:bg-violet-500/10 p-3 flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-violet-500 shrink-0" />
          <p className="flex-1 text-xs">
            {tidying ? `AI 整理中 ${tidying.done}/${tidying.total}…` : <><b>{unsorted.length} 条</b>还没分到地区，让 AI 看一看？</>}
          </p>
          <button onClick={tidyUnsorted} disabled={!!tidying}
            className="shrink-0 rounded-xl bg-violet-500 text-white text-xs font-bold px-3 py-2 flex items-center gap-1 disabled:opacity-70">
            {tidying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}AI 整理
          </button>
        </div>
      )}

      {!saves.length ? (
        <Empty emoji="🎬" title="把刷到的推荐贴进来">
          <p>IG、小红书、TikTok 看到想吃想去的，点分享 → 复制链接，回来按下面的「粘贴」。会自动分成首尔 / 釜山 / 济州。</p>
          <button onClick={openPaste} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-bold">
            <ClipboardPaste className="w-4 h-4" /> 粘贴第一条
          </button>
        </Empty>
      ) : !filtered.length ? (
        <Empty emoji="🔍" title="没有符合的收藏" />
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
                    className={`w-full text-left rounded-2xl border border-border bg-card p-3 flex gap-3 items-start active:scale-[0.99] transition ${s.done ? 'opacity-80' : ''}`}>
                    {s.thumbnail && <img src={s.thumbnail} alt="" loading="lazy" className="w-12 h-16 rounded-lg object-cover shrink-0 bg-muted" />}
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <p className={`font-semibold leading-snug line-clamp-2 ${s.done ? 'line-through decoration-muted-foreground/50' : ''}`}>{s.title}</p>
                      {(s.nameLocal || (s.ai && s.note)) && (
                        <p className="text-[11px] text-muted-foreground truncate">{[s.nameLocal, s.ai && s.note].filter(Boolean).join(' · ')}</p>
                      )}
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <CategoryBadge id={s.category} />
                        {s.ai && <span className="text-[11px] font-bold text-violet-500">✨AI</span>}
                        {s.platform && <span className="text-[11px] text-muted-foreground">{s.platform}</span>}
                        {plannedOn[s.id] && !s.done && (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary"><CalendarCheck className="w-3 h-3" />{md(plannedOn[s.id])}</span>
                        )}
                      </div>
                      {s.done && (
                        <div className="flex items-center gap-2">
                          <Stars value={s.rating} size="w-3.5 h-3.5" />
                          {s.review && <span className="text-xs text-muted-foreground truncate">“{s.review}”</span>}
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col items-center gap-2 pt-0.5">
                      {s.done ? <CheckCircle2 className="w-5 h-5 text-primary" /> : s.starred ? <Heart className="w-4 h-4 fill-rose-500 text-rose-500" /> : null}
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}

      <SaveSheet save={openSave} onClose={() => setOpenId(null)} state={state} trip={trip} />
    </div>
  );
}
