import React, { useEffect, useRef, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Download, Loader2, ChevronLeft, ImagePlus, X } from 'lucide-react';
import { toast } from 'sonner';
import { toPng } from 'html-to-image';
import '@fontsource/playfair-display/latin-400.css';
import '@fontsource/playfair-display/latin-400-italic.css';
import '@fontsource/caveat/latin-500.css';
import '@fontsource/courier-prime/latin-400.css';
import '@fontsource/courier-prime/latin-700.css';
import { actions, ofTrip } from '../lib/store';
import { daysOf, stopsOf } from '../lib/plan';
import { categoryOf } from '../lib/parse';
import { ofTripBookings } from '../lib/bookings';
import { countryOf } from '../lib/autoPlan';
import { loadPhotos, savePhotos, shrink } from '../lib/photos';
import { Stars, Chip } from '../components/ui';

/*
 * 旅行报告: a 小红书 carousel (3:4, 1080×1440) sharing the trip — cover, one
 * page per day, favourites, 避雷, and a closing page. Three looks inspired by
 * travel-recap templates (film journal, torn-paper collage, big-type poster).
 * No dates: it's an itinerary to share. Photos stay on the phone.
 */

const W = 1080;
const H = 1440;
const ZH_SERIF = '"Songti SC","STSong","Noto Serif SC","Noto Serif CJK SC",serif';
const SANS = '"PingFang SC","Noto Sans SC","Noto Sans CJK SC",sans-serif';
const PLAY = `"Playfair Display",${ZH_SERIF}`;
const MONO = `"Courier Prime",${SANS}`;
const HAND = `"Caveat",${SANS}`;
const NUM = ['One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen'];
const STYLES = [['film', '胶片手帐'], ['torn', '撕纸拼贴'], ['poster', '大字海报']];

const abs = (style) => ({ position: 'absolute', ...style });
const Photo = ({ src, style, fallback = 'linear-gradient(135deg,#cbbfa8,#8e9a8a)' }) => (
  <div style={{ backgroundImage: src ? `url(${src})` : fallback, backgroundSize: 'cover', backgroundPosition: 'center', ...style }} />
);
const Tape = ({ style }) => <div style={abs({ width: 184, height: 56, background: 'rgba(232,226,200,.88)', boxShadow: '0 2px 4px rgba(0,0,0,.15)', ...style })} />;
const Polaroid = ({ src, style }) => (
  <div style={abs({ background: '#f4f2ec', padding: '20px 20px 68px', boxShadow: '0 16px 36px rgba(0,0,0,.35)', ...style })}><Photo src={src} style={{ width: '100%', height: '100%' }} /></div>
);
const TORN = 'polygon(0 4%,6% 0,14% 3%,22% 0,31% 4%,40% 1%,49% 4%,58% 0,67% 3%,76% 0,85% 4%,93% 1%,100% 3%,98% 50%,100% 97%,92% 100%,83% 96%,74% 100%,65% 97%,56% 100%,47% 96%,38% 100%,29% 97%,20% 100%,11% 96%,3% 100%,0 96%,2% 50%)';
const Torn = ({ style, children, bg = '#f3f1ea' }) => (
  <div style={abs({ filter: 'drop-shadow(0 12px 18px rgba(0,0,0,.25))', ...style })}>
    <div style={{ background: bg, clipPath: TORN, width: '100%', height: '100%', padding: style.padding || 0, boxSizing: 'border-box', position: 'relative' }}>{children}</div>
  </div>
);
const Sun = ({ style, color = '#f7ef3a' }) => (
  <svg style={abs(style)} width="112" height="112" viewBox="0 0 56 56"><g stroke={color} strokeWidth="2.2">
    {[[28, 0, 28, 56], [0, 28, 56, 28], [8, 8, 48, 48], [48, 8, 8, 48], [17, 2, 39, 54], [39, 2, 17, 54], [2, 17, 54, 39], [2, 39, 54, 17]].map(([a, b, c, d]) => <line key={`${a}${b}`} x1={a} y1={b} x2={c} y2={d} />)}
  </g></svg>
);
const Page = ({ children, bg = '#222' }) => <div style={{ width: W, height: H, position: 'relative', overflow: 'hidden', background: bg, fontFamily: SANS }}>{children}</div>;
const stars = (n) => (n ? '★'.repeat(n) : '');
const line = (s) => [s.title, stars(s.rating), s.review || s.note].filter(Boolean).join('  ');

/* ---------- ① 胶片手帐 ---------- */
const film = {
  cover: (d) => (
    <Page>
      <Photo src={d.cover} style={abs({ inset: 0 })} />
      <div style={abs({ inset: 0, background: 'linear-gradient(180deg,rgba(0,0,0,.25),rgba(40,20,10,.12) 40%,rgba(30,15,5,.6))' })} />
      <div style={abs({ left: 80, top: 76, color: '#f6efcf', fontWeight: 900, letterSpacing: 4, fontSize: 34 })}>{d.label}</div>
      <Polaroid src={d.pics[0]} style={{ right: 68, top: 140, width: 444, height: 356, transform: 'rotate(3deg)' }} />
      <Tape style={{ right: 220, top: 116, transform: 'rotate(-6deg)' }} />
      <div style={abs({ left: 116, top: 300, width: 224, padding: '16px 18px', background: '#f3ecc7', transform: 'rotate(-10deg)', boxShadow: '0 16px 36px rgba(0,0,0,.35)', display: 'flex', flexDirection: 'column', gap: 14 })}>
        {[1, 2, 3].map((i) => <Photo key={i} src={d.pics[i]} style={{ height: 180 }} />)}
      </div>
      <Tape style={{ left: 140, top: 276, transform: 'rotate(-14deg)', width: 160 }} />
      {d.flight && (
        <div style={abs({ left: 76, bottom: 112, width: 300, height: 400, background: '#f3ecc7', transform: 'rotate(-4deg)', padding: 24, color: '#5d6a2a', fontFamily: MONO, boxShadow: '0 12px 28px rgba(0,0,0,.3)' })}>
          <div style={{ fontWeight: 700, fontSize: 40, lineHeight: 1 }}>BOARDING<br />PASS</div>
          <div style={{ fontSize: 22, marginTop: 20 }}>FLIGHT</div><div style={{ fontSize: 36, fontWeight: 700 }}>{d.flight.number || '—'}</div>
          <div style={{ fontSize: 22, marginTop: 12 }}>{d.flight.from} → {d.flight.to}</div>
          <div style={{ borderTop: '4px dotted #5d6a2a', margin: '16px 0' }} /><div style={{ fontSize: 22 }}>{d.flight.seats ? `SEAT ${d.flight.seats}` : 'HAVE A NICE TRIP'}</div>
          <div style={{ height: 44, marginTop: 16, background: 'repeating-linear-gradient(90deg,#333 0 4px,transparent 4px 8px,#333 8px 10px,transparent 10px 16px)' }} />
        </div>
      )}
      <div style={abs({ left: 410, top: 540, fontSize: 92, color: '#f5edc8' })}>✦</div>
      <div style={abs({ right: 76, bottom: 104, textAlign: 'right', color: '#f6efcf' })}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, justifyContent: 'flex-end', fontWeight: 900, fontSize: 30, letterSpacing: 3 }}><span style={{ width: 160, height: 4, background: '#f6efcf' }} />PHOTO JOURNAL</div>
        <div style={{ fontFamily: ZH_SERIF, fontSize: 124, fontWeight: 900, lineHeight: 1.1, marginTop: 12 }}>{d.title}</div>
        <div style={{ fontFamily: PLAY, fontSize: 148, lineHeight: 0.95 }}>Travel</div>
        <div style={{ fontFamily: PLAY, fontSize: 160, fontStyle: 'italic', lineHeight: 1 }}>Recap</div>
      </div>
    </Page>
  ),
  day: (d, x) => (
    <Page>
      <Photo src={x.pics[0]} style={abs({ inset: 0 })} />
      <div style={abs({ inset: 0, background: 'linear-gradient(180deg,rgba(0,0,0,.15) 28%,rgba(10,8,5,.88) 68%)' })} />
      <div style={abs({ left: 80, top: 72, color: '#f6efcf', fontWeight: 900, letterSpacing: 4, fontSize: 28 })}>{d.label}</div>
      {x.pics[1] && <><Polaroid src={x.pics[1]} style={{ right: 80, top: 180, width: 340, height: 300, transform: 'rotate(5deg)' }} /><Tape style={{ right: 168, top: 160, transform: 'rotate(8deg)', width: 140 }} /></>}
      <div style={abs({ left: 80, right: 80, bottom: 92, color: '#f6efcf' })}>
        <div style={{ fontSize: 28, letterSpacing: 6, fontWeight: 900, textAlign: 'center' }}>DAY {(NUM[x.i] || x.i + 1).toString().toUpperCase()}</div>
        <div style={{ fontFamily: ZH_SERIF, fontSize: 112, fontWeight: 900, textAlign: 'center', lineHeight: 1.1, marginTop: 8 }}>{x.theme}</div>
        <div style={{ fontFamily: PLAY, fontSize: 80, fontStyle: 'italic', textAlign: 'center', lineHeight: 1 }}>day {(NUM[x.i] || x.i + 1).toString().toLowerCase()}</div>
        <div style={{ fontSize: 34, lineHeight: 1.75, marginTop: 32 }}>{x.stops.slice(0, 6).map((s) => <div key={s.id} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{categoryOf(s.category).emoji} {line(s)}</div>)}</div>
      </div>
    </Page>
  ),
  list: (d, { tag, title, items, pic }) => (
    <Page bg="#2b2118">
      <Photo src={pic} style={abs({ inset: 0, opacity: 0.55 })} />
      <div style={abs({ inset: 0, background: 'linear-gradient(180deg,rgba(20,12,6,.55),rgba(20,12,6,.9))' })} />
      <div style={abs({ left: 80, right: 80, top: 120, color: '#f6efcf' })}>
        <div style={{ fontSize: 30, letterSpacing: 6, fontWeight: 900 }}>{tag}</div>
        <div style={{ fontFamily: ZH_SERIF, fontSize: 104, fontWeight: 900, lineHeight: 1.15, marginTop: 16 }}>{title}</div>
        <div style={{ marginTop: 56, fontSize: 40, lineHeight: 1.8 }}>{items.map((s) => <div key={s.id} style={{ borderBottom: '2px solid rgba(246,239,207,.25)', padding: '10px 0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{categoryOf(s.category).emoji} {line(s)}</div>)}</div>
      </div>
    </Page>
  ),
};

/* ---------- ② 撕纸拼贴 ---------- */
const torn = {
  cover: (d) => (
    <Page bg="#dfe5e8">
      <Photo src={d.cover} style={abs({ inset: 0 })} />
      <div style={abs({ inset: 0, background: 'linear-gradient(180deg,rgba(223,229,232,.92) 0%,rgba(223,229,232,.55) 32%,transparent 58%)' })} />
      <Torn style={{ left: 60, top: 400, width: 960, height: 420, transform: 'rotate(-2deg)', padding: '76px 60px 0 112px' }}>
        <div style={{ fontFamily: ZH_SERIF, fontSize: Math.min(100, Math.floor(760 / Math.max(1, d.title2.length))), fontWeight: 700, letterSpacing: 4, color: '#3a2f1e', whiteSpace: 'nowrap' }}>{d.title2}</div>
        <div style={{ fontFamily: MONO, fontSize: 30, marginTop: 24, lineHeight: 1.6, color: '#3a2f1e' }}>{d.routes.map((r) => <div key={r}>{r}</div>)}</div>
      </Torn>
      <svg style={abs({ left: 124, top: 356 })} width="52" height="140" viewBox="0 0 26 70"><path d="M8 62V12a6 6 0 0 1 12 0v44a9 9 0 0 1-18 0V18" fill="none" stroke="#9aa0a6" strokeWidth="3.5" /></svg>
      <Torn bg="#f0ecd9" style={{ left: 300, top: 790, width: 660, height: 156, transform: 'rotate(-4deg)', padding: '32px 44px' }}>
        <div style={{ fontFamily: HAND, fontSize: 54, color: '#3a2f1e', lineHeight: 1.05 }}>{d.hand}</div>
      </Torn>
      <div style={abs({ right: 60, top: 736, background: '#b88b5e', color: '#fff', fontFamily: MONO, fontWeight: 700, fontSize: 34, padding: '16px 24px', transform: 'rotate(-14deg)', lineHeight: 1.3 })}>{d.days} Days<br />{Math.max(0, d.days - 1)} Nights</div>
      <div style={abs({ left: 208, top: 744, fontSize: 112, color: '#5a4a32', transform: 'rotate(10deg)' })}>✶</div>
      <div style={abs({ right: 104, top: 372, fontSize: 84, color: '#b88b5e' })}>✷</div>
    </Page>
  ),
  day: (d, x) => (
    <Page bg="#c5cbc2">
      <Polaroid src={x.pics[0]} style={{ left: 52, top: 60, width: 460, height: 400, transform: 'rotate(-5deg)' }} />
      <Polaroid src={x.pics[1] || d.pics[x.i + 1]} style={{ right: 48, top: 132, width: 460, height: 372, transform: 'rotate(4deg)' }} />
      <Tape style={{ left: 220, top: 44, transform: 'rotate(-4deg)' }} /><Tape style={{ right: 192, top: 112, transform: 'rotate(6deg)' }} />
      <Torn style={{ left: 68, top: 540, width: 940, height: 580, transform: 'rotate(1.5deg)', padding: '68px 68px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 28, color: '#3a2f1e' }}><span style={{ fontFamily: PLAY, fontSize: 84 }}>Day {x.i + 1}</span><span style={{ fontFamily: ZH_SERIF, fontSize: 60, fontWeight: 700 }}>{x.theme}</span></div>
        <div style={{ fontFamily: MONO, fontSize: 32, lineHeight: 1.85, marginTop: 24, color: '#3a2f1e' }}>{x.stops.slice(0, 7).map((s) => <div key={s.id} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>• {line(s)}</div>)}</div>
      </Torn>
      {x.pics[2] && <Polaroid src={x.pics[2]} style={{ left: 300, bottom: 40, width: 400, height: 280, transform: 'rotate(-3deg)' }} />}
      <div style={abs({ right: 112, bottom: 120, fontSize: 88, color: '#5a4a32' })}>✶</div>
    </Page>
  ),
  list: (d, { tag, title, items, pic }) => (
    <Page bg="#c5cbc2">
      <Polaroid src={pic} style={{ left: 300, top: 60, width: 480, height: 400, transform: 'rotate(-3deg)' }} />
      <Tape style={{ left: 450, top: 44, transform: 'rotate(3deg)' }} />
      <Torn style={{ left: 68, top: 520, width: 940, height: 820, transform: 'rotate(-1deg)', padding: '72px 72px' }}>
        <div style={{ fontFamily: PLAY, fontSize: 52, fontStyle: 'italic', color: '#b88b5e' }}>{tag}</div>
        <div style={{ fontFamily: ZH_SERIF, fontSize: 80, fontWeight: 700, color: '#3a2f1e', marginTop: 8 }}>{title}</div>
        <div style={{ fontFamily: MONO, fontSize: 32, lineHeight: 1.9, marginTop: 30, color: '#3a2f1e' }}>{items.map((s) => <div key={s.id} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>• {line(s)}</div>)}</div>
      </Torn>
    </Page>
  ),
};

/* ---------- ④ 大字海报 ---------- */
const Y = '#f7ef3a';
const poster = {
  cover: (d) => (
    <Page>
      <Photo src={d.cover} style={abs({ inset: 0 })} />
      <div style={abs({ inset: 0, background: 'linear-gradient(180deg,rgba(0,30,60,.35),transparent 50%)' })} />
      <Sun style={{ left: 484, top: 112 }} />
      <div style={abs({ left: 0, right: 0, top: 260, textAlign: 'center', color: Y, textShadow: '0 4px 24px rgba(0,0,0,.25)' })}>
        <div style={{ fontFamily: ZH_SERIF, fontSize: 148, fontWeight: 900, lineHeight: 1.05 }}>{d.cities}</div>
        <div style={{ fontFamily: PLAY, fontSize: 148, fontStyle: 'italic', lineHeight: 1.05 }}>Travel Diary</div>
        <div style={{ display: 'inline-block', marginTop: 36, border: `4px solid ${Y}`, borderRadius: 80, padding: '16px 52px', fontWeight: 900, fontSize: 44 }}>{d.title} · 吃喝玩乐全记录</div>
      </div>
    </Page>
  ),
  day: (d, x) => (
    <Page>
      <Photo src={x.pics[0]} style={abs({ inset: 0 })} />
      <div style={abs({ inset: 0, background: 'linear-gradient(180deg,transparent 40%,rgba(0,20,40,.7))' })} />
      <div style={abs({ left: 80, top: 80, border: `3px solid ${Y}`, color: Y, borderRadius: 40, padding: '4px 24px', fontSize: 28 })}>{String(x.i + 1).padStart(2, '0')}</div>
      <div style={abs({ left: 80, right: 80, bottom: 110, color: Y })}>
        <div style={{ fontFamily: PLAY, fontSize: 76, fontStyle: 'italic', lineHeight: 1 }}>Day {NUM[x.i] || x.i + 1}</div>
        <div style={{ fontFamily: ZH_SERIF, fontSize: 120, fontWeight: 900, lineHeight: 1.1, marginTop: 8 }}>{x.theme}</div>
        <div style={{ height: 4, background: Y, marginTop: 30, opacity: 0.7 }} />
        <div style={{ fontSize: 34, marginTop: 22, color: '#fffbd0', lineHeight: 1.6 }}>{x.stops.slice(0, 5).map((s) => s.title).join(' · ')}</div>
      </div>
    </Page>
  ),
  list: (d, { tag, title, items, pic }) => (
    <Page>
      <Photo src={pic} style={abs({ inset: 0 })} />
      <div style={abs({ inset: 0, background: 'linear-gradient(180deg,rgba(0,20,40,.2),rgba(0,20,40,.78) 55%)' })} />
      <div style={abs({ left: 80, right: 80, bottom: 110, color: Y })}>
        <div style={{ fontSize: 36, fontWeight: 900, letterSpacing: 4 }}>{tag}</div>
        <div style={{ fontFamily: ZH_SERIF, fontSize: 104, fontWeight: 900, lineHeight: 1.1, marginTop: 10 }}>{title}</div>
        <div style={{ height: 4, background: Y, margin: '30px 0', opacity: 0.7 }} />
        <div style={{ fontSize: 38, lineHeight: 1.7, color: '#fffbd0' }}>{items.map((s) => <div key={s.id} style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{line(s)}</div>)}</div>
      </div>
    </Page>
  ),
};
const LOOKS = { film, torn, poster };

/** The closing page, shared by all looks. */
const ending = (look, d) => look.list(d, { tag: 'SAVE THIS', title: '存起来，下次照着玩', items: d.wishlist, pic: d.pics[d.pics.length - 1] || d.cover });

const ENG = { 韩国: 'KOREA', 日本: 'JAPAN' };

export default function Report() {
  const { state, trip } = useOutletContext();
  const navigate = useNavigate();
  const [styleId, setStyleId] = useState('film');
  const [title, setTitle] = useState('');
  const [photos, setPhotos] = useState({ cover: '', days: {} });
  const [busy, setBusy] = useState(false);
  const refs = useRef([]);
  const coverInput = useRef(null);
  const dayInput = useRef(null);
  const [pickDay, setPickDay] = useState('');
  useEffect(() => { loadPhotos(trip.id).then(setPhotos); }, [trip.id]);
  const updatePhotos = (fn) => setPhotos((p) => { const n = fn(p); savePhotos(trip.id, n); return n; });

  const saves = ofTrip(state.saves, trip);
  const visitedAny = saves.some((s) => s.visited);
  const went = (s) => s.inPlan && s.planDay && (!visitedAny || s.visited);
  const allDays = daysOf(trip);
  const days = allDays.map((d, i) => {
    const stops = stopsOf(state, trip, d).filter(went);
    const theme = (state.planDays.find((p) => p.tripId === trip.id && p.day === d)?.summary || '').split('\n').find((l) => l.startsWith('📍'))?.slice(2).trim();
    return { d, i, stops, theme: theme || stops[0]?.area || stops[0]?.region || `第 ${i + 1} 天`, pics: photos.days[d] || [] };
  }).filter((x) => x.stops.length);
  const placesWent = days.flatMap((x) => x.stops);
  const top = [...placesWent].filter((s) => s.rating >= 4).sort((a, b) => b.rating - a.rating).slice(0, 6);
  const avoid = [...saves.filter((s) => s.verdict === 'avoid'), ...placesWent.filter((s) => s.rating > 0 && s.rating <= 2)].slice(0, 6);
  const country = countryOf(trip.regions[0] || '');
  const n = allDays.length;
  const flight = ofTripBookings(state, trip).find((b) => b.kind === 'flight');
  const allPics = [photos.cover, ...days.flatMap((x) => x.pics)].filter(Boolean);
  const data = {
    label: `${ENG[country] || 'MY'} TRIP ${(trip.startDate || '').slice(0, 4)}`.trim(),
    title: title || (n ? `${n}天${Math.max(0, n - 1)}夜` : trip.name),
    title2: `${trip.regions.slice(0, 2).join('·')}行程`,
    cities: trip.regions.slice(0, 2).join(' · ') || trip.name,
    days: n,
    routes: trip.regions.slice(0, 3).map((r) => [r, ...[...new Set(placesWent.filter((s) => s.region === r).map((s) => s.area).filter(Boolean))].slice(0, 3)].join(' — ')),
    hand: 'eat, wander, repeat ~',
    cover: photos.cover || allPics[0] || '',
    pics: allPics.slice(1).length ? allPics.slice(1) : allPics,
    flight: flight && { number: flight.number, from: flight.from?.code || flight.from?.name || '', to: flight.to?.code || flight.to?.name || '', seats: flight.seats },
    wishlist: saves.filter((s) => s.verdict !== 'avoid' && !went(s)).slice(0, 6),
  };
  const look = LOOKS[styleId];
  const slides = [
    { key: 'cover', node: look.cover(data) },
    ...days.slice(0, 12).map((x) => ({ key: x.d, node: look.day(data, x) })),
    ...(top.length ? [{ key: 'top', node: look.list(data, { tag: 'BEST OF', title: `最喜欢的 ${top.length} 个地方`, items: top, pic: days[0]?.pics[0] || data.cover }) }] : []),
    ...(avoid.length ? [{ key: 'avoid', node: look.list(data, { tag: '👎 避雷', title: '这些可以不用去', items: avoid.map((s) => ({ ...s, review: s.review || s.verdictReason })), pic: data.pics[1] || data.cover }) }] : []),
    ...(data.wishlist.length ? [{ key: 'end', node: ending(look, data) }] : []),
  ];

  const pickCover = async (f) => { if (!f) return; const url = await shrink(f); updatePhotos((p) => ({ ...p, cover: url })); };
  const pickDayPhotos = async (files) => {
    const urls = await Promise.all([...files].slice(0, 4).map((f) => shrink(f)));
    updatePhotos((p) => ({ ...p, days: { ...p.days, [pickDay]: [...(p.days[pickDay] || []), ...urls].slice(0, 4) } }));
  };

  const save = async () => {
    setBusy(true);
    try {
      const files = [];
      for (const [i, el] of refs.current.slice(0, slides.length).entries()) {
        // Capture the full-size slide, not the scaled preview.
        const url = await toPng(el, { width: W, height: H, pixelRatio: 1, style: { transform: 'none' } });
        const blob = await (await fetch(url)).blob();
        files.push(new File([blob], `${trip.name}-${String(i + 1).padStart(2, '0')}.png`, { type: 'image/png' }));
      }
      // Phone: the share sheet saves straight to Photos. Otherwise download each.
      if (navigator.canShare?.({ files })) await navigator.share({ files, title: data.title });
      else {
        for (const f of files) {
          const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(f), download: f.name });
          document.body.appendChild(a); a.click(); a.remove();
          await new Promise((r) => setTimeout(r, 300));
        }
      }
      toast.success(`${files.length} 张图片好了`);
    } catch (e) { if (e?.name !== 'AbortError') toast.error(`没能生成图片：${e?.message || e}`); }
    setBusy(false);
  };

  const scale = (Math.min(window.innerWidth || 390, 512) - 32) / W;

  return (
    <div className="px-4 pt-3 pb-6 space-y-4">
      <button onClick={() => navigate(`/t/${trip.id}`)} className="text-xs font-semibold text-muted-foreground flex items-center"><ChevronLeft className="w-4 h-4" />总览</button>
      <div>
        <h2 className="text-lg font-extrabold">📸 旅行报告</h2>
        <p className="text-xs text-muted-foreground">做成小红书比例（3:4）的多张图片，存进相册直接发。照片只存在这支手机，不会上传。{!visitedAny && '还没有打勾「去过」的地方，先用行程里的地点。'}</p>
      </div>

      <div className="flex gap-1.5">{STYLES.map(([id, label]) => <Chip key={id} active={styleId === id} onClick={() => setStyleId(id)}>{label}</Chip>)}</div>
      <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={`封面标题（默认「${data.title}」）`} aria-label="封面标题" className="w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm font-bold" />

      <div className="rounded-2xl border border-border bg-card p-3 space-y-2">
        <p className="text-sm font-bold">🖼 照片</p>
        <div className="flex items-center gap-2">
          <span className="text-xs w-14 shrink-0 text-muted-foreground">封面</span>
          {photos.cover && <img src={photos.cover} alt="" className="w-12 h-16 rounded object-cover" />}
          <button onClick={() => coverInput.current?.click()} className="rounded-lg border border-border px-3 py-1.5 text-xs font-bold flex items-center gap-1"><ImagePlus className="w-3.5 h-3.5" />{photos.cover ? '换一张' : '选封面照片'}</button>
        </div>
        {days.map((x) => (
          <div key={x.d} className="flex items-center gap-2">
            <span className="text-xs w-14 shrink-0 text-muted-foreground truncate">Day {x.i + 1}</span>
            <div className="flex gap-1 flex-1 min-w-0 overflow-x-auto no-scrollbar">
              {x.pics.map((src, k) => (
                <div key={k} className="relative shrink-0">
                  <img src={src} alt="" className="w-12 h-16 rounded object-cover" />
                  <button aria-label="拿掉照片" onClick={() => updatePhotos((p) => ({ ...p, days: { ...p.days, [x.d]: p.days[x.d].filter((_, j) => j !== k) } }))}
                    className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-foreground text-background flex items-center justify-center"><X className="w-2.5 h-2.5" /></button>
                </div>
              ))}
              {x.pics.length < 4 && (
                <button onClick={() => { setPickDay(x.d); setTimeout(() => dayInput.current?.click(), 0); }} className="shrink-0 w-12 h-16 rounded border border-dashed border-border flex items-center justify-center text-muted-foreground" aria-label={`Day ${x.i + 1} 加照片`}><ImagePlus className="w-4 h-4" /></button>
              )}
            </div>
            <span className="text-[11px] text-muted-foreground shrink-0 max-w-[30%] truncate">{x.theme}</span>
          </div>
        ))}
        <input ref={coverInput} type="file" accept="image/*" className="hidden" onChange={(e) => { pickCover(e.target.files?.[0]); e.target.value = ''; }} />
        <input ref={dayInput} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { pickDayPhotos(e.target.files || []); e.target.value = ''; }} />
      </div>

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
          <div className="space-y-3 relative z-0 isolate">
            {slides.map((sl, i) => (
              <div key={sl.key} className="rounded-2xl overflow-hidden shadow border border-border" style={{ width: W * scale, height: H * scale }}>
                <div ref={(el) => { refs.current[i] = el; }} style={{ width: W, height: H, transform: `scale(${scale})`, transformOrigin: 'top left' }}>{sl.node}</div>
              </div>
            ))}
          </div>
          <button onClick={save} disabled={busy} className="sticky bottom-24 z-20 w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-bold flex items-center justify-center gap-2 shadow-lg disabled:opacity-60">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}{busy ? '正在生成图片…' : `存 ${slides.length} 张图片`}
          </button>
        </>
      )}
    </div>
  );
}
