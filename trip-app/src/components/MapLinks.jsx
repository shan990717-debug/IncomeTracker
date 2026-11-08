import React from 'react';
import { mapLinks } from '../lib/geo';

/** Open the place in Google (reviews) / Naver / Kakao. */
export default function MapLinks({ place }) {
  const l = mapLinks(place);
  const btn = 'flex-1 rounded-xl border border-border bg-card py-2.5 text-xs font-bold text-center flex flex-col items-center gap-1';
  return (
    <div className="flex gap-2">
      <a href={l.google} target="_blank" rel="noreferrer" className={btn}><span className="text-base leading-none">⭐</span>Google 评论</a>
      <a href={l.naver} target="_blank" rel="noreferrer" className={btn}><span className="w-5 h-5 rounded bg-[#03C75A] text-white text-[11px] leading-5">N</span>Naver</a>
      <a href={l.kakao} target="_blank" rel="noreferrer" className={btn}><span className="w-5 h-5 rounded bg-[#FEE500] text-black text-[11px] leading-5">K</span>Kakao</a>
    </div>
  );
}
