import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Home, CalendarDays, Target, FileText, Plus } from 'lucide-react';

const NAV_ITEMS_LEFT = [
  { path: '/',       icon: Home,        label: 'Home',   labelZh: '首页' },
  { path: '/review', icon: CalendarDays, label: 'Month',  labelZh: '月报' },
];

const NAV_ITEMS_RIGHT = [
  { path: '/goals',  icon: Target,    label: 'Goals', labelZh: '目标' },
  { path: '/bills',  icon: FileText,  label: 'Bills', labelZh: '账单' },
];

export default function BottomNav() {
  const location = useLocation();
  const navigate = useNavigate();

  const isActive = (path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  // Detect language preference from localStorage
  const lang = localStorage.getItem('driver_app_lang') || 'en';

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 max-w-lg mx-auto">
      <div className="bg-card border-t border-border flex items-center justify-around px-2 pt-1 pb-4">
        {/* Left items */}
        {NAV_ITEMS_LEFT.map(({ path, icon: Icon, label, labelZh }) => (
          <Link key={path} to={path}
            className={`flex flex-col items-center justify-center flex-1 py-2 gap-0.5 transition-colors ${
              isActive(path) ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}>
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-semibold">{lang === 'zh' ? labelZh : label}</span>
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
        {NAV_ITEMS_RIGHT.map(({ path, icon: Icon, label, labelZh }) => (
          <Link key={path} to={path}
            className={`flex flex-col items-center justify-center flex-1 py-2 gap-0.5 transition-colors ${
              isActive(path) ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
            }`}>
            <Icon className="w-5 h-5" />
            <span className="text-[10px] font-semibold">{lang === 'zh' ? labelZh : label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
}