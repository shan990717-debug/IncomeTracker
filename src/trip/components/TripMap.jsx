import React, { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Polyline, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { REGION_CENTER } from '../lib/geo';

/*
 * Thin wrapper over react-leaflet with OpenStreetMap tiles (free, no key).
 * Pins are HTML divIcons: filled = exact spot, dashed/hollow = area estimate.
 * `isolate` keeps Leaflet's high z-indexes from covering our bottom sheets.
 */

const COLORS = { food: '#f97316', place: '#0ea5e9', experience: '#8b5cf6', shopping: '#ec4899', transport: '#64748b', flight: '#64748b', note: '#64748b', hotel: '#4f46e5' };

function icon({ label, color, precise = true, selected = false, square = false }) {
  const size = selected ? 38 : 30;
  const style = [
    `width:${size}px;height:${size}px`,
    `border-radius:${square ? '10px' : '50% 50% 50% 4px'}`,
    square ? '' : 'transform:rotate(-45deg)',
    `background:${precise ? color : `${color}33`}`,
    `border:2px ${precise ? 'solid #fff' : `dashed ${color}`}`,
    'box-shadow:0 2px 6px rgba(0,0,0,.3)',
    'display:flex;align-items:center;justify-content:center',
  ].join(';');
  const inner = `<span style="${square ? '' : 'transform:rotate(45deg);'}font-size:${selected ? 17 : 14}px;font-weight:800;color:${precise ? '#fff' : color};line-height:1">${label}</span>`;
  return L.divIcon({ className: '', html: `<div style="${style}">${inner}</div>`, iconSize: [size, size], iconAnchor: square ? [size / 2, size / 2] : [size / 2, size] });
}

function FitBounds({ points, fallback, fitKey, padding = 40 }) {
  const map = useMap();
  const key = points.map((p) => `${p[0].toFixed(4)},${p[1].toFixed(4)}`).join('|');
  useEffect(() => {
    if (points.length > 1) map.fitBounds(points, { padding: [padding, padding], maxZoom: 16 });
    else if (points.length === 1) map.setView(points[0], 15);
    else if (fallback) map.setView(fallback, 12);
  }, [fitKey ?? key]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

function ClickHandler({ onClick }) {
  useMapEvents({ click: (e) => onClick?.(e.latlng) });
  return null;
}

/**
 * pins: [{ id, lat, lng, label, kind, precise, square }]
 * route: [[lat,lng], …] drawn as a dashed line in order.
 * fitKey: when given, the view only re-fits when it changes (so tapping a
 *   picker doesn't zoom around); otherwise it re-fits when the pins change.
 */
export default function TripMap({ pins = [], route, region, selectedId, onPinClick, onMapClick, className = 'h-72', fitKey }) {
  const points = useMemo(() => pins.map((p) => [p.lat, p.lng]), [pins]);
  const fallback = REGION_CENTER[region] || [36.5, 127.8];

  return (
    <div className={`isolate overflow-hidden rounded-2xl border border-border bg-muted ${className}`}>
      <MapContainer center={fallback} zoom={11} className="w-full h-full" zoomControl={false} attributionControl>
        <TileLayer url="https://tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="© OpenStreetMap" maxZoom={19} />
        <FitBounds fitKey={fitKey} points={points} fallback={fallback} />
        {onMapClick && <ClickHandler onClick={onMapClick} />}
        {route?.length > 1 && <Polyline positions={route} pathOptions={{ color: '#10b981', weight: 3, dashArray: '6 8' }} />}
        {pins.map((p) => (
          <Marker key={p.id} position={[p.lat, p.lng]} zIndexOffset={p.id === selectedId ? 1000 : p.square ? 500 : 0}
            icon={icon({ label: p.label, color: COLORS[p.kind] || COLORS.place, precise: p.precise !== false, selected: p.id === selectedId, square: p.square })}
            eventHandlers={onPinClick ? { click: () => onPinClick(p) } : undefined} />
        ))}
      </MapContainer>
    </div>
  );
}
