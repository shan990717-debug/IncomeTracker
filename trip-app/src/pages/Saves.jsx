import React, { useEffect, useMemo, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Sparkles, Loader2, MapPin, Navigation, ChevronDown, Layers } from 'lucide-react';
import { toast } from 'sonner';
import { ofTrip, memberName } from '../lib/store';
import { reanalyzeSave } from '../lib/reanalyze';
import { CATEGORIES, categoryOf } from '../lib/parse';
import { UNSORTED, regionEmoji } from '../lib/regions';
import { hasCoords, km, fmtKm, myPosition } from '../lib/geo';
import { Chip, Empty } from '../components/ui';
import SaveSheet from '../components/SaveSheet';
import AnchorSheet from '../components/AnchorSheet';

const SUB_EMOJI = {
  烤肉: '🥩', 火锅: '🍲', 炸鸡: '🍗', 海鲜: '🦀', 韩式家常: '🍚', 面食: '🍜', 日料: '🍣', 西餐: '🍝', 小吃: '🍢', 咖啡甜点: '☕', 酒馆: '🍻',
  景点: '📍', 古迹: '🏯', 自然风景: '🏞️', 夜景: '🌃', 博物馆展览: '🖼️', 街区市场: '🏮', 拍照打卡: '📸',
  体验: '✨', 汗蒸SPA: '♨️', 乐园: '🎢', 演出: '🎭', 课程DIY: '🎨',
  美妆: '💄', 服饰: '👗', 商场百货: '🏬', 市场: '🛒', 文创书店: '📚', 伴手礼: '🎁',
};
const subLabel = (s) => s.subtype || '其他';

const readPref = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
const writePref = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* ignore */ } };

function PlaceCard({ s, dist, state, trip, onOpen }) {
  const cat = categoryOf(s.category);
  const by = s.addedBy && s.addedBy !== state.user?.id ? memberName(state, trip.id, s.addedBy) : '';
  return (
    <button onClick={() => onOpen(s.id)}
      className={`w-full text-left rounded-2xl border bg-card p-3 flex gap-3 items-center active:scale-[0.99] transition ${s.unsure ? 'border-amber-300' : 'border-border'}`}>
      {s.thumbnail
        ? <img src={s.thumbnail} alt="" loading="lazy" className="w-12 h-12 rounded-xl object-cover shrink-0 bg-muted" />
        : <span className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center text-2xl shrink-0">{SUB_EMOJI[s.subtype] || cat.emoji}</span>}
      <div className="flex-1 min-w-0">
        <p className="font-bold leading-snug truncate">{s.title}</p>
        {s.nameLocal && s.nameLocal !== s.title && <p className="text-[11px] text-muted-foreground truncate">{s.nameLocal}</p>}
        <div className="flex items-center gap-1.5 mt-1 text-[11px] text-muted-foreground flex-wrap">
          <span className={`rounded-full px-2 py-0.5 font-semibold ${cat.color}`}>{subLabel(s)}</span>
          {(s.area || s.region) && <span>📍{s.area || s.region}</span>}
          {s.unsure && <span className="font-bold text-amber-600">待确认</span>}
          {!hasCoords(s) && <span className="text-muted-foreground/70">没有位置</span>}
          {by && <span>· {by} 加的</span>}
        </div>
      </div>
      {dist != null && <span className="shrink-0 text-xs font-bold text-primary tabular-nums">{fmtKm(dist)}</span>}
    </button>
  );
}

export default function Saves() {
  const { state, trip, openCollect } = useOutletContext();
  const [city, setCity] = useState('all');
  const [cat, setCat] = useState('all');
  const [sub, setSub] = useState('all');
  const [sort, setSort] = useState(() => readPref('tripaa_sort', 'area'));
  const [anchor, setAnchor] = useState(() => readPref(`tripaa_anchor_${trip.id}`, null));
  const [anchorOpen, setAnchorOpen] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [tidying, setTidying] = useState(null);

  const saves = ofTrip(state.saves, trip);

  // "我的位置" goes stale: refresh it quietly whenever the list opens.
  useEffect(() => {
    if (anchor?.type !== 'me') return;
    myPosition().then((p) => setAnchor((a) => (a?.type === 'me' ? { ...a, ...p } : a))).catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Cities: the trip's own first, then any others the posts turned out to be in.
  const cities = useMemo(() => {
    const names = [...trip.regions, ...saves.map((s) => s.region).filter((r) => r && !trip.regions.includes(r))];
    return [...new Set(names)].map((n) => ({ name: n, count: saves.filter((s) => s.region === n).length }))
      .filter((c) => c.count || trip.regions.includes(c.name))
      .sort((a, b) => (a.name === UNSORTED) - (b.name === UNSORTED));
  }, [saves, trip.regions]);

  const inCity = saves.filter((s) => city === 'all' || s.region === city);
  const inCat = inCity.filter((s) => cat === 'all' || s.category === cat);
  const shown = inCat.filter((s) => sub === 'all' || subLabel(s) === sub);
  const subs = useMemo(() => {
    const m = new Map();
    inCat.forEach((s) => m.set(subLabel(s), (m.get(subLabel(s)) || 0) + 1));
    return [...m.entries()].sort((a, b) => (a[0] === '其他') - (b[0] === '其他') || b[1] - a[1]);
  }, [inCat]);

  const chooseSort = (v) => {
    setSort(v); writePref('tripaa_sort', v);
    if (v === 'distance' && !anchor) setAnchorOpen(true);
  };
  const chooseAnchor = (a) => { setAnchor(a); writePref(`tripaa_anchor_${trip.id}`, a); };
  const chooseCat = (c) => { setCat(c); setSub('all'); };

  // 按地区: groups by 种类 (or by category when showing all), cards ordered by area so neighbours sit together.
  const groups = useMemo(() => {
    if (sort !== 'area') return [];
    const key = (s) => (cat === 'all' ? s.category : subLabel(s));
    const m = new Map();
    for (const s of shown) { if (!m.has(key(s))) m.set(key(s), []); m.get(key(s)).push(s); }
    return [...m.entries()]
      .map(([k, list]) => ({
        k,
        title: cat === 'all' ? `${categoryOf(k).emoji} ${categoryOf(k).label}` : `${SUB_EMOJI[k] || '•'} ${k}`,
        list: list.sort((a, b) => `${a.region}${a.area}`.localeCompare(`${b.region}${b.area}`, 'zh')),
      }))
      .sort((a, b) => (cat === 'all'
        ? CATEGORIES.findIndex((c) => c.id === a.k) - CATEGORIES.findIndex((c) => c.id === b.k)
        : (a.k === '其他') - (b.k === '其他') || b.list.length - a.list.length));
  }, [shown, sort, cat]);

  const byDistance = useMemo(() => {
    if (sort !== 'distance' || !anchor) return { near: [], none: shown };
    const withD = shown.map((s) => ({ s, d: km(anchor, s) }));
    return {
      near: withD.filter((x) => x.d != null).sort((a, b) => a.d - b.d),
      none: withD.filter((x) => x.d == null).map((x) => x.s),
    };
  }, [shown, sort, anchor]);

  const unsure = saves.filter((s) => s.unsure);
  const tidy = async () => {
    const list = [...unsure];
    let fixed = 0;
    setTidying({ done: 0, total: list.length });
    for (const [i, s] of list.entries()) {
      try { if (await reanalyzeSave(s, trip)) fixed += 1; } catch { /* keep going */ }
      setTidying({ done: i + 1, total: list.length });
    }
    setTidying(null);
    toast[fixed ? 'success' : 'message'](fixed ? `AI 认出了 ${fixed} 条` : 'AI 还是认不出来，可以点进去手动改名字');
  };

  const openSave = saves.find((s) => s.id === openId) || null;
  const korea = (city === 'all' ? saves : inCity).some((s) => s.geo === 'kakao') || trip.regions.some((r) => /首尔|釜山|济州|庆州|江陵/.test(r));

  return (
    <div className="pt-3 space-y-3">
      {/* City */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar px-4">
        <Chip active={city === 'all'} onClick={() => setCity('all')}>全部 {saves.length}</Chip>
        {cities.map((c) => (
          <Chip key={c.name} active={city === c.name} onClick={() => setCity(c.name)}>{regionEmoji(c.name)} {c.name} {c.count}</Chip>
        ))}
      </div>

      {/* Category */}
      <div className="grid grid-cols-5 gap-1.5 px-4">
        {[{ id: 'all', label: '全部', emoji: '🗂️' }, ...CATEGORIES].map((c) => {
          const n = c.id === 'all' ? inCity.length : inCity.filter((s) => s.category === c.id).length;
          const on = cat === c.id;
          return (
            <button key={c.id} onClick={() => chooseCat(c.id)}
              className={`rounded-2xl border py-2 text-center transition ${on ? 'bg-foreground text-background border-foreground' : 'bg-card border-border'}`}>
              <div className="text-lg leading-none">{c.emoji}</div>
              <div className="text-[11px] font-bold mt-1">{c.label}</div>
              <div className={`text-[10px] ${on ? 'opacity-70' : 'text-muted-foreground'}`}>{n}</div>
            </button>
          );
        })}
      </div>

      {/* 种类 */}
      {cat !== 'all' && subs.length > 1 && (
        <div className="flex gap-1.5 overflow-x-auto no-scrollbar px-4">
          <Chip active={sub === 'all'} onClick={() => setSub('all')}>全部</Chip>
          {subs.map(([name, n]) => (
            <Chip key={name} active={sub === name} onClick={() => setSub(sub === name ? 'all' : name)}>{SUB_EMOJI[name] || ''} {name} {n}</Chip>
          ))}
        </div>
      )}

      {/* Sort */}
      <div className="flex items-center gap-2 px-4">
        <div className="flex rounded-xl bg-muted p-0.5 text-xs font-bold">
          {[['area', '按种类', Layers], ['distance', '按距离', Navigation]].map(([v, label, Icon]) => (
            <button key={v} onClick={() => chooseSort(v)}
              className={`rounded-lg px-3 py-1.5 flex items-center gap-1 ${sort === v ? 'bg-card shadow text-foreground' : 'text-muted-foreground'}`}>
              <Icon className="w-3.5 h-3.5" />{label}
            </button>
          ))}
        </div>
        {sort === 'distance' && (
          <button onClick={() => setAnchorOpen(true)} className="flex-1 min-w-0 flex items-center gap-1 text-xs font-semibold text-primary justify-end">
            <MapPin className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">从：{anchor ? anchor.name : '选一个地方'}</span>
            <ChevronDown className="w-3.5 h-3.5 shrink-0" />
          </button>
        )}
      </div>

      {unsure.length > 0 && (
        <div className="mx-4 rounded-2xl border border-amber-300/70 bg-amber-50 dark:bg-amber-500/10 p-3 flex items-center gap-3">
          <Sparkles className="w-5 h-5 text-amber-500 shrink-0" />
          <p className="flex-1 text-xs">{tidying ? `AI 识别中 ${tidying.done}/${tidying.total}…` : <><b>{unsure.length} 条</b>还没认出店名，让 AI 再看一次？</>}</p>
          <button onClick={tidy} disabled={!!tidying}
            className="shrink-0 rounded-xl bg-amber-500 text-white text-xs font-bold px-3 py-2 flex items-center gap-1 disabled:opacity-70">
            {tidying && <Loader2 className="w-3.5 h-3.5 animate-spin" />}重新识别
          </button>
        </div>
      )}

      {!saves.length ? (
        <Empty emoji="📚" title="把收藏的攻略放进来">
          <p>在 IG、小红书看到想吃想去的，点「分享 → 复制链接」，或直接截图，再按下面的「＋」。AI 会帮你认出店名、分好类、找到位置。</p>
          <button onClick={openCollect} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-bold">
            <Plus className="w-4 h-4" /> 放第一条
          </button>
        </Empty>
      ) : !shown.length ? (
        <Empty emoji="🔍" title="这里还没有东西" />
      ) : sort === 'area' ? (
        <div className="px-4 space-y-5 pt-1">
          {groups.map((g) => (
            <section key={g.k}>
              <h3 className="text-sm font-extrabold mb-2">{g.title} <span className="text-xs font-semibold text-muted-foreground">· {g.list.length}</span></h3>
              <div className="space-y-2">
                {g.list.map((s) => <PlaceCard key={s.id} s={s} state={state} trip={trip} onOpen={setOpenId} />)}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="px-4 space-y-2 pt-1">
          {!anchor && <Empty emoji="🧭" title="先选从哪里算距离"><button onClick={() => setAnchorOpen(true)} className="mt-2 text-primary font-semibold">选一个地方</button></Empty>}
          {anchor && byDistance.near.map(({ s, d }) => <PlaceCard key={s.id} s={s} dist={d} state={state} trip={trip} onOpen={setOpenId} />)}
          {anchor && byDistance.none.length > 0 && (
            <>
              <h3 className="text-xs font-bold text-muted-foreground pt-3">没有位置的 · {byDistance.none.length}（点进去可以重新找位置）</h3>
              {byDistance.none.map((s) => <PlaceCard key={s.id} s={s} state={state} trip={trip} onOpen={setOpenId} />)}
            </>
          )}
        </div>
      )}

      <SaveSheet save={openSave} onClose={() => setOpenId(null)} trip={trip} anchor={sort === 'distance' ? anchor : null} />
      <AnchorSheet open={anchorOpen} onClose={() => setAnchorOpen(false)} onPick={chooseAnchor} korea={korea} />
    </div>
  );
}
