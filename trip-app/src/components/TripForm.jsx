import React, { useEffect, useState } from 'react';
import { actions } from '../lib/store';
import { REGIONS } from '../lib/regions';
import { Field, Chip, PrimaryButton, inputCls } from './ui';

const SUGGESTED = [...REGIONS.map((r) => r.name), '东京', '大阪', '京都', '台北', '曼谷', '悉尼', '墨尔本'];

/**
 * Create a trip, or edit one (name, dates, cities). Dates are optional, so a
 * trip can be started while it's still an idea.
 */
export default function TripForm({ trip, onDone }) {
  const [name, setName] = useState(trip?.name || '');
  const [start, setStart] = useState(trip?.startDate || '');
  const [end, setEnd] = useState(trip?.endDate || '');
  const [regions, setRegions] = useState(trip?.regions || []);
  const [custom, setCustom] = useState('');
  useEffect(() => {
    setName(trip?.name || ''); setStart(trip?.startDate || ''); setEnd(trip?.endDate || ''); setRegions(trip?.regions || []);
  }, [trip?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = (r) => setRegions((x) => (x.includes(r) ? x.filter((y) => y !== r) : [...x, r]));
  const addCustom = () => {
    const v = custom.trim();
    if (v && !regions.includes(v)) setRegions([...regions, v]);
    setCustom('');
  };
  const datesOk = (!start && !end) || (start && (!end || end >= start));
  const valid = name.trim() && regions.length && datesOk;

  const save = () => {
    const data = { name: name.trim(), startDate: start, endDate: end || start, regions };
    if (trip) actions.updateTrip(trip.id, data);
    const id = trip ? trip.id : actions.createTrip(data);
    onDone(id);
  };

  return (
    <div className="space-y-3">
      <Field label="旅行名称"><input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="例：Annyeong Korea 2026" /></Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="出发（可以之后再填）"><input type="date" className={inputCls} value={start} onChange={(e) => setStart(e.target.value)} /></Field>
        <Field label="回程"><input type="date" className={inputCls} value={end} min={start} onChange={(e) => setEnd(e.target.value)} /></Field>
      </div>
      <Field label="去哪些城市（攻略会按这里分类，须知也会按这里判断适不适用）">
        <div className="flex flex-wrap gap-1.5">
          {[...new Set([...SUGGESTED, ...regions])].map((r) => <Chip key={r} active={regions.includes(r)} onClick={() => toggle(r)}>{r}</Chip>)}
        </div>
        <div className="flex gap-2 mt-2">
          <input className={inputCls} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="其他城市，例：大邱" onKeyDown={(e) => e.key === 'Enter' && addCustom()} />
          <button onClick={addCustom} className="shrink-0 px-4 rounded-xl border border-border text-sm font-semibold">添加</button>
        </div>
      </Field>
      {!datesOk && <p className="text-xs text-destructive">回程不能早于出发</p>}
      <PrimaryButton disabled={!valid} onClick={save}>{trip ? '保存' : '建立旅行'}</PrimaryButton>
    </div>
  );
}
