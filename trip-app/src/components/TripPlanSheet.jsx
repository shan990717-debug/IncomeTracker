import React, { useEffect, useRef, useState } from 'react';
import { Sparkles, Loader2, Check, ImagePlus, X, Paperclip } from 'lucide-react';
import { toast } from 'sonner';
import { useTripState, actions } from '../lib/store';
import { PREFS, PACES, planTrip, applyTripPlan, referencesOf, addReference } from '../lib/autoPlan';
import { daysOf, dayTitle, stopsOf } from '../lib/plan';
import { md } from '../lib/dates';
import { categoryOf } from '../lib/parse';
import { Sheet, Chip, Field, PrimaryButton } from './ui';

/** 参考攻略: itineraries other people shared, read once and kept for the trip. */
function References({ trip, state, off, setOff }) {
  const refs = referencesOf(state, trip);
  const [adding, setAdding] = useState(false);
  const [text, setText] = useState('');
  const [images, setImages] = useState([]);
  const [busy, setBusy] = useState(false);
  const file = useRef(null);
  const read = async () => {
    setBusy(true);
    try {
      const r = await addReference(trip, { text, images: images.map((i) => i.file) });
      toast.success(`读好了：${r.title}（${r.days.length} 天${r.tips?.length ? `，${r.tips.length} 条须知已加进须知` : ''}）`);
      setText(''); setImages([]); setAdding(false);
    } catch (e) { toast.error(e.message || 'AI 暂时连不上'); }
    setBusy(false);
  };
  return (
    <Field label="📎 参考攻略（选填）" hint="别人分享的行程截图 / 链接。AI 会学它怎么分区、排顺序；里面提到的地方会在预览里让你打勾决定要不要">
      <div className="space-y-1.5">
        {refs.map((r) => (
          <div key={r.id} className={`rounded-xl border bg-card px-3 py-2 flex items-start gap-2 ${off.includes(r.city) ? 'border-border opacity-50' : 'border-violet-300'}`}>
            <button onClick={() => setOff((x) => (x.includes(r.city) ? x.filter((y) => y !== r.city) : [...x, r.city]))} aria-label={off.includes(r.city) ? '这次用' : '这次不用'}
              className={`w-5 h-5 mt-0.5 rounded-md border-2 flex items-center justify-center shrink-0 ${off.includes(r.city) ? 'border-muted-foreground/40' : 'bg-violet-600 border-violet-600 text-white'}`}>
              {!off.includes(r.city) && <Check className="w-3 h-3" />}
            </button>
            <Paperclip className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold truncate">{r.data.title}</p>
              <p className="text-[11px] text-muted-foreground truncate">{(r.data.days || []).map((d) => d.theme).join(' · ')}</p>
            </div>
            <button onClick={() => window.confirm(`删掉参考「${r.data.title}」？`) && actions.deleteMustList(trip.id, r.city)} aria-label="删掉参考" className="p-1 text-muted-foreground"><X className="w-4 h-4" /></button>
          </div>
        ))}
        {!adding ? (
          <button onClick={() => setAdding(true)} className="w-full rounded-xl border border-dashed border-border py-2 text-xs font-bold text-primary">＋ 加一篇参考攻略</button>
        ) : (
          <div className="rounded-xl border border-border bg-card p-2.5 space-y-2">
            <textarea value={text} onChange={(e) => setText(e.target.value)} rows={3} placeholder="贴小红书 / IG 链接，或攻略文字；也可以只加截图"
              className="w-full rounded-lg border border-input bg-background px-2.5 py-2 text-sm resize-none" />
            <div className="flex items-center gap-1.5 flex-wrap">
              {images.map((img, i) => (
                <div key={img.url} className="relative"><img src={img.url} alt="" className="w-11 h-14 rounded object-cover" />
                  <button onClick={() => setImages((x) => x.filter((_, j) => j !== i))} aria-label="移除截图" className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-foreground text-background flex items-center justify-center"><X className="w-2.5 h-2.5" /></button></div>
              ))}
              {images.length < 4 && <button onClick={() => file.current?.click()} className="w-11 h-14 rounded border border-dashed border-border flex items-center justify-center text-muted-foreground" aria-label="加截图"><ImagePlus className="w-4 h-4" /></button>}
              <input ref={file} type="file" accept="image/*" multiple className="hidden"
                onChange={(e) => { const f = [...(e.target.files || [])].slice(0, 4 - images.length).map((x) => ({ file: x, url: URL.createObjectURL(x) })); setImages((v) => [...v, ...f]); e.target.value = ''; }} />
              <div className="flex-1" />
              <button onClick={() => setAdding(false)} className="text-xs text-muted-foreground px-2">取消</button>
              <button onClick={read} disabled={busy || (!text.trim() && !images.length)} className="rounded-lg bg-violet-600 text-white px-3 py-1.5 text-xs font-bold flex items-center gap-1 disabled:opacity-40">
                {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}{busy ? '读取中…' : '读这篇'}
              </button>
            </div>
          </div>
        )}
      </div>
    </Field>
  );
}

/**
 * AI 帮我排整个旅行: choose pace / preferences → preview which places go on
 * which day (AI 推荐 ones can be unticked) → 套用, then each day is sorted.
 */
export default function TripPlanSheet({ open, onClose, trip }) {
  const state = useTripState();
  const [step, setStep] = useState('setup'); // setup | loading | preview | applying
  const [pace, setPace] = useState('normal');
  const [prefs, setPrefs] = useState(['经典']);
  const [mode, setMode] = useState('keep');
  const [wishes, setWishes] = useState('');
  const [picked, setPicked] = useState([]);
  const [refsOff, setRefsOff] = useState([]);
  const [plan, setPlan] = useState(null);
  const [progress, setProgress] = useState([0, 0]);
  useEffect(() => { if (open) { setStep('setup'); setPlan(null); } }, [open]);
  if (!open) return <Sheet open={false} onClose={onClose} />;

  const days = daysOf(trip);
  const lockedDays = days.filter((d) => stopsOf(state, trip, d).length);
  const togglePref = (p) => setPrefs((x) => (x.includes(p) ? x.filter((y) => y !== p) : [...x, p]));
  const start = async () => {
    setStep('loading');
    const refIds = referencesOf(state, trip).map((r) => r.city).filter((c) => !refsOff.includes(c));
    try { setPlan(await planTrip(trip, { mode, pace, prefs, wishes, days: picked, refIds })); setStep('preview'); } catch (e) { toast.error(e.message || 'AI 暂时连不上'); setStep('setup'); }
  };
  const toggleTodo = (i) => setPlan((p) => ({ ...p, todos: p.todos.map((t, j) => (j === i ? { ...t, on: !t.on } : t)) }));
  const toggleExtra = (day, id) => setPlan((p) => ({ ...p, days: p.days.map((d) => (d.day !== day ? d : { ...d, stops: d.stops.map((x) => (x.id === id ? { ...x, on: !x.on } : x)) })) }));
  const apply = async () => {
    setStep('applying');
    const n = await applyTripPlan(trip, plan, mode, (done, total) => setProgress([done, total]));
    toast.success(`排好了 ${n} 天，每天都可以再手动调整`);
    onClose();
  };
  const busy = step === 'loading' || step === 'applying';

  return (
    <Sheet open onClose={busy ? () => {} : onClose} title="AI 帮我排整个旅行"
      footer={step === 'setup' ? <PrimaryButton onClick={start} disabled={!days.length || (mode === 'pick' && !picked.length)}>{!days.length ? '先设定旅行日期' : mode === 'pick' ? (picked.length ? `开始排（${picked.length} 天）` : '先选要排哪几天') : '开始排'}</PrimaryButton>
        : step === 'preview' ? <PrimaryButton onClick={apply} disabled={!plan.days.length}>套用（{plan.days.length} 天）</PrimaryButton>
          : null}>
      {step === 'setup' && (
        <div className="space-y-4 pb-2">
          <p className="text-xs text-muted-foreground">AI 会看攻略库所有地点（避雷的不算）、订单（住哪里、哪天搭车 / 飞机），按城市和商圈分到每一天，不够的从必去推荐补，再排好每天的顺序。先给你看预览，确认才写进行程。</p>
          <References trip={trip} state={state} off={refsOff} setOff={setRefsOff} />
          <Field label="想做的事（跟 AI 说，它会照着排）" hint="有日期、时间就写进去；要先买票 / 预约的，AI 会加进须知">
            <textarea value={wishes} onChange={(e) => setWishes(e.target.value)} rows={4}
              className="w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/40 resize-none"
              placeholder={'例：\n刚落地那几天想去剪头发\n12/31 晚上要去跨年倒数\n1/7 早上去江村滑雪，晚上 7 点左右回到'} />
          </Field>
          <Field label="节奏">
            <div className="grid grid-cols-3 gap-1.5">
              {PACES.map(([v, label, sub]) => (
                <button key={v} onClick={() => setPace(v)} className={`rounded-xl border py-2 text-center ${pace === v ? 'bg-foreground text-background border-foreground' : 'bg-card border-border'}`}>
                  <span className="block text-sm font-bold">{label}</span><span className="block text-[10px] opacity-70">{sub}</span>
                </button>
              ))}
            </div>
          </Field>
          <Field label="偏好（可以多选）">
            <div className="flex flex-wrap gap-1.5">{PREFS.map((p) => <Chip key={p} active={prefs.includes(p)} onClick={() => togglePref(p)}>{p}</Chip>)}</div>
          </Field>
          <Field label="要排哪几天" hint={mode === 'keep' ? (lockedDays.length ? `${lockedDays.length} 天已经有地点，会保留` : '现在每一天都是空的') : mode === 'pick' ? '选的那几天会重新排（固定时间的安排会留着）；其他天不动' : '每一天都重新排（固定时间的安排会留着）'}>
            <div className="grid grid-cols-3 gap-1.5 rounded-xl bg-muted p-1 text-xs font-bold">
              {[['keep', '只排空的天'], ['pick', '选几天'], ['all', '全部重排']].map(([v, label]) => (
                <button key={v} onClick={() => setMode(v)} className={`rounded-lg py-2 ${mode === v ? 'bg-card shadow text-foreground' : 'text-muted-foreground'}`}>{label}</button>
              ))}
            </div>
            {mode === 'pick' && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {days.map((d, i) => {
                  const n = stopsOf(state, trip, d).length;
                  return <Chip key={d} active={picked.includes(d)} onClick={() => setPicked((x) => (x.includes(d) ? x.filter((y) => y !== d) : [...x, d]))}>D{i + 1} {md(d)}{n ? ` · ${n}站` : ''}</Chip>;
                })}
              </div>
            )}
          </Field>
        </div>
      )}

      {busy && (
        <div className="py-12 text-center space-y-3">
          <Loader2 className="w-8 h-8 animate-spin text-violet-600 mx-auto" />
          <p className="text-sm font-semibold">{step === 'loading' ? 'AI 正在看攻略库和订单，分配每一天…' : `正在排每天的顺序 ${progress[0]}/${progress[1]}…`}</p>
          <p className="text-xs text-muted-foreground">大约 10–40 秒，先不要关掉</p>
        </div>
      )}

      {step === 'preview' && plan && (
        <div className="space-y-3 pb-2">
          {plan.summary && <p className="text-xs rounded-xl bg-violet-50 dark:bg-violet-500/10 text-violet-800 dark:text-violet-200 px-3 py-2"><Sparkles className="w-3.5 h-3.5 inline mr-1" />{plan.summary}</p>}
          {days.map((d) => {
            const p = plan.days.find((x) => x.day === d);
            const skip = plan.skipped?.find((x) => x.day === d);
            if (skip) return <p key={d} className="text-xs text-muted-foreground px-1">✈️ {dayTitle(trip, d)}：{skip.why}，这天不排</p>;
            if (plan.locked.includes(d)) return plan.picked ? null : <p key={d} className="text-xs text-muted-foreground px-1">🔒 {dayTitle(trip, d)}：已经手动排好，保留</p>;
            return (
              <div key={d} className="rounded-2xl border border-border bg-card p-3">
                <p className="text-sm font-extrabold">{dayTitle(trip, d)}{p?.theme && <span className="text-primary"> · {p.theme}</span>}</p>
                {!p?.stops.length && <p className="text-xs text-muted-foreground mt-1">这天先空着（时间很短，或没有地点）</p>}
                {p?.stops.map((x) => (x.event ? (
                  <button key={x.id} onClick={() => toggleExtra(d, x.id)} className="w-full flex items-center gap-2 py-1 text-left">
                    <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${x.on ? 'bg-orange-500 border-orange-500 text-white' : 'border-muted-foreground/40'}`}>{x.on && <Check className="w-3 h-3" />}</span>
                    <span className={`text-sm flex-1 font-semibold ${x.on ? '' : 'line-through text-muted-foreground'}`}>📌 {x.title}{x.area && <span className="font-normal text-muted-foreground"> · {x.area}</span>}</span>
                    <span className="text-[10px] font-bold text-orange-600 shrink-0 tabular-nums">{x.ev?.start ? `${x.ev.start}${x.ev.end ? `–${x.ev.end}` : ''}` : '时间不固定'}</span>
                  </button>
                ) : x.extra ? (
                  <button key={x.id} onClick={() => toggleExtra(d, x.id)} className="w-full flex items-center gap-2 py-1 text-left">
                    <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${x.on ? 'bg-violet-600 border-violet-600 text-white' : 'border-muted-foreground/40'}`}>{x.on && <Check className="w-3 h-3" />}</span>
                    <span className={`text-sm flex-1 ${x.on ? '' : 'line-through text-muted-foreground'}`}>{x.title}</span>
                    <span className="text-[10px] font-bold text-violet-600 shrink-0 max-w-[40%] truncate">{x.fromRef ? `📎 来自《${x.fromRef}》` : '🌟 AI 推荐'}</span>
                  </button>
                ) : (
                  <p key={x.id} className="text-sm py-1 flex gap-2"><span className="w-5 text-center">{categoryOf(x.category).emoji}</span><span className="flex-1">{x.title}</span>{x.area && <span className="text-[11px] text-muted-foreground">{x.area}</span>}</p>
                )))}
              </div>
            );
          })}
          {plan.todos?.length > 0 && (
            <div className="rounded-2xl border border-border bg-card p-3">
              <p className="text-sm font-extrabold mb-1">📝 要先准备的（会加进须知）</p>
              {plan.todos.map((t, i) => (
                <button key={t.title} onClick={() => toggleTodo(i)} className="w-full flex items-center gap-2 py-1 text-left">
                  <span className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 ${t.on ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/40'}`}>{t.on && <Check className="w-3 h-3" />}</span>
                  <span className={`text-sm flex-1 ${t.on ? '' : 'line-through text-muted-foreground'}`}>{t.title}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">出发前 {-t.offsetDays} 天</span>
                </button>
              ))}
            </div>
          )}
          {plan.unassigned > 0 && <p className="text-xs text-muted-foreground text-center">另外 {plan.unassigned} 个地点排不下，留在攻略库 / 待安排</p>}
          <button onClick={() => setStep('setup')} className="w-full text-xs font-semibold text-muted-foreground py-1">‹ 改节奏 / 偏好再排一次</button>
        </div>
      )}
    </Sheet>
  );
}
