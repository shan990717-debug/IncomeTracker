import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Plus, Check, Loader2, Sparkles, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import { actions, ofTrip, norm, getState } from '../lib/store';
import { fetchMustList } from '../lib/ai';
import { categoryOf } from '../lib/parse';
import { daysOf, dayTitle } from '../lib/plan';
import { Chip, Empty, Sheet } from '../components/ui';

const COUNTRY = (city) => (/首尔|釜山|济州|庆州|江陵|全州|仁川/.test(city) ? '韩国' : /东京|大阪|京都|北海道|札幌|福冈|冲绳|名古屋/.test(city) ? '日本' : '');

/**
 * 攻略库 → 🌟 必去推荐: the well-known must-sees per city (no post needed),
 * generated once per city and shared. ＋ puts a place in 攻略库 like any
 * collected post; a classic route can go into one day in one tap.
 */
export default function Must() {
  const { state, trip } = useOutletContext();
  const [city, setCity] = useState(trip.regions[0] || '');
  const [busy, setBusy] = useState('');
  const [routeFor, setRouteFor] = useState(null);
  const list = state.mustLists.find((m) => m.tripId === trip.id && m.city === city)?.data;
  // Read the store directly: adding a whole route needs the cards it just created.
  const existing = (p) => ofTrip(getState().saves, trip).find((s) => (p.nameLocal && norm(s.nameLocal) === norm(p.nameLocal)) || norm(s.title) === norm(p.name));

  const load = async (c) => {
    setBusy(c);
    try {
      const data = await fetchMustList(c, COUNTRY(c));
      if (!data.places?.length) throw new Error('AI 没有列出地点，稍后再试');
      actions.setMustList(trip.id, c, data);
    } catch (e) { toast.error(e.message || 'AI 暂时连不上'); }
    setBusy('');
  };

  /** Put a recommended place in 攻略库 (or return the one already there). Returns its id. */
  const add = (p) => {
    const have = existing(p);
    if (have) return have.id;
    actions.addSaves(trip.id, [{
      title: p.name, nameLocal: p.nameLocal, region: city, area: p.area, country: COUNTRY(city), category: p.category || 'place',
      subtype: p.subtype, note: p.tip, lat: p.lat, lng: p.lng, address: p.address, geo: p.geo, placeUrl: p.placeUrl,
      platform: 'AI 推荐', url: '', verdict: 'recommend', ai: true, unsure: false,
    }]);
    return existing(p)?.id || null;
  };
  const addRoute = (route, day) => {
    const byName = new Map((list.places || []).map((p) => [p.name, p]));
    route.stops.forEach((name) => {
      const p = byName.get(name);
      if (!p) return;
      add(p);
      const id = existing(p)?.id;
      if (id && day != null) actions.addToPlan(id, day);
    });
    toast.success(day ? `已放进 ${dayTitle(trip, day)}` : '已放进攻略库');
    setRouteFor(null);
  };

  return (
    <div className="pt-3 px-4 space-y-3 pb-4">
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar -mx-4 px-4">
        {trip.regions.map((c) => <Chip key={c} active={city === c} onClick={() => setCity(c)}>{c}</Chip>)}
      </div>
      {!city ? <Empty emoji="🗺️" title="先在旅行设定加城市" /> : !list ? (
        <Empty emoji="🌟" title={`${city} 的必去景点`}>
          <p>不用另外找贴文的经典（例如景福宫），AI 列出来，大家共用，每个城市只读一次。</p>
          <button onClick={() => load(city)} disabled={!!busy} className="mt-4 inline-flex items-center gap-2 rounded-xl bg-violet-600 text-white px-5 py-2.5 text-sm font-bold disabled:opacity-60">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}{busy ? 'AI 正在列…' : `列出 ${city} 必去`}
          </button>
        </Empty>
      ) : (
        <>
          {(list.routes || []).map((r) => (
            <div key={r.title} className="rounded-2xl bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-500/20 dark:to-amber-600/20 p-3">
              <p className="text-sm font-extrabold">🚶 {r.title}</p>
              <p className="text-[11px] text-amber-900 dark:text-amber-200 mt-1">{r.duration} · {r.tip}</p>
              <div className="flex gap-2 mt-2">
                <button onClick={() => setRouteFor(r)} className="rounded-lg bg-foreground text-background px-3 py-1.5 text-xs font-bold">整条放进某一天 ›</button>
                <button onClick={() => addRoute(r, null)} className="rounded-lg bg-white/70 dark:bg-white/10 px-3 py-1.5 text-xs font-bold">只加进攻略库</button>
              </div>
            </div>
          ))}
          <p className="text-xs font-bold text-muted-foreground">必去景点（点 ＋ 放进攻略库，再点一次拿掉）</p>
          {(list.places || []).map((p) => {
            const have = existing(p);
            return (
              <div key={p.name} className="rounded-2xl border border-border bg-card p-3 flex items-center gap-3">
                <span className="w-10 h-10 rounded-xl bg-muted flex items-center justify-center text-xl shrink-0">{categoryOf(p.category).emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">{p.name} {p.nameLocal && <span className="text-[11px] font-normal text-muted-foreground">{p.nameLocal}</span>}</p>
                  <p className="text-[11px] text-muted-foreground">{[p.subtype, p.area].filter(Boolean).join(' · ')}{p.tip && ` · ${p.tip}`}</p>
                </div>
                {have && have.platform !== 'AI 推荐' ? (
                  // Collected from a post earlier: not ours to remove here.
                  <button onClick={() => toast(`攻略库里已经有「${have.title}」（你收的贴文），要改去攻略库`)}
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold ${have.verdict === 'avoid' ? 'bg-destructive/10 text-destructive' : 'bg-muted text-muted-foreground'}`}>
                    {have.verdict === 'avoid' ? '👎 避雷' : '已收藏'}
                  </button>
                ) : (
                  <button aria-label={have ? `拿掉 ${p.name}` : `加 ${p.name}`}
                    onClick={() => {
                      if (!have) { add(p); toast.success(`已加：${p.name}`); return; }
                      if (have.inPlan && !window.confirm(`「${p.name}」已经排进行程，确定拿掉？`)) return;
                      actions.deleteSave(have.id); toast(`已拿掉：${p.name}`);
                    }}
                    className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${have ? 'bg-primary text-primary-foreground' : 'border-2 border-border text-muted-foreground'}`}>
                    {have ? <Check className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                  </button>
                )}
              </div>
            );
          })}
          <button onClick={() => { if (window.confirm(`让 AI 重新列 ${city} 的必去？（已加进攻略库的不会动）`)) load(city); }} disabled={!!busy}
            className="w-full text-xs font-semibold text-muted-foreground flex items-center justify-center gap-1 py-2">
            {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />} 重新列一次
          </button>
        </>
      )}

      <Sheet open={!!routeFor} onClose={() => setRouteFor(null)} title="整条放哪一天？">
        <div className="space-y-2 pb-2">
          {!daysOf(trip).length && <p className="text-xs text-muted-foreground">旅行还没设定日期，会先放进「待安排」。</p>}
          {daysOf(trip).map((d) => (
            <button key={d} onClick={() => addRoute(routeFor, d)} className="w-full rounded-2xl border border-border bg-card p-3 text-left text-sm font-bold">{dayTitle(trip, d)}</button>
          ))}
          <button onClick={() => addRoute(routeFor, '')} className="w-full rounded-2xl border border-dashed border-border p-3 text-left text-sm font-bold">先放「待安排」</button>
        </div>
      </Sheet>
    </div>
  );
}
