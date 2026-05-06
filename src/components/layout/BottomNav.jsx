import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, CalendarDays, Wallet, FileText, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const NAV_ITEMS_LEFT = [
  { path: '/',         icon: Home,        label: 'Home' },
  { path: '/review',   icon: CalendarDays, label: 'Review' },
];

const NAV_ITEMS_RIGHT = [
  { path: '/settlement', icon: Wallet,   label: 'Settle' },
  { path: '/bills',      icon: FileText, label: 'Bills' },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 max-w-lg mx-auto">
      <div className="bg-card border-t border-border flex items-center justify-around px-2 pb-safe">
        {/* Left items */}
        {NAV_ITEMS_LEFT.map(({ path, icon: Icon, label }) => (
          <Link key={path} to={path}
            className={`flex flex-col items-center justify-center flex-1 py-3 gap-0.5 transition-colors ${
              isActive(path) ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}>
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-semibold">{label}</span>
          </Link>
        ))}

        {/* Center + button */}
        <div className="flex flex-col items-center justify-center flex-1">
          <button
            onClick={() => navigate('/today')}
            className="w-14 h-14 -mt-6 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all">
            <Plus className="w-7 h-7" />
          </button>
        </div>

        {/* Right items */}
        {NAV_ITEMS_RIGHT.map(({ path, icon: Icon, label }) => (
          <Link key={path} to={path}
            className={`flex flex-col items-center justify-center flex-1 py-3 gap-0.5 transition-colors ${
              isActive(path) ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}>
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-semibold">{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}