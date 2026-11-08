import React, { useEffect, useRef, useState } from 'react';
import { Check, Download, Upload, RotateCcw, Trash2, Link2, RefreshCw } from 'lucide-react';
import { sharedMode } from '../lib/supabase';
import { toast } from 'sonner';
import { actions } from '../lib/store';
import { REGIONS } from '../lib/regions';
import { md, shiftDate, todayISO } from '../lib/dates';
import { download } from '../lib/utils';
import { Sheet, Chip, Field, PrimaryButton, inputCls } from './ui';

function NewTripForm({ onDone }) {
  const [name, setName] = useState('');
  const [start, setStart] = useState(shiftDate(todayISO(), 30));
  const [end, setEnd] = useState(shiftDate(todayISO(), 36));
  const [regions, setRegions] = useState(['首尔']);
  const [custom, setCustom] = useState('');

  const toggle = (r) => setRegions((x) => (x.includes(r) ? x.filter((y) => y !== r) : [...x, r]));
  const addCustom = () => {
    const v = custom.trim();
    if (v && !regions.includes(v)) setRegions([...regions, v]);
    setCustom('');
  };
  const valid = name.trim() && start && end && end >= start && regions.length;

  return (
    <div className="space-y-3">
      <Field label="旅行名称"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="例：韩国冬日之旅" /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="出发"><input type="date" className={inputCls} value={start} onChange={(e) => setStart(e.target.value)} /></Field>
        <Field label="回程"><input type="date" className={inputCls} value={end} min={start} onChange={(e) => setEnd(e.target.value)} /></Field>
      </div>
      <Field label="去哪些地方（收藏会按这里分类）">
        <div className="flex flex-wrap gap-1.5">
          {[...new Set([...REGIONS.map((r) => r.name), ...regions])].map((r) => (
            <Chip key={r} active={regions.includes(r)} onClick={() => toggle(r)}>{r}</Chip>
          ))}
        </div>
        <div className="flex gap-2 mt-2">
          <input className={inputCls} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="其他城市，例：大邱" onKeyDown={(e) => e.key === 'Enter' && addCustom()} />
          <button onClick={addCustom} className="shrink-0 px-4 rounded-xl border border-border text-sm font-semibold">添加</button>
        </div>
      </Field>
      <PrimaryButton disabled={!valid} onClick={() => { actions.createTrip({ name: name.trim(), startDate: start, endDate: end, regions }); onDone(); }}>
        建立旅行
      </PrimaryButton>
    </div>
  );
}

function ShareBox({ state, trip }) {
  const members = state.members.filter((m) => m.tripId === trip.id);
  const link = `${window.location.origin}/join/${trip.inviteCode}`;
  const share = async () => {
    const text = `一起整理「${trip.name}」的攻略吧：${link}`;
    try {
      if (navigator.share) await navigator.share({ title: trip.name, text, url: link });
      else { await navigator.clipboard.writeText(text); toast.success('邀请链接已复制'); }
    } catch { /* user cancelled */ }
  };
  const reset = async () => {
    if (!window.confirm('换一个新链接？旧链接会失效（已加入的旅伴不受影响）。')) return;
    try { await actions.resetInvite(trip.id); toast.success('已换新链接'); } catch (e) { toast.error(e.message); }
  };
  return (
    <div className="rounded-2xl border border-border bg-card p-4 space-y-3">
      <p className="text-sm font-bold">「{trip.name}」的旅伴 · {members.length}</p>
      <div className="flex flex-wrap gap-1.5">
        {members.map((m) => (
          <span key={m.userId} className="rounded-full bg-muted px-3 py-1 text-xs font-semibold">
            {m.displayName || '旅伴'}{m.userId === state.user?.id ? '（我）' : ''}
          </span>
        ))}
      </div>
      <PrimaryButton onClick={share} className="flex items-center justify-center gap-2"><Link2 className="w-4 h-4" />邀请旅伴</PrimaryButton>
      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
        <span className="truncate">邀请码 <b className="text-foreground tracking-wider">{trip.inviteCode}</b></span>
        <button onClick={reset} className="shrink-0 ml-2 flex items-center gap-1 font-semibold"><RefreshCw className="w-3 h-3" />换链接</button>
      </div>
    </div>
  );
}

export default function TripSheet({ open, onClose, state, trip }) {
  const mine = (t) => !sharedMode || t.createdBy === state.user?.id;
  const [creating, setCreating] = useState(false);
  const fileRef = useRef(null);
  useEffect(() => { if (open) setCreating(!state.trips.length); }, [open, state.trips.length]);

  const importFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      actions.importJSON(await f.text());
      toast.success('已导入备份');
      onClose();
    } catch (err) {
      toast.error(err.message || '导入失败');
    }
    e.target.value = '';
  };

  return (
    <Sheet open={open} onClose={onClose} title={creating ? '新建旅行' : '我的旅行'}>
      {creating ? (
        <NewTripForm onDone={() => { setCreating(false); onClose(); }} />
      ) : (
        <div className="space-y-4">
          <div className="space-y-2">
            {state.trips.map((t) => (
              <div key={t.id} className={`flex items-center gap-3 rounded-2xl border p-3 ${t.id === trip?.id ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}>
                <button className="flex-1 text-left min-w-0" onClick={() => { actions.setActiveTrip(t.id); onClose(); }}>
                  <p className="font-semibold truncate">{t.name}</p>
                  <p className="text-xs text-muted-foreground">{md(t.startDate)} – {md(t.endDate)} · {t.regions.join(' · ')}</p>
                </button>
                {t.id === trip?.id && <Check className="w-4 h-4 text-primary" />}
                <button aria-label={mine(t) ? '删除旅行' : '退出旅行'} className="text-muted-foreground hover:text-destructive p-1"
                  onClick={() => window.confirm(mine(t) ? `删除「${t.name}」？所有旅伴都会看不到里面的攻略和准备事项。` : `退出「${t.name}」？`) && actions.deleteTrip(t.id)}>
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <PrimaryButton onClick={() => setCreating(true)}>＋ 新建旅行</PrimaryButton>

          {sharedMode ? (
            <>
              {trip && <ShareBox state={state} trip={trip} />}
            </>
          ) : (
            <>
              <div className="grid grid-cols-3 gap-2 text-xs font-semibold">
                <button className="rounded-xl border border-border py-2.5 flex flex-col items-center gap-1" onClick={() => download('trip-backup.json', actions.exportJSON(), 'application/json')}>
                  <Download className="w-4 h-4" />备份
                </button>
                <button className="rounded-xl border border-border py-2.5 flex flex-col items-center gap-1" onClick={() => fileRef.current?.click()}>
                  <Upload className="w-4 h-4" />导入
                </button>
                <button className="rounded-xl border border-border py-2.5 flex flex-col items-center gap-1"
                  onClick={() => window.confirm('用示例资料覆盖所有资料？') && (actions.resetDemo(), onClose())}>
                  <RotateCcw className="w-4 h-4" />重置示例
                </button>
              </div>
              <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={importFile} />
              <p className="text-[11px] text-muted-foreground text-center">试用模式：资料只存在这台设备上。设定好 Supabase 后就能登录、和旅伴共用。</p>
            </>
          )}
        </div>
      )}
    </Sheet>
  );
}
