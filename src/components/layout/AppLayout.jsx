import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import BottomNav from './BottomNav.jsx';
import { Settings } from 'lucide-react';

export default function AppLayout() {
  const location = useLocation();
  const hideSettingsOn = ['/settings'];
  const showSettings = !hideSettingsOn.includes(location.pathname);

  return (
    <div className="min-h-screen bg-background max-w-lg mx-auto relative">
      {showSettings && (
        <Link to="/settings" className="fixed top-4 right-4 z-40 w-9 h-9 rounded-xl bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-foreground shadow-sm transition-colors">
          <Settings className="w-4 h-4" />
        </Link>
      )}
      <main className="pb-24">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}