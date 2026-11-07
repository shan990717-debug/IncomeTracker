import React, { useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { Check, ExternalLink, RefreshCw, Trash2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { actions, getState, ofTrip } from '../lib/store';
import { TASK_GROUPS } from '../lib/prep';
import { dueLabel, md, todayISO } from '../lib/dates';
import { Sheet, Field, PrimaryButton, inputCls } from '../components/ui';

function TaskSheet({ task, onClose, trip }) {
  const [d, setD] = useState(task);
  React.useEffect(() => setD(task), [task]);
  if (!task || !d) return <Sheet open={false} onClose={onClose} />;
  const set = (p) => setD((x) => ({ ...x, ...p }));
  const save = () => {
    if (task.id) actions.updateTask(task.id, d);
    else actions.addTask(trip.id, d);
    onClose();
  };
  return (
    <Sheet open onClose={onClose} title={task.id ? '编辑事项' : '新增事项'}
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
        <Field label="要做什么"><input value={d.title} onChange={(e) => set({ title: e.target.value })} className={inputCls} placeholder="例：买 KTX 回程票" autoFocus={!task.id} /></Field>
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
        <Field label="截止日（当天会提醒）"><input type="date" value={d.dueDate || ''} onChange={(e) => set({ dueDate: e.target.value })} className={inputCls} /></Field>
        <Field label="备注"><textarea rows={2} value={d.note || ''} onChange={(e) => set({ note: e.target.value })} className={`${inputCls} resize-none`} /></Field>
        <Field label="链接"><input value={d.link || ''} onChange={(e) => set({ link: e.target.value })} className={inputCls} placeholder="https://" /></Field>
      </div>
    </Sheet>
  );
}

export default function Prep() {
  const { state, trip } = useOutletContext();
  const [editing, setEditing] = useState(null);
  const [hideDone, setHideDone] = useState(false);
  const tasks = ofTrip(state.tasks, trip).sort((a, b) => (a.dueDate || '9').localeCompare(b.dueDate || '9'));
  const done = tasks.filter((t) => t.done).length;
  const pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
  const today = todayISO();

  const refresh = () => {
    const before = getState().tasks.length;
    actions.refreshPrep(trip.id);
    const added = getState().tasks.length - before;
    toast.success(added ? `补上了 ${added} 个事项（包括行程里的车票、预订）` : '已经很齐全了，没有要补的');
  };

  return (
    <div className="pt-3 px-4 space-y-4">
      <div className="rounded-2xl border border-border bg-card p-4">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-muted-foreground">出发准备</p>
            <p className="text-2xl font-black">{done}<span className="text-base text-muted-foreground font-bold"> / {tasks.length}</span></p>
          </div>
          <p className="text-3xl font-black text-primary">{pct}%</p>
        </div>
        <div className="h-2 rounded-full bg-muted mt-3 overflow-hidden"><div className="h-full bg-primary transition-all" style={{ width: `${pct}%` }} /></div>
        <div className="flex gap-2 mt-3">
          <button onClick={refresh} className="flex-1 rounded-xl border border-border py-2 text-xs font-semibold flex items-center justify-center gap-1.5">
            <RefreshCw className="w-3.5 h-3.5" /> 按行程补充建议
          </button>
          <button onClick={() => setHideDone(!hideDone)} className="flex-1 rounded-xl border border-border py-2 text-xs font-semibold">
            {hideDone ? '显示已完成' : '隐藏已完成'}
          </button>
        </div>
      </div>

      {TASK_GROUPS.map((g) => {
        const list = tasks.filter((t) => t.group === g.id && !(hideDone && t.done));
        if (!list.length) return null;
        return (
          <section key={g.id}>
            <h3 className="text-xs font-bold text-muted-foreground mb-2">{g.emoji} {g.label}</h3>
            <div className="rounded-2xl border border-border bg-card divide-y divide-border">
              {list.map((t) => {
                const overdue = !t.done && t.dueDate && t.dueDate < today;
                return (
                  <div key={t.id} className="flex items-start gap-3 p-3">
                    <button onClick={() => actions.updateTask(t.id, { done: !t.done })} aria-label="完成"
                      className={`mt-0.5 w-6 h-6 rounded-md border-2 flex items-center justify-center shrink-0 transition ${t.done ? 'bg-primary border-primary text-primary-foreground' : 'border-muted-foreground/40 hover:border-primary'}`}>
                      {t.done && <Check className="w-3.5 h-3.5" />}
                    </button>
                    <button className="flex-1 min-w-0 text-left" onClick={() => setEditing(t)}>
                      <p className={`text-sm font-semibold leading-snug ${t.done ? 'line-through text-muted-foreground' : ''}`}>{t.title}</p>
                      {t.note && !t.done && <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{t.note}</p>}
                      {t.dueDate && !t.done && (
                        <p className={`text-[11px] font-semibold mt-1 ${overdue ? 'text-destructive' : 'text-muted-foreground'}`}>
                          {md(t.dueDate)} 前 · {dueLabel(t.dueDate)}
                        </p>
                      )}
                    </button>
                    {t.link && (
                      <a href={t.link} target="_blank" rel="noreferrer" aria-label="打开链接" className="p-1 text-primary shrink-0"><ExternalLink className="w-4 h-4" /></a>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        );
      })}

      <button onClick={() => setEditing({ title: '', group: 'other', dueDate: '', note: '', link: '' })}
        className="w-full rounded-xl border border-dashed border-border py-3 text-sm font-semibold text-muted-foreground hover:text-foreground flex items-center justify-center gap-1.5">
        <Plus className="w-4 h-4" /> 新增事项
      </button>
      <p className="text-[11px] text-muted-foreground text-center pb-2">入境、签证规定会变，出发前以官网为准。</p>

      <TaskSheet task={editing} onClose={() => setEditing(null)} trip={trip} />
    </div>
  );
}
