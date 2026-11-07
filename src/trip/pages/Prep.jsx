import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Check, ExternalLink, Trash2, Plus, CalendarArrowDown, BellRing, ListPlus, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { actions, getState, ofTrip } from '../lib/store';
import { TASK_GROUPS, BUCKETS, bucketOf } from '../lib/prep';
import { dueLabel, md, todayISO, shiftDate } from '../lib/dates';
import { buildICS, download } from '../lib/ics';
import { notifyGranted, notifySupported, requestNotify } from '../lib/reminders';
import { Sheet, Field, PrimaryButton, inputCls } from '../components/ui';

function TaskSheet({ task, onClose, trip }) {
  const [d, setD] = useState(task);
  useEffect(() => setD(task), [task]);
  if (!task || !d) return <Sheet open={false} onClose={onClose} />;
  const set = (p) => setD((x) => ({ ...x, ...p }));
  const save = () => {
    if (task.id) actions.updateTask(task.id, d);
    else actions.addTasks(trip.id, [d]);
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title={task.id ? '准备事项' : '新增准备事项'}
      footer={
        <div className="flex gap-2">
          {task.id && (
            <button aria-label="删除" onClick={() => { actions.deleteTask(task.id); onClose(); }}
              className="w-12 shrink-0 rounded-xl border border-border text-muted-foreground hover:text-destructive flex items-center justify-center"><Trash2 className="w-4 h-4" /></button>
          )}
          <PrimaryButton disabled={!d.title?.trim()} onClick={save}>保存</PrimaryButton>
        </div>
      }>
      <div className="space-y-3">
        <Field label="要做什么"><input value={d.title} onChange={(e) => set({ title: e.target.value })} className={inputCls} placeholder="例：买 WOWPASS 卡" autoFocus={!task.id} /></Field>
        <Field label="截止日（到期当天会提醒）">
          <input type="date" value={d.dueDate || ''} onChange={(e) => set({ dueDate: e.target.value })} className={inputCls} />
          <div className="flex gap-1.5 mt-2 flex-wrap">
            {[[-30, '前 1 个月'], [-14, '前 2 周'], [-7, '前 1 周'], [-3, '前 3 天'], [0, '出发当天']].map(([o, l]) => (
              <button key={o} type="button" onClick={() => set({ dueDate: shiftDate(trip.startDate, o) })}
                className="rounded-full border border-border px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">{l}</button>
            ))}
          </div>
        </Field>
        <Field label="分类">
          <div className="grid grid-cols-4 gap-1.5">
            {TASK_GROUPS.map((g) => (
              <button key={g.id} onClick={() => set({ group: g.id })}
                className={`rounded-xl py-2 text-[11px] font-semibold border ${d.group === g.id ? 'bg-foreground text-background border-foreground' : 'border-border text-muted-foreground'}`}>
                {g.emoji} {g.label}
              </button>
            ))}
          </div>
        </Field>
        <Field label="备注"><textarea rows={3} value={d.note || ''} onChange={(e) => set({ note: e.target.value })} className={`${inputCls} resize-none`} placeholder="价格、在哪买、注意事项…" /></Field>
        <Field label="链接（官网 / 购买页）"><input value={d.link || ''} onChange={(e) => set({ link: e.target.value })} className={inputCls} placeholder="https://" /></Field>
        {d.sourceUrl && (
          <a href={d.sourceUrl} target="_blank" rel="noreferrer" className="block text-xs text-primary font-semibold">📌 来自攻略：{d.sourceTitle || d.sourceUrl}</a>
        )}
      </div>
    </Sheet>
  );
}

function TaskRow({ t, onOpen }) {
  const today = todayISO();
  const overdue = !t.done && t.dueDate && t.dueDate < today;
  const g = TASK_GROUPS.find((x) => x.id === t.group);
  return (
    <div className="flex items-start gap-3 p-3">
      <button onClick={() => actions.updateTask(t.id, { done: !t.done })} aria-label={t.done ? '取消完成' : '完成'}
        className={`mt-0.5 w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition ${t.done ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/40 hover:border-primary'}`}>
        {t.done && <Check className="w-3.5 h-3.5" />}
      </button>
      <button className="flex-1 min-w-0 text-left" onClick={() => onOpen(t)}>
        <p className={`text-sm font-semibold leading-snug ${t.done ? 'line-through text-muted-foreground' : ''}`}>{g?.emoji} {t.title}</p>
        {t.note && !t.done && <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">{t.note}</p>}
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          {t.dueDate && !t.done && (
            <span className={`text-[11px] font-semibold ${overdue ? 'text-destructive' : 'text-muted-foreground'}`}>{md(t.dueDate)} 前 · {dueLabel(t.dueDate)}</span>
          )}
          {t.sourceUrl && !t.done && <span className="text-[11px] text-primary truncate max-w-[160px]">📌 {t.sourceTitle || '来自攻略'}</span>}
        </div>
      </button>
      {t.link && (
        <a href={t.link} target="_blank" rel="noreferrer" aria-label="打开链接" className="p-1 text-primary shrink-0"><ExternalLink className="w-4 h-4" /></a>
      )}
    </div>
  );
}

export default function Prep() {
  const { state, trip, openCollect } = useOutletContext();
  const [editing, setEditing] = useState(null);
  const [showDone, setShowDone] = useState(false);
  const [granted, setGranted] = useState(notifyGranted());
  const today = todayISO();

  const tasks = ofTrip(state.tasks, trip).sort((a, b) => (a.dueDate || '9').localeCompare(b.dueDate || '9'));
  const open = tasks.filter((t) => !t.done);
  const done = tasks.length - open.length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  // 今天要做: overdue + due within 3 days.
  const now = open.filter((t) => t.dueDate && t.dueDate <= shiftDate(today, 3));
  const nowIds = new Set(now.map((t) => t.id));

  const addCommon = () => {
    const before = getState().tasks.length;
    actions.refreshPrep(trip.id);
    const added = getState().tasks.length - before;
    toast[added ? 'success' : 'message'](added ? `补上 ${added} 件常见事项` : '常见事项都已经在清单里了');
  };
  const exportCal = () => {
    download(`${trip.name}-出发准备.ics`, buildICS({ trip, tasks }));
    toast.success('已下载，打开文件就能加入手机日历（到期当天 9 点提醒）');
  };
  const enable = async () => {
    const r = await requestNotify();
    if (r === 'granted') { setGranted(true); toast.success('已开启：每天打开 App 时提醒到期事项'); }
    else toast(r === 'unsupported' ? '这个浏览器不支持通知，请用「加入日历」' : '通知被拒绝了，可以用「加入日历」');
  };

  return (
    <div className="pt-3 px-4 space-y-4">
      {now.length > 0 && (
        <section className="rounded-2xl border border-destructive/30 bg-destructive/5 overflow-hidden">
          <h3 className="px-3 pt-3 text-sm font-bold flex items-center gap-1.5 text-destructive"><AlertCircle className="w-4 h-4" />今天要做（{now.length}）</h3>
          <div className="divide-y divide-border/60">{now.map((t) => <TaskRow key={t.id} t={t} onOpen={setEditing} />)}</div>
        </section>
      )}

      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-muted-foreground">出发准备</p>
            <p className="text-2xl font-black">{done}<span className="text-base text-muted-foreground font-bold"> / {tasks.length}</span></p>
          </div>
          <p className="text-3xl font-black text-primary">{pct}%</p>
        </div>
        <div className="h-2 rounded-full bg-muted mt-3 overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div>
        <div className="grid grid-cols-3 gap-2 mt-3 text-[11px] font-semibold">
          <button onClick={exportCal} className="rounded-xl border border-border py-2 flex flex-col items-center gap-1"><CalendarArrowDown className="w-4 h-4 text-primary" />加入日历</button>
          <button onClick={enable} disabled={granted || !notifySupported()} className="rounded-xl border border-border py-2 flex flex-col items-center gap-1 disabled:opacity-60">
            <BellRing className={`w-4 h-4 ${granted ? 'text-primary' : 'text-amber-500'}`} />{granted ? '通知已开' : '开启通知'}
          </button>
          <button onClick={addCommon} className="rounded-xl border border-border py-2 flex flex-col items-center gap-1"><ListPlus className="w-4 h-4 text-primary" />补常见事项</button>
        </div>
      </div>

      {BUCKETS.concat([{ id: 'nodate', label: '没有日期' }]).map((b) => {
        const list = open.filter((t) => !nowIds.has(t.id) && bucketOf(t, trip.startDate) === b.id);
        if (!list.length) return null;
        return (
          <section key={b.id}>
            <h3 className="text-xs font-bold text-muted-foreground mb-2">{b.label}</h3>
            <div className="rounded-2xl border border-border bg-card divide-y divide-border">
              {list.map((t) => <TaskRow key={t.id} t={t} onOpen={setEditing} />)}
            </div>
          </section>
        );
      })}

      {done > 0 && (
        <section>
          <button onClick={() => setShowDone(!showDone)} className="text-xs font-bold text-muted-foreground mb-2">✓ 已完成 {done} {showDone ? '▲' : '▼'}</button>
          {showDone && (
            <div className="rounded-2xl border border-border bg-card divide-y divide-border">
              {tasks.filter((t) => t.done).map((t) => <TaskRow key={t.id} t={t} onOpen={setEditing} />)}
            </div>
          )}
        </section>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button onClick={() => setEditing({ title: '', group: 'other', dueDate: '', note: '', link: '' })}
          className="rounded-xl border border-dashed border-border py-3 text-sm font-semibold text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5">
          <Plus className="w-4 h-4" /> 自己加
        </button>
        <button onClick={openCollect}
          className="rounded-xl border border-dashed border-border py-3 text-sm font-semibold text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5">
          📌 从攻略帖加
        </button>
      </div>
      <p className="text-[11px] text-muted-foreground text-center pb-2">入境、签证规定会变，出发前以官网为准。</p>

      <TaskSheet task={editing} onClose={() => setEditing(null)} trip={trip} />
    </div>
  );
}
