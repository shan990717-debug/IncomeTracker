import React, { useMemo, useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Download, Loader2, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { toPng } from 'html-to-image';
import { actions, ofTrip } from '../lib/store';
import { daysOf, stopsOf, fixedTime } from '../lib/plan';
import { categoryOf } from '../lib/parse';
import { tripFlag } from '../lib/tripInfo';
import { Stars, Chip } from '../components/ui';

/*
 * 旅行报告: a 小红书 carousel (3:4, 1080×1440) made from the trip — where we
 * went each day, the best-rated places, the 避雷 list. Styled like a Canva
 * template; three looks to choose from. Images are made in the browser.
 */

const W = 1080;
const H = 1440;

const THEMES = {
  cream: {
    label: '奶油杂志', bg: '#f6efe4', card: '#fffaf2', ink: '#2b2118', soft: '#8b7a66', accent: '#d9653b', line: '#e6d7c3',
    font: '"Noto Serif SC","Songti SC",serif', titleFont: '"Noto Serif SC","Songti SC",serif',
  },
  pastel: {
    label: '清新拼贴', bg: 'linear-gradient(160deg,#dff3ff 0%,#fde7f1 55%,#fff6d8 100%)', card: 'rgba(255,255,255,.82)', ink: '#1f2a44', soft: '#6b7896', accent: '#ff5d8f', line: '#e3e8f5',
    font: '"PingFang SC","Noto Sans SC",sans-serif', titleFont: '"PingFang SC","Noto Sans SC",sans-serif',
  },
  night: {
    label: '首尔夜景', bg: 'linear-gradient(170deg,#0f1630 0%,#2a1a4a 60%,#4a1f45 100%)', card: 'rgba(255,255,255,.08)', ink: '#f5f3ff', soft: '#b9b3d9', accent: '#ffd166', line: 'rgba(255,255,255,.15)',
    font: '"PingFang SC","Noto Sans SC",sans-serif', titleFont: '"PingFang SC","Noto Sans SC",sans-serif',
  },
};

function Slide({ t, children, n, total, tag }) {
  return (
    <div style={{ width: W, height: H, background: t.bg, color: t.ink, fontFamily: t.font, padding: 90, boxSizing: 'border-box', position: 'relative', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
      {tag && <div style={{ fontSize: 30, letterSpacing: 6, color: t.accent, fontWeight: 700, marginBottom: 24 }}>{tag}</div>}
      {children}
      <div style={{ position: 'absolute', left: 90, right: 90, bottom: 56, display: 'flex', justifyContent: 'space-between', fontSize: 24, color: t.soft }}>
        <span>made with tripaa</span><span>{n} / {total}</span>
      </div>
    </div>
  );
}

const Big = ({ t, children, size = 96 }) => <div style={{ fontFamily: t.titleFont, fontSize: size, fontWeight: 900, lineHeight: 1.15 }}>{children}</div>;

function PlaceRow({ t, s, time }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 26, padding: '22px 0', borderBottom: `2px solid ${t.line}` }}>
      <div style={{ width: 92, fontSize: 30, fontWeight: 800, color: t.accent }}>{time || ''}</div>
      <div style={{ fontSize: 48 }}>{categoryOf(s.category).emoji}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 44, fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.title}</div>
        {(s.review || s.area) && <div style={{ fontSize: 28, color: t.soft, marginTop: 6, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.review || s.area}</div>}
      </div>
      {s.rating > 0 && <div style={{ fontSize: 32, color: t.accent, whiteSpace: 'nowrap' }}>{'★'.repeat(s.rating)}</div>}
    </div>
  );
}

export default function Report() {
  const { state, trip } = useOutletContext();
  const navigate = useNavigate();
  const [themeId, setThemeId] = useState('cream');
  const [title, setTitle] = useState(`${trip.name}｜旅行回顾`);
  const [busy, setBusy] = useState(false);
  const refs = useRef([]);
  const t = THEMES[themeId];

  const saves = ofTrip(state.saves, trip);
  const visitedAny = saves.some((s) => s.visited);
  const went = (s) => s.inPlan && s.planDay && (!visitedAny || s.visited);
  const days = daysOf(trip).map((d, i) => ({ d, i, stops: stopsOf(state, trip, d).filter(went) })).filter((x) => x.stops.length);
  const placesWent = days.flatMap((x) => x.stops);
  const top = [...placesWent].filter((s) => s.rating > 0).sort((a, b) => b.rating - a.rating).slice(0, 6);
  const avoid = [...saves.filter((s) => s.verdict === 'avoid'), ...placesWent.filter((s) => s.rating > 0 && s.rating <= 2)].slice(0, 6);
  const foods = placesWent.filter((s) => s.category === 'food').length;

  const slides = useMemo(() => {
    const list = [];
    list.push({ key: 'cover', render: (n, total) => (
      <Slide t={t} n={n} total={total}>
        <div style={{ fontSize: 120 }}>{tripFlag(trip)}</div>
        <div style={{ marginTop: 40 }}><Big t={t} size={104}>{title}</Big></div>
        <div style={{ fontSize: 40, color: t.soft, marginTop: 30 }}>{daysOf(trip).length ? `${daysOf(trip).length} 天 · ` : ''}{trip.regions.join(' · ')}</div>
        <div style={{ marginTop: 'auto', marginBottom: 80, display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
          {[[daysOf(trip).length, '天'], [placesWent.length, '个地方'], [foods, '家好吃的']].map(([v, l]) => (
            <div key={l} style={{ background: t.card, borderRadius: 36, padding: '40px 0', textAlign: 'center', border: `2px solid ${t.line}` }}>
              <div style={{ fontSize: 96, fontWeight: 900, color: t.accent, lineHeight: 1 }}>{v}</div>
              <div style={{ fontSize: 32, color: t.soft, marginTop: 12 }}>{l}</div>
            </div>
          ))}
        </div>
      </Slide>
    ) });
    days.slice(0, 10).forEach(({ d, i, stops }) => {
      const theme = (state.planDays.find((p) => p.tripId === trip.id && p.day === d)?.summary || '').split('\n').find((l) => l.startsWith('📍'))?.slice(2).trim();
      list.push({ key: d, render: (n, total) => (
        <Slide t={t} n={n} total={total} tag={`DAY ${i + 1}`}>
          <Big t={t} size={84}>{theme || stops[0]?.area || stops[0]?.region || `第 ${i + 1} 天`}</Big>
          <div style={{ marginTop: 40, background: t.card, borderRadius: 40, padding: '20px 44px', border: `2px solid ${t.line}` }}>
            {stops.slice(0, 7).map((s) => <PlaceRow key={s.id} t={t} s={s} time={fixedTime(s)?.time || ''} />)}
            {stops.length > 7 && <div style={{ fontSize: 30, color: t.soft, padding: '20px 0' }}>还有 {stops.length - 7} 个地方…</div>}
          </div>
        </Slide>
      ) });
    });
    if (top.length) list.push({ key: 'top', render: (n, total) => (
      <Slide t={t} n={n} total={total} tag="BEST OF">
        <Big t={t}>最喜欢的 {top.length} 个地方</Big>
        <div style={{ marginTop: 50, background: t.card, borderRadius: 40, padding: '20px 44px', border: `2px solid ${t.line}` }}>
          {top.map((s) => <PlaceRow key={s.id} t={t} s={s} />)}
        </div>
      </Slide>
    ) });
    if (avoid.length) list.push({ key: 'avoid', render: (n, total) => (
      <Slide t={t} n={n} total={total} tag="避雷">
        <Big t={t}>这些可以不用去 👎</Big>
        <div style={{ marginTop: 50, background: t.card, borderRadius: 40, padding: '20px 44px', border: `2px solid ${t.line}` }}>
          {avoid.map((s) => <PlaceRow key={s.id} t={t} s={{ ...s, review: s.review || s.verdictReason }} />)}
        </div>
      </Slide>
    ) });
    return list;
  }, [t, title, trip, days, top, avoid, placesWent, foods, state.planDays]); // eslint-disable-line react-hooks/exhaustive-deps

  const save = async () => {
    setBusy(true);
    try {
      const files = [];
      for (const [i, el] of refs.current.slice(0, slides.length).entries()) {
        const url = await toPng(el, { width: W, height: H, pixelRatio: 1, cacheBust: true, style: { transform: 'none' } });
        const blob = await (await fetch(url)).blob();
        files.push(new File([blob], `${trip.name}-${String(i + 1).padStart(2, '0')}.png`, { type: 'image/png' }));
      }
      // Phone: the share sheet can save straight to Photos. Otherwise download one by one.
      if (navigator.canShare?.({ files })) await navigator.share({ files, title });
      else files.forEach((f) => { const a = document.createElement('a'); a.href = URL.createObjectURL(f); a.download = f.name; a.click(); });
      toast.success(`${files.length} 张图片好了`);
    } catch (e) { if (e?.name !== 'AbortError') toast.error(`没能生成图片：${e.message}`); }
    setBusy(false);
  };

  const scale = (Math.min(window.innerWidth || 390, 512) - 32) / W;

  return (
    <div className="px-4 pt-3 pb-6 space-y-4">
      <button onClick={() => navigate(`/t/${trip.id}`)} className="text-xs font-semibold text-muted-foreground flex items-center"><ChevronLeft className="w-4 h-4" />总览</button>
      <div>
        <h2 className="text-lg font-extrabold">📸 旅行报告</h2>
        <p className="text-xs text-muted-foreground">做成小红书比例（3:4）的多张图片，可以存进相册直接发。{!visitedAny && '还没有打勾「去过」的地方，先用行程里的地点。'}</p>
      </div>

      <input value={title} onChange={(e) => setTitle(e.target.value)} aria-label="封面标题" className="w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm font-bold" />
      <div className="flex gap-1.5">{Object.entries(THEMES).map(([id, x]) => <Chip key={id} active={themeId === id} onClick={() => setThemeId(id)}>{x.label}</Chip>)}</div>

      {placesWent.length > 0 && (
        <details className="rounded-2xl border border-border bg-card p-3">
          <summary className="text-sm font-bold cursor-pointer">⭐ 给去过的地方打分、写一句（{placesWent.filter((s) => s.rating).length}/{placesWent.length}）</summary>
          <div className="divide-y divide-border mt-2">
            {placesWent.map((s) => (
              <div key={s.id} className="py-2 space-y-1">
                <div className="flex items-center gap-2"><span className="flex-1 text-sm font-semibold truncate">{s.title}</span><Stars value={s.rating || 0} onChange={(v) => actions.updateSave(s.id, { rating: v })} size="w-4 h-4" /></div>
                <input defaultValue={s.review || ''} onBlur={(e) => e.target.value !== (s.review || '') && actions.updateSave(s.id, { review: e.target.value })}
                  placeholder="一句心得（会放进报告）" className="w-full rounded-lg border border-input bg-background px-2 py-1.5 text-[13px]" />
              </div>
            ))}
          </div>
        </details>
      )}

      {!placesWent.length ? (
        <p className="text-sm text-muted-foreground text-center py-8">行程里还没有地点，排好行程、去过打勾后再来生成。</p>
      ) : (
        <>
          <div className="space-y-3">
            {slides.map((sl, i) => (
              <div key={sl.key} className="rounded-2xl overflow-hidden shadow border border-border" style={{ width: W * scale, height: H * scale }}>
                <div ref={(el) => { refs.current[i] = el; }} style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
                  {sl.render(i + 1, slides.length)}
                </div>
              </div>
            ))}
          </div>
          <button onClick={save} disabled={busy} className="sticky bottom-24 w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-bold flex items-center justify-center gap-2 shadow-lg disabled:opacity-60">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}{busy ? '正在生成图片…' : `存 ${slides.length} 张图片`}
          </button>
        </>
      )}
    </div>
  );
}
