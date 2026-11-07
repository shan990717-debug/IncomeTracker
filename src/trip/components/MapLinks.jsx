import React from 'react';
import { mapLinks } from '../lib/geo';

/** Open the place in Naver / Kakao / Google Maps (apps take over on phones). */
export default function MapLinks({ place, className = '' }) {
  const l = mapLinks(place);
  const btn = 'flex-1 rounded-xl border border-border py-2 text-xs font-bold text-center flex items-center justify-center gap-1.5';
  return (
    <div className={`flex gap-2 ${className}`}>
      <a href={l.naver} target="_blank" rel="noreferrer" className={btn}><span className="w-4 h-4 rounded bg-[#03C75A] text-white text-[10px] leading-4">N</span>Naver</a>
      <a href={l.kakao} target="_blank" rel="noreferrer" className={btn}><span className="w-4 h-4 rounded bg-[#FEE500] text-black text-[10px] leading-4">K</span>Kakao</a>
      <a href={l.google} target="_blank" rel="noreferrer" className={btn}><span className="w-4 h-4 rounded bg-[#4285F4] text-white text-[10px] leading-4">G</span>Google</a>
    </div>
  );
}
