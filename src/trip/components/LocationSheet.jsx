import React, { useEffect, useState } from 'react';
import { coordsOf, REGION_CENTER } from '../lib/geo';
import { Sheet, PrimaryButton } from './ui';
import LazyMap from './LazyMap';

/**
 * Tap the map to set an exact spot. `place` is a save or lodging; onSave gets
 * { lat, lng, geo: 'manual' } or, when cleared, { lat: null, lng: null, geo: '' }.
 */
export default function LocationSheet({ open, onClose, place, onSave, kind = 'place' }) {
  const [pt, setPt] = useState(null);
  useEffect(() => {
    if (!open || !place) return;
    const c = coordsOf(place);
    setPt(c ? { lat: c.lat, lng: c.lng, precise: c.precise } : null);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!place) return null;

  const center = REGION_CENTER[place.region];
  const pins = pt ? [{ id: 'pt', lat: pt.lat, lng: pt.lng, label: kind === 'hotel' ? '🛏' : '📍', kind, precise: pt.precise, square: kind === 'hotel' }] : [];

  return (
    <Sheet open={open} onClose={onClose} title="设置位置"
      footer={
        <div className="flex gap-2">
          <button onClick={() => { onSave({ lat: null, lng: null, geo: '' }); onClose(); }}
            className="shrink-0 rounded-xl border border-border px-3 text-xs font-semibold text-muted-foreground">清除</button>
          <PrimaryButton disabled={!pt?.precise} onClick={() => { onSave({ lat: pt.lat, lng: pt.lng, geo: 'manual' }); onClose(); }}>保存这个位置</PrimaryButton>
        </div>
      }>
      <p className="text-xs text-muted-foreground mb-2">
        在地图上点一下正确的位置。{pt && !pt.precise ? '现在的虚线图钉只是商圈的大概位置。' : ''}
        找不到的话，先用下面的 Naver 搜到地点，再回来对照着点。
      </p>
      <LazyMap className="h-[52dvh]" region={place.region} pins={pins} fitKey={open ? 'open' : 'closed'}
        onMapClick={(ll) => setPt({ lat: ll.lat, lng: ll.lng, precise: true })} />
      {!pt && !center && <p className="text-[11px] text-muted-foreground mt-2">这个地区没有默认中心点，请把地图拖到目的地附近。</p>}
    </Sheet>
  );
}
