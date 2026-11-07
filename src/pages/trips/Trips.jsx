import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Plus, Users, LogIn } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import { useLanguage } from '@/lib/i18n';
import { useMyTrips } from '@/hooks/useTrips';
import TripShell, { inputCls } from '@/components/trips/TripShell';
import ProgressBar from '@/components/ui/ProgressBar';
import { Button } from '@/components/ui/button';
import { fmt } from '@/lib/trips';

export default function Trips() {
  const { lang } = useLanguage();
  const zh = lang === 'zh';
  const navigate = useNavigate();
  const { data: trips = [], isLoading } = useMyTrips();
  const [code, setCode] = useState('');

  const ids = trips.map(t => t.id);
  const { data: expenses = [] } = useQuery({
    queryKey: ['tripExpensesAll', ids.join(',')],
    enabled: ids.length > 0,
    queryFn: () => base44.entities.TripExpense.filter({ trip_id: { $in: ids } }, '-date', 5000),
  });
  const spentOf = (id) => expenses.filter(e => e.trip_id === id).reduce((s, e) => s + (e.amount_base || 0), 0);

  const active = trips.filter(t => !t.is_archived);
  const archived = trips.filter(t => t.is_archived);

  return (
    <TripShell title={zh ? '我的旅行' : 'My Trips'} back="/"
      action={
        <Button size="sm" className="h-9 rounded-xl font-semibold" onClick={() => navigate('/trips/new')}>
          <Plus className="w-4 h-4 mr-1" />{zh ? '新旅行' : 'New'}
        </Button>
      }>
      {isLoading && <p className="text-sm text-muted-foreground text-center py-8">…</p>}

      {!isLoading && trips.length === 0 && (
        <div className="text-center py-10 space-y-3">
          <p className="text-5xl">🧳</p>
          <p className="font-bold">{zh ? '还没有旅行' : 'No trips yet'}</p>
          <p className="text-sm text-muted-foreground">
            {zh ? '为每次旅行开一个账本：设预算、记账、最后自动分账。' : 'Open a folder for each trip: set a budget, log spending, split it at the end.'}
          </p>
          <Button className="rounded-xl" onClick={() => navigate('/trips/new')}>
            <Plus className="w-4 h-4 mr-1" />{zh ? '开始第一次旅行' : 'Create your first trip'}
          </Button>
        </div>
      )}

      {active.map(t => <TripCard key={t.id} trip={t} spent={spentOf(t.id)} zh={zh} onClick={() => navigate(`/trips/${t.id}`)} />)}

      {archived.length > 0 && (
        <>
          <p className="text-sm font-bold text-muted-foreground pt-2">{zh ? '已结束' : 'Archived'}</p>
          {archived.map(t => <TripCard key={t.id} trip={t} spent={spentOf(t.id)} zh={zh} onClick={() => navigate(`/trips/${t.id}`)} />)}
        </>
      )}

      <div className="bg-card border border-border rounded-2xl p-4 space-y-2">
        <p className="text-sm font-bold flex items-center gap-2"><LogIn className="w-4 h-4" />{zh ? '加入朋友的旅行' : "Join a friend's trip"}</p>
        <div className="flex gap-2">
          <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} maxLength={6}
            placeholder={zh ? '输入6位邀请码' : '6-letter invite code'} className={`${inputCls} tracking-widest uppercase`} />
          <Button disabled={code.length < 6} className="h-auto rounded-xl" onClick={() => navigate(`/trips/join/${code}`)}>
            {zh ? '加入' : 'Join'}
          </Button>
        </div>
      </div>
    </TripShell>
  );
}

function TripCard({ trip, spent, zh, onClick }) {
  const budget = trip.budget || 0;
  const left = budget - spent;
  const over = budget > 0 && left < 0;
  return (
    <button onClick={onClick} className="w-full text-left bg-card border border-border rounded-2xl p-4 space-y-3 hover:border-primary/40 transition-colors">
      <div className="flex items-start gap-3">
        <span className="text-3xl">{trip.emoji || '✈️'}</span>
        <div className="flex-1 min-w-0">
          <p className="font-bold truncate">{trip.name}</p>
          <p className="text-xs text-muted-foreground truncate">
            {[trip.destination, trip.start_date && `${trip.start_date}${trip.end_date ? ` → ${trip.end_date}` : ''}`].filter(Boolean).join(' · ')}
          </p>
        </div>
        <span className="text-xs text-muted-foreground flex items-center gap-1 shrink-0">
          <Users className="w-3.5 h-3.5" />{trip.participants?.length || 0}
        </span>
      </div>
      {budget > 0 ? (
        <div>
          <div className="flex justify-between text-xs mb-1.5">
            <span className="text-muted-foreground">{zh ? '已花' : 'Spent'} {fmt(spent, trip.base_currency)}</span>
            <span className={`font-bold ${over ? 'text-destructive' : 'text-primary'}`}>
              {over ? (zh ? '超支 ' : 'Over ') : (zh ? '剩 ' : 'Left ')}{fmt(Math.abs(left), trip.base_currency)}
            </span>
          </div>
          <ProgressBar value={spent} max={budget} barClass={over ? 'bg-destructive' : 'bg-primary'} />
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">{zh ? '已花' : 'Spent'} {fmt(spent, trip.base_currency)}</p>
      )}
    </button>
  );
}
