import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Link2, RefreshCw, Trash2, LogOut } from 'lucide-react';
import { toast } from 'sonner';
import { actions } from '../lib/store';
import { sharedMode } from '../lib/supabase';
import { Sheet, PrimaryButton } from './ui';
import TripForm from './TripForm';

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

/** Inside a trip: edit name/dates/cities, invite buddies, delete (creator) or leave. */
export default function TripSettingsSheet({ open, onClose, state, trip }) {
  const navigate = useNavigate();
  const mine = !sharedMode || trip.createdBy === state.user?.id;
  const remove = async () => {
    const ok = window.confirm(mine ? `删除「${trip.name}」？所有旅伴都会看不到里面的攻略和须知。` : `退出「${trip.name}」？`);
    if (!ok) return;
    onClose();
    navigate('/', { replace: true });
    await actions.deleteTrip(trip.id);
  };
  return (
    <Sheet open={open} onClose={onClose} title="旅行设定">
      <div className="space-y-5 pb-2">
        <TripForm trip={trip} onDone={() => { toast.success('已保存'); onClose(); }} />
        {sharedMode && <ShareBox state={state} trip={trip} />}
        <button onClick={remove} className="w-full rounded-xl border border-border py-3 text-sm font-bold text-destructive flex items-center justify-center gap-2">
          {mine ? <><Trash2 className="w-4 h-4" /> 删除这个旅行</> : <><LogOut className="w-4 h-4" /> 退出这个旅行</>}
        </button>
      </div>
    </Sheet>
  );
}
