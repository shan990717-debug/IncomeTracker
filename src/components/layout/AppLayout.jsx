import React from 'react';
import { Outlet } from 'react-router-dom';
import BottomNav from './BottomNav.jsx';

export default function AppLayout() {
  return (
    <div className="min-h-screen bg-background max-w-lg mx-auto relative">
      <main className="pb-24">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}