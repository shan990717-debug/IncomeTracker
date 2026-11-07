import React, { useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { coordsOf } from '../lib/geo';
import { categoryOf } from '../lib/parse';
import { ofTrip } from '../lib/store';
import LazyMap from './LazyMap';
import MapLinks from './MapLinks';
import { CategoryBadge } from './ui';

/** All filtered saves as pins, plus the trip's lodgings, with a tap-to-preview card. */
export default function SavesMap({ saves, state, trip, region, onOpen }) {
  const [sel, setSel] = useState(null);

  const { pins, missing } = useMemo(() => {
    const out = [];
    let miss = 0;
    for (const s of saves) {
      const c = coordsOf(s);
      if (!c) { miss += 1; continue; }
      out.push({ id: s.id, ...c, label: categoryOf(s.category).emoji, kind: s.category, save: s });
    }
    for (const l of ofTrip(state.lodgings, trip)) {
      if (region !== 'all' && l.region !== region) continue;
      const c = coordsOf(l);
      if (c) out.push({ id: `h-${l.id}`, ...c, label: '🛏', kind: 'hotel', square: true, lodging: l });
    }
    return { pins: out, missing: miss };
  }, [saves, state.lodgings, trip, region]);

  const selected = pins.find((p) => p.id === sel);
  const approx = pins.filter((p) => !p.precise && !p.square).length;

  return (
    <div className="px-4 pt-3 space-y-2">
      <LazyMap className="h-[58dvh]" region={region === 'all' ? trip.regions[0] : region} pins={pins} selectedId={sel}
        fitKey={`${region}-${saves.length}`} onPinClick={(p) => setSel(p.id)} />

      <p className="text-[11px] text-muted-foreground">
        实心图钉 = 确切位置，虚线 = 只知道商圈的大概位置{approx ? `（${approx} 个）` : ''}。
        {missing > 0 && ` 另有 ${missing} 个没有位置，可在详情里设置。`}
      </p>

      {selected?.save && (
        <div className="rounded-2xl border border-border bg-card p-3 space-y-2.5 shadow-lg">
          <button className="w-full text-left flex items-start gap-3" onClick={() => onOpen(selected.save.id)}>
            {selected.save.thumbnail && <img src={selected.save.thumbnail} alt="" className="w-12 h-16 rounded-lg object-cover shrink-0" />}
            <div className="flex-1 min-w-0">
              <p className="font-semibold leading-snug">{selected.save.title}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {[selected.save.nameLocal, selected.save.area, !selected.precise && '大概位置'].filter(Boolean).join(' · ')}
              </p>
              <CategoryBadge id={selected.save.category} className="mt-1.5" />
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground mt-1" />
          </button>
          <MapLinks place={selected.save} />
        </div>
      )}
      {selected?.lodging && (
        <div className="rounded-2xl border border-border bg-card p-3">
          <p className="font-semibold">🛏 {selected.lodging.name}</p>
          <p className="text-[11px] text-muted-foreground">{selected.lodging.region} · {selected.lodging.area}{selected.precise ? '' : ' · 大概位置'}</p>
        </div>
      )}
    </div>
  );
}
