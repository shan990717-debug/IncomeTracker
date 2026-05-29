import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, BookOpen, BarChart2, FileText, Plus } from 'lucide-react';
import QuickAddModal from '@/components/layout/QuickAddModal';

const NAV_ITEMS_LEFT = [
  { path: '/',        icon: Home,      label: 'Overview', labelZh: '总览' },
  { path: '/records', icon: BookOpen,  label: 'Records',  labelZh: '记录' },
];

const NAV_ITEMS_RIGHT = [
  { path: '/planning', icon: BarChart2, label: 'Planning', labelZh: '规划' },
  { path: '/bills',    icon: FileText,  label: 'Bills',    labelZh: '账单' },
];

export default function BottomNav() {
  const location = useLocation();
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const lang = localStorage.getItem('driver_app_lang') || 'en';

  const isActive = (path) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  return (
    <>
      <nav className="fixed bottom-0 left-0 right-0 z-40 max-w-lg mx-auto select-none">
        <div className="bg-card border-t border-border flex items-center justify-around px-2 pt-1" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>
          {NAV_ITEMS_LEFT.map(({ path, icon: Icon, label, labelZh }) => (
            <Link key={path} to={path}
              className={`select-none flex flex-col items-center justify-center flex-1 py-2 gap-0.5 transition-colors ${
                isActive(path) ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}>
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-semibold">{lang === 'zh' ? labelZh : label}</span>
            </Link>
          ))}

          {/* Center + button */}
          <div className="flex flex-col items-center justify-center flex-1">
            <button
              onClick={() => setShowQuickAdd(true)}
              className="select-none w-14 h-14 -mt-6 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-all">
              <Plus className="w-7 h-7" />
            </button>
          </div>

          {NAV_ITEMS_RIGHT.map(({ path, icon: Icon, label, labelZh }) => (
            <Link key={path} to={path}
              className={`select-none flex flex-col items-center justify-center flex-1 py-2 gap-0.5 transition-colors ${
                isActive(path) ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              }`}>
              <Icon className="w-5 h-5" />
              <span className="text-[10px] font-semibold">{lang === 'zh' ? labelZh : label}</span>
            </Link>
          ))}
        </div>
      </nav>

      <QuickAddModal open={showQuickAdd} onClose={() => setShowQuickAdd(false)} />
    </>
  );
}