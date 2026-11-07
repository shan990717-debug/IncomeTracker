import React, { Suspense, lazy } from 'react';

// Leaflet is ~150 KB; only load it when a map is actually shown.
const TripMap = lazy(() => import('./TripMap'));

export default function LazyMap(props) {
  return (
    <Suspense fallback={<div className={`rounded-2xl bg-muted animate-pulse ${props.className || 'h-72'}`} />}>
      <TripMap {...props} />
    </Suspense>
  );
}
