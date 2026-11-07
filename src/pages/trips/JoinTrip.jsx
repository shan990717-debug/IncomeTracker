import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/i18n';
import TripShell, { inputCls, Spinner } from '@/components/trips/TripShell';
import { Button } from '@/components/ui/button';
import { isMember, newId } from '@/lib/trips';

export default function JoinTrip() {
  const { code } = useParams();
  const { user } = useAuth();
  const { lang } = useLanguage();
  const zh = lang === 'zh';
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [trip, setTrip] = useState(undefined);
  const [choice, setChoice] = useState('new');
  const [name, setName] = useState(user?.full_name || '');
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    base44.entities.Trip.filter({ share_code: (code || '').toUpperCase() }).then(list => {
      const t = list[0] || null;
      if (t && isMember(t, user?.email)) {
        navigate(`/trips/${t.id}`, { replace: true });
        return;
      }
      setTrip(t);
      const open = (t?.participants || []).filter(p => !p.email);
      if (open.length) setChoice(open[0].id);
    }).catch(() => setTrip(null));
  }, [code, user?.email, navigate]);

  const join = async () => {
    if (!user?.email) return;
    if (choice === 'new' && !name.trim()) return toast.error(zh ? '请输入你的名字' : 'Enter your name');
    setJoining(true);
    try {
      // Re-read right before writing so we don't overwrite someone else's change.
      const fresh = await base44.entities.Trip.get(trip.id);
      let participants = fresh.participants || [];
      const target = participants.find(p => p.id === choice && !p.email);
      participants = target
        ? participants.map(p => (p.id === choice ? { ...p, email: user.email } : p))
        : [...participants, { id: newId(), name: name.trim(), email: user.email }];
      await base44.entities.Trip.update(trip.id, {
        participants,
        member_emails: [...new Set([...(fresh.member_emails || []), user.email])],
      });
      qc.invalidateQueries({ queryKey: ['trips'] });
      toast.success(zh ? '已加入旅行！' : 'Joined the trip!');
      navigate(`/trips/${trip.id}`, { replace: true });
    } catch (e) {
      toast.error(e?.message || 'Error');
      setJoining(false);
    }
  };

  if (trip === undefined) return <Spinner />;

  if (!trip) {
    return (
      <TripShell title={zh ? '加入旅行' : 'Join trip'} back="/trips">
        <div className="text-center py-10 space-y-2">
          <p className="text-4xl">🔍</p>
          <p className="font-bold">{zh ? '找不到这个邀请码' : 'Invite code not found'}</p>
          <p className="text-sm text-muted-foreground">{zh ? '请检查链接或邀请码是否正确。' : 'Check the link or code and try again.'}</p>
        </div>
      </TripShell>
    );
  }

  const open = (trip.participants || []).filter(p => !p.email);

  return (
    <TripShell title={zh ? '加入旅行' : 'Join trip'} back="/trips"
      footer={
        <Button onClick={join} disabled={joining} className="w-full h-12 rounded-2xl font-bold text-base">
          {joining ? '…' : (zh ? '加入并开始记账' : 'Join & start logging')}
        </Button>
      }>
      <div className="text-center py-4">
        <p className="text-5xl">{trip.emoji || '✈️'}</p>
        <p className="text-xl font-extrabold mt-2">{trip.name}</p>
        {trip.destination && <p className="text-sm text-muted-foreground">{trip.destination}</p>}
        <p className="text-xs text-muted-foreground mt-1">
          {(trip.participants || []).map(p => p.name).join(' · ')}
        </p>
      </div>

      <p className="text-sm font-bold">{zh ? '你是哪一位？' : 'Which one are you?'}</p>
      <div className="space-y-2">
        {open.map(p => (
          <label key={p.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer ${choice === p.id ? 'border-primary bg-primary/5' : 'border-border'}`}>
            <input type="radio" checked={choice === p.id} onChange={() => setChoice(p.id)} />
            <span className="font-semibold text-sm">{p.name}</span>
          </label>
        ))}
        <label className={`block p-3 rounded-xl border cursor-pointer space-y-2 ${choice === 'new' ? 'border-primary bg-primary/5' : 'border-border'}`}>
          <span className="flex items-center gap-3">
            <input type="radio" checked={choice === 'new'} onChange={() => setChoice('new')} />
            <span className="font-semibold text-sm">{open.length ? (zh ? '都不是，添加我' : "I'm not listed") : (zh ? '你的名字' : 'Your name')}</span>
          </span>
          {choice === 'new' && (
            <input value={name} onChange={e => setName(e.target.value)} className={inputCls} placeholder={zh ? '名字' : 'Name'} />
          )}
        </label>
      </div>
    </TripShell>
  );
}
