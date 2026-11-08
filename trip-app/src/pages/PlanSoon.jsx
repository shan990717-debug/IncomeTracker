import React from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { Empty } from '../components/ui';

/** 行程 tab placeholder until the itinerary + AI planning step ships. */
export default function PlanSoon() {
  const { trip } = useOutletContext();
  const navigate = useNavigate();
  return (
    <Empty emoji="🗓" title="行程功能下一步推出">
      <p>到时可以在攻略库把地点「加入行程」、选哪一天，再让 AI 按距离和用餐时间排好每天怎么走，每一段都能用 Naver Map 导航。</p>
      <button onClick={() => navigate(`/t/${trip.id}/library`)} className="mt-4 rounded-xl bg-primary text-primary-foreground px-5 py-2.5 text-sm font-bold">先去看攻略库</button>
    </Empty>
  );
}
