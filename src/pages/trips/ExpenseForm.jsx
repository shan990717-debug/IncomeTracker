import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Camera, ImagePlus, Loader2, RefreshCw, Trash2, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { useLanguage } from '@/lib/i18n';
import { useTripData, invalidateTrip } from '@/hooks/useTrips';
import TripShell, { Field, inputCls, Spinner, CurrencySelect } from '@/components/trips/TripShell';
import { Button } from '@/components/ui/button';
import { CURRENCIES, EXPENSE_CATEGORIES, fmt, getRate, myParticipant } from '@/lib/trips';

const today = () => new Date().toISOString().slice(0, 10);
const round2 = (n) => Math.round(n * 100) / 100;

const RECEIPT_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Short name of the shop or what was bought, e.g. "Ichiran Ramen"' },
    total: { type: 'number', description: 'Grand total actually paid, after tax/service, as a plain number' },
    currency: { type: 'string', description: 'ISO 4217 currency code of the total, e.g. JPY, THB, MYR' },
    date: { type: 'string', description: 'Date on the receipt as YYYY-MM-DD, empty if not shown' },
    category: { type: 'string', enum: EXPENSE_CATEGORIES.map(c => c.key) },
  },
  required: ['total'],
};

export default function ExpenseForm() {
  const { tripId } = useParams();
  const [params] = useSearchParams();
  const editId = params.get('id');
  const autoScan = params.get('scan') === '1';
  const { user } = useAuth();
  const { lang } = useLanguage();
  const zh = lang === 'zh';
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { trip, expenses, isLoading } = useTripData(tripId);

  const cameraRef = useRef(null);
  const galleryRef = useRef(null);
  const [form, setForm] = useState(null);
  const [rateState, setRateState] = useState('idle'); // idle | loading | auto | manual | error
  const [scanning, setScanning] = useState(false);
  const [saving, setSaving] = useState(false);

  const base = trip?.base_currency || 'MYR';
  const people = useMemo(() => trip?.participants || [], [trip]);

  // Initialise the form once the trip (and the expense, when editing) is loaded.
  useEffect(() => {
    if (!trip || form) return;
    if (editId) {
      const e = expenses.find(x => x.id === editId);
      if (!e) return;
      setForm({
        title: e.title || '', category: e.category || 'other', date: e.date || today(),
        amount: String(e.amount ?? ''), currency: e.currency || base,
        exchange_rate: String(e.exchange_rate ?? 1), paid_by: e.paid_by,
        split_type: e.split_type || 'equal', split_among: e.split_among || people.map(p => p.id),
        custom: Object.fromEntries((e.custom_shares || []).map(s => [s.participant_id, String(s.amount_base)])),
        receipt_url: e.receipt_url || '', notes: e.notes || '',
      });
      setRateState(e.currency === base ? 'idle' : 'manual');
      return;
    }
    let lastCur = base;
    try { lastCur = localStorage.getItem(`trip_last_currency_${tripId}`) || base; } catch { /* ignore */ }
    setForm({
      title: '', category: 'food', date: today(), amount: '', currency: lastCur, exchange_rate: '1',
      paid_by: myParticipant(trip, user?.email)?.id || people[0]?.id,
      split_type: 'equal', split_among: people.map(p => p.id), custom: {}, receipt_url: '', notes: '',
    });
    if (lastCur !== base) loadRate(lastCur);
  }, [trip, expenses, editId]);

  useEffect(() => {
    if (autoScan && form && !editId) cameraRef.current?.click();
  }, [autoScan, !!form]);

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  async function loadRate(currency) {
    if (currency === base) {
      setForm(p => p && ({ ...p, exchange_rate: '1' }));
      setRateState('idle');
      return;
    }
    setRateState('loading');
    try {
      const r = await getRate(currency, base);
      setForm(p => p && ({ ...p, exchange_rate: String(Number(r.toPrecision(6))) }));
      setRateState('auto');
    } catch {
      setRateState('error');
    }
  }

  const changeCurrency = (c) => {
    set('currency', c);
    loadRate(c);
  };

  const amount = parseFloat(form?.amount) || 0;
  const rate = form?.currency === base ? 1 : (parseFloat(form?.exchange_rate) || 0);
  const amountBase = round2(amount * rate);

  const customTotal = form ? round2(people.reduce((s, p) => s + (parseFloat(form.custom[p.id]) || 0), 0)) : 0;
  const customLeft = round2(amountBase - customTotal);

  const toggleSplit = (id) => {
    const cur = form.split_among;
    set('split_among', cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id]);
  };

  // ---- Receipt photo -> AI extraction ----
  const onPhoto = async (file) => {
    if (!file) return;
    setScanning(true);
    try {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      set('receipt_url', file_url);
      const res = await base44.integrations.Core.InvokeLLM({
        prompt:
          'You are reading a photo of a receipt or bill from a trip. Extract the grand total that was paid, ' +
          'its currency (ISO code; infer from symbols, language or country if not printed), the date, a short title ' +
          `(shop name or item), and the best matching category. If the currency is unclear, use ${form.currency}.`,
        file_urls: [file_url],
        response_json_schema: RECEIPT_SCHEMA,
      });
      const data = typeof res === 'string' ? JSON.parse(res) : res;
      const cur = CURRENCIES.find(c => c.code === String(data?.currency || '').toUpperCase())?.code;
      setForm(p => ({
        ...p,
        title: data?.title || p.title,
        amount: data?.total ? String(data.total) : p.amount,
        date: /^\d{4}-\d{2}-\d{2}$/.test(data?.date || '') ? data.date : p.date,
        category: EXPENSE_CATEGORIES.some(c => c.key === data?.category) ? data.category : p.category,
        currency: cur || p.currency,
      }));
      if (cur && cur !== form.currency) loadRate(cur);
      toast.success(zh ? '已识别收据，请核对' : 'Receipt read — please check the numbers');
    } catch (e) {
      console.error(e);
      toast.error(zh ? '识别失败，请手动输入' : "Couldn't read the receipt — enter it manually");
    } finally {
      setScanning(false);
    }
  };

  const save = async () => {
    if (!form.title.trim()) return toast.error(zh ? '请输入项目名称' : 'Enter what it was for');
    if (amount <= 0) return toast.error(zh ? '请输入金额' : 'Enter an amount');
    if (rate <= 0) return toast.error(zh ? '请输入汇率' : 'Enter an exchange rate');
    if (!form.paid_by) return toast.error(zh ? '请选择谁付钱' : 'Choose who paid');
    if (form.split_type === 'equal' && form.split_among.length === 0)
      return toast.error(zh ? '至少选一个人分摊' : 'Pick at least one person to split with');
    if (form.split_type === 'custom' && Math.abs(customLeft) > 0.01)
      return toast.error(zh ? `自定义分摊还差 ${fmt(customLeft, base)}` : `Custom split is off by ${fmt(customLeft, base)}`);

    setSaving(true);
    const record = {
      trip_id: tripId,
      title: form.title.trim(),
      category: form.category,
      date: form.date,
      amount,
      currency: form.currency,
      exchange_rate: rate,
      amount_base: amountBase,
      paid_by: form.paid_by,
      split_type: form.split_type,
      split_among: form.split_type === 'equal' ? form.split_among : [],
      custom_shares: form.split_type === 'custom'
        ? people.map(p => ({ participant_id: p.id, amount_base: parseFloat(form.custom[p.id]) || 0 })).filter(s => s.amount_base > 0)
        : [],
      receipt_url: form.receipt_url,
      notes: form.notes,
    };
    try {
      if (editId) await base44.entities.TripExpense.update(editId, record);
      else await base44.entities.TripExpense.create(record);
      try { localStorage.setItem(`trip_last_currency_${tripId}`, form.currency); } catch { /* ignore */ }
      invalidateTrip(qc, tripId);
      toast.success(zh ? '已记账' : 'Saved');
      navigate(`/trips/${tripId}`);
    } catch (e) {
      toast.error(e?.message || 'Error');
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!confirm(zh ? '删除这笔账？' : 'Delete this expense?')) return;
    await base44.entities.TripExpense.delete(editId);
    invalidateTrip(qc, tripId);
    toast.success(zh ? '已删除' : 'Deleted');
    navigate(`/trips/${tripId}`);
  };

  if (isLoading || !trip || !form) return <Spinner />;

  return (
    <TripShell
      title={editId ? (zh ? '编辑账目' : 'Edit expense') : (zh ? '记一笔' : 'Add expense')}
      subtitle={trip.name}
      back={`/trips/${tripId}`}
      action={editId && (
        <button onClick={remove} className="p-2 rounded-xl text-destructive hover:bg-destructive/10" aria-label="Delete">
          <Trash2 className="w-4 h-4" />
        </button>
      )}
      footer={
        <Button onClick={save} disabled={saving || scanning} className="w-full h-12 rounded-2xl font-bold text-base">
          {saving ? '…' : (zh ? '保存' : 'Save')}
        </Button>
      }>
      {/* Photo / scan */}
      <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
        onChange={e => { onPhoto(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={galleryRef} type="file" accept="image/*" className="hidden"
        onChange={e => { onPhoto(e.target.files?.[0]); e.target.value = ''; }} />

      {scanning ? (
        <div className="rounded-2xl border border-primary/30 bg-primary/5 p-4 flex items-center gap-3 text-sm font-medium text-primary">
          <Loader2 className="w-5 h-5 animate-spin" />{zh ? '正在识别收据…' : 'Reading receipt…'}
        </div>
      ) : (
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <button onClick={() => cameraRef.current?.click()}
            className="rounded-2xl border border-dashed border-primary/40 bg-primary/5 p-4 flex items-center gap-3 text-left">
            <Camera className="w-6 h-6 text-primary shrink-0" />
            <span>
              <span className="block text-sm font-bold">{zh ? '拍收据自动记账' : 'Snap a receipt'}</span>
              <span className="block text-xs text-muted-foreground flex items-center gap-1">
                <Sparkles className="w-3 h-3" />{zh ? '自动读取金额、货币、日期' : 'Fills amount, currency & date'}
              </span>
            </span>
          </button>
          <button onClick={() => galleryRef.current?.click()} aria-label={zh ? '从相册选择' : 'Choose from gallery'}
            className="rounded-2xl border border-border bg-card px-4 flex items-center justify-center">
            <ImagePlus className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
      )}

      {form.receipt_url && (
        <a href={form.receipt_url} target="_blank" rel="noreferrer" className="block">
          <img src={form.receipt_url} alt="receipt" className="w-full max-h-48 object-cover rounded-2xl border border-border" />
        </a>
      )}

      <Field label={zh ? '项目 *' : 'What for *'}>
        <input value={form.title} onChange={e => set('title', e.target.value)} className={inputCls}
          placeholder={zh ? '例如：晚餐拉面' : 'e.g. Ramen dinner'} />
      </Field>

      <div className="grid grid-cols-[1fr_7.5rem] gap-2">
        <Field label={zh ? '金额 *' : 'Amount *'}>
          <input type="number" inputMode="decimal" value={form.amount} onChange={e => set('amount', e.target.value)}
            placeholder="0.00" className={`${inputCls} text-lg font-extrabold`} />
        </Field>
        <Field label={zh ? '货币' : 'Currency'}>
          <CurrencySelect value={form.currency} onChange={changeCurrency} currencies={CURRENCIES} className="py-3.5" />
        </Field>
      </div>

      {form.currency !== base && (
        <div className="rounded-2xl bg-secondary/60 p-3 space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground shrink-0">1 {form.currency} =</span>
            <input type="number" inputMode="decimal" value={form.exchange_rate}
              onChange={e => { set('exchange_rate', e.target.value); setRateState('manual'); }}
              className="w-28 bg-background rounded-lg px-2 py-1.5 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-primary" />
            <span className="text-muted-foreground">{base}</span>
            <button onClick={() => loadRate(form.currency)} className="ml-auto p-1.5 rounded-lg hover:bg-background" aria-label="Refresh rate">
              <RefreshCw className={`w-3.5 h-3.5 ${rateState === 'loading' ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <p className="text-[11px] text-muted-foreground">
            {rateState === 'auto' && (zh ? '✓ 已自动获取今日汇率，可手动修改' : '✓ Live rate loaded — you can edit it')}
            {rateState === 'manual' && (zh ? '手动汇率' : 'Manual rate')}
            {rateState === 'loading' && (zh ? '获取汇率中…' : 'Getting rate…')}
            {rateState === 'error' && (zh ? '⚠️ 无法获取汇率，请手动输入' : "⚠️ Couldn't get a rate — enter it manually")}
          </p>
          <p className="text-sm font-bold">≈ {fmt(amountBase, base)}</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Field label={zh ? '日期' : 'Date'}>
          <input type="date" value={form.date} onChange={e => set('date', e.target.value)} className={inputCls} />
        </Field>
        <Field label={zh ? '谁付的钱' : 'Paid by'}>
          <select value={form.paid_by} onChange={e => set('paid_by', e.target.value)} className={inputCls}>
            {people.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </Field>
      </div>

      <Field label={zh ? '类别' : 'Category'}>
        <div className="grid grid-cols-3 gap-2">
          {EXPENSE_CATEGORIES.map(c => (
            <button key={c.key} onClick={() => set('category', c.key)}
              className={`py-2.5 rounded-xl text-xs font-semibold border transition-all ${form.category === c.key ? 'bg-primary/10 border-primary text-primary' : 'bg-secondary border-transparent text-muted-foreground'}`}>
              {c.icon} {zh ? c.labelZh : c.label}
            </button>
          ))}
        </div>
      </Field>

      <Field label={zh ? '怎么分' : 'Split'}>
        <div className="grid grid-cols-2 gap-1 p-1 bg-secondary rounded-xl mb-2">
          {[['equal', zh ? '平分' : 'Equally'], ['custom', zh ? '自定义金额' : 'By amount']].map(([k, l]) => (
            <button key={k} onClick={() => set('split_type', k)}
              className={`py-2 rounded-lg text-xs font-bold ${form.split_type === k ? 'bg-background shadow-sm' : 'text-muted-foreground'}`}>{l}</button>
          ))}
        </div>

        {form.split_type === 'equal' ? (
          <>
            <div className="flex flex-wrap gap-2">
              {people.map(p => {
                const on = form.split_among.includes(p.id);
                return (
                  <button key={p.id} onClick={() => toggleSplit(p.id)}
                    className={`px-3 py-2 rounded-xl text-sm font-semibold border ${on ? 'bg-primary text-primary-foreground border-primary' : 'bg-secondary border-transparent text-muted-foreground'}`}>
                    {p.name}
                  </button>
                );
              })}
            </div>
            {form.split_among.length > 0 && amountBase > 0 && (
              <p className="text-xs text-muted-foreground mt-2">
                {zh ? '每人' : 'Each'} ≈ {fmt(amountBase / form.split_among.length, base)}
              </p>
            )}
          </>
        ) : (
          <div className="space-y-2">
            {people.map(p => (
              <div key={p.id} className="flex items-center gap-2">
                <span className="text-sm font-medium flex-1 truncate">{p.name}</span>
                <input type="number" inputMode="decimal" value={form.custom[p.id] || ''} placeholder="0.00"
                  onChange={e => set('custom', { ...form.custom, [p.id]: e.target.value })}
                  className="w-32 bg-secondary rounded-xl px-3 py-2 text-sm font-bold text-right focus:outline-none focus:ring-2 focus:ring-primary" />
                <span className="text-xs text-muted-foreground w-9">{base}</span>
              </div>
            ))}
            <p className={`text-xs font-semibold ${Math.abs(customLeft) <= 0.01 ? 'text-primary' : 'text-destructive'}`}>
              {Math.abs(customLeft) <= 0.01
                ? (zh ? '✓ 已分配完' : '✓ Fully assigned')
                : (zh ? `还剩 ${fmt(customLeft, base)} 未分配` : `${fmt(customLeft, base)} left to assign`)}
            </p>
          </div>
        )}
      </Field>

      <Field label={zh ? '备注' : 'Notes'}>
        <textarea value={form.notes} onChange={e => set('notes', e.target.value)} rows={2} className={`${inputCls} resize-none`} />
      </Field>
    </TripShell>
  );
}
