import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Trash2, X, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/i18n';
import { invalidateTrip } from '@/hooks/useTrips';
import TripShell, { Field, inputCls, Spinner, CurrencySelect } from '@/components/trips/TripShell';
import { Button } from '@/components/ui/button';
import { CURRENCIES, TRIP_EMOJIS, newId, newShareCode } from '@/lib/trips';

export default function TripForm() {
  const { tripId } = useParams();
  const { user } = useAuth();
  const { lang } = useLanguage();
  const zh = lang === 'zh';
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [form, setForm] = useState({
    name: '', destination: '', emoji: '✈️', start_date: '', end_date: '',
    base_currency: 'MYR', budget: '', notes: '', is_archived: false,
    participants: [{ id: newId(), name: user?.full_name || (zh ? '我' : 'Me'), email: user?.email || '' }],
  });
  const [usedIds, setUsedIds] = useState(new Set());
  const [original, setOriginal] = useState(null);
  const [newName, setNewName] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!tripId) return;
    (async () => {
      const [t, exps, sets] = await Promise.all([
        base44.entities.Trip.get(tripId),
        base44.entities.TripExpense.filter({ trip_id: tripId }, '-date', 1000),
        base44.entities.TripSettlement.filter({ trip_id: tripId }, '-date', 500),
      ]);
      setOriginal(t);
      setForm({
        name: t.name || '', destination: t.destination || '', emoji: t.emoji || '✈️',
        start_date: t.start_date || '', end_date: t.end_date || '',
        base_currency: t.base_currency || 'MYR', budget: t.budget ? String(t.budget) : '',
        notes: t.notes || '', is_archived: !!t.is_archived, participants: t.participants || [],
      });
      const ids = new Set();
      exps.forEach(e => {
        ids.add(e.paid_by);
        (e.split_among || []).forEach(i => ids.add(i));
        (e.custom_shares || []).forEach(s => ids.add(s.participant_id));
      });
      sets.forEach(s => { ids.add(s.from_participant); ids.add(s.to_participant); });
      setUsedIds(ids);
    })();
  }, [tripId]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));
  const hasExpenses = usedIds.size > 0;

  const addPerson = () => {
    const name = newName.trim();
    if (!name) return;
    set('participants', [...form.participants, { id: newId(), name, email: '' }]);
    setNewName('');
  };
  const renamePerson = (id, name) =>
    set('participants', form.participants.map(p => (p.id === id ? { ...p, name } : p)));
  const removePerson = (id) => {
    if (usedIds.has(id)) return toast.error(zh ? '这个人已有账目，不能删除' : 'This person already has expenses');
    set('participants', form.participants.filter(p => p.id !== id));
  };

  const save = async () => {
    if (!form.name.trim()) return toast.error(zh ? '请输入旅行名称' : 'Enter a trip name');
    if (form.participants.length === 0) return toast.error(zh ? '至少要有一个人' : 'Add at least one person');
    setSaving(true);
    try {
      const data = {
        ...form,
        name: form.name.trim(),
        budget: parseFloat(form.budget) || 0,
        participants: form.participants.map(p => ({ ...p, name: p.name.trim() || '?' })),
      };
      if (tripId) {
        await base44.entities.Trip.update(tripId, data);
        invalidateTrip(qc, tripId);
        toast.success(zh ? '已保存' : 'Saved');
        navigate(`/trips/${tripId}`);
      } else {
        const created = await base44.entities.Trip.create({
          ...data,
          share_code: newShareCode(),
          member_emails: user?.email ? [user.email] : [],
        });
        qc.invalidateQueries({ queryKey: ['trips'] });
        toast.success(zh ? '旅行已创建' : 'Trip created');
        navigate(`/trips/${created.id}`, { replace: true });
      }
    } catch (e) {
      toast.error(e?.message || 'Error');
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm(zh ? '删除这个旅行和所有账目？无法恢复。' : 'Delete this trip and all its expenses? This cannot be undone.')) return;
    const [exps, sets] = await Promise.all([
      base44.entities.TripExpense.filter({ trip_id: tripId }, '-date', 1000),
      base44.entities.TripSettlement.filter({ trip_id: tripId }, '-date', 500),
    ]);
    await Promise.all([
      ...exps.map(e => base44.entities.TripExpense.delete(e.id)),
      ...sets.map(s => base44.entities.TripSettlement.delete(s.id)),
    ]);
    await base44.entities.Trip.delete(tripId);
    qc.invalidateQueries({ queryKey: ['trips'] });
    toast.success(zh ? '已删除' : 'Deleted');
    navigate('/trips', { replace: true });
  };

  if (tripId && !original) return <Spinner />;
  const isOwner = !tripId || original?.created_by === user?.email;

  return (
    <TripShell
      title={tripId ? (zh ? '编辑旅行' : 'Edit Trip') : (zh ? '新旅行' : 'New Trip')}
      back={tripId ? `/trips/${tripId}` : '/trips'}
      action={tripId && isOwner && (
        <button onClick={remove} className="p-2 rounded-xl text-destructive hover:bg-destructive/10" aria-label="Delete">
          <Trash2 className="w-4 h-4" />
        </button>
      )}
      footer={
        <Button onClick={save} disabled={saving} className="w-full h-12 rounded-2xl font-bold text-base">
          {saving ? '…' : (zh ? '保存' : 'Save')}
        </Button>
      }>
      <Field label={zh ? '旅行名称 *' : 'Trip name *'}>
        <input value={form.name} onChange={e => set('name', e.target.value)} className={inputCls}
          placeholder={zh ? '例如：东京 2026' : 'e.g. Tokyo 2026'} />
      </Field>

      <div className="flex gap-2 flex-wrap">
        {TRIP_EMOJIS.map(e => (
          <button key={e} onClick={() => set('emoji', e)}
            className={`w-10 h-10 rounded-xl text-xl border ${form.emoji === e ? 'border-primary bg-primary/10' : 'border-transparent bg-secondary'}`}>
            {e}
          </button>
        ))}
      </div>

      <Field label={zh ? '目的地' : 'Destination'}>
        <input value={form.destination} onChange={e => set('destination', e.target.value)} className={inputCls}
          placeholder={zh ? '例如：日本' : 'e.g. Japan'} />
      </Field>

      <div className="grid grid-cols-2 gap-3">
        <Field label={zh ? '出发' : 'From'}>
          <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} className={inputCls} />
        </Field>
        <Field label={zh ? '回来' : 'To'}>
          <input type="date" value={form.end_date} onChange={e => set('end_date', e.target.value)} className={inputCls} />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label={zh ? '记账货币' : 'Home currency'}
          hint={hasExpenses ? (zh ? '已有账目，不能更改' : 'Locked once expenses exist') : (zh ? '预算和分账用这个货币' : 'Budget & balances use this')}>
          <CurrencySelect value={form.base_currency} onChange={v => set('base_currency', v)} currencies={CURRENCIES}
            className={hasExpenses ? 'opacity-60 pointer-events-none' : ''} />
        </Field>
        <Field label={zh ? `目标旅费 (${form.base_currency})` : `Budget (${form.base_currency})`}>
          <input type="number" inputMode="decimal" value={form.budget} onChange={e => set('budget', e.target.value)}
            placeholder="0.00" className={`${inputCls} font-bold`} />
        </Field>
      </div>

      <Field label={zh ? '一起去的人' : "Who's going"}
        hint={zh ? '朋友用分享链接加入后，可以认领自己的名字' : 'Friends can claim their name when they join via the share link'}>
        <div className="space-y-2">
          {form.participants.map(p => (
            <div key={p.id} className="flex items-center gap-2">
              <input value={p.name} onChange={e => renamePerson(p.id, e.target.value)} className={inputCls} />
              {p.email && <span className="text-[10px] text-primary font-semibold shrink-0">{zh ? '已加入' : 'joined'}</span>}
              <button onClick={() => removePerson(p.id)} className="p-2 rounded-xl text-muted-foreground hover:text-destructive" aria-label="Remove">
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <div className="flex gap-2">
            <input value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === 'Enter' && addPerson()}
              placeholder={zh ? '添加名字' : 'Add a name'} className={inputCls} />
            <Button variant="secondary" className="h-auto rounded-xl" onClick={addPerson}>
              <UserPlus className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </Field>

      <Field label={zh ? '备注' : 'Notes'}>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} className={`${inputCls} resize-none`} />
      </Field>

      {tripId && (
        <label className="flex items-center gap-3 text-sm font-medium">
          <input type="checkbox" checked={form.is_archived} onChange={e => set('is_archived', e.target.checked)} className="w-4 h-4" />
          {zh ? '旅行已结束（归档）' : 'Trip is over (archive)'}
        </label>
      )}
    </TripShell>
  );
}
