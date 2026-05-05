import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, Plus, CalendarDays, TrendingUp } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/', icon: Home, labelKey: 'dashboard' },
  { path: '/monthly', icon: CalendarDays, labelKey: 'monthly' },
  { path: '/add', icon: Plus, labelKey: 'addRecord', isCenter: true },
  { path: '/yearly', icon: TrendingUp, labelKey: 'yearly' },
  { path: '/settings', icon: null, labelKey: 'settings' },
];

export default function BottomNav() {
  const { pathname } = useLocation();
  const { t, lang, toggleLang } = useLanguage();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/80 backdrop-blur-xl border-t border-border safe-area-bottom">
      <div className="max-w-lg mx-auto flex items-end justify-around px-2 pt-1 pb-2">
        {navItems.map((item) => {
          if (item.isCenter) {
            return (
              <Link
                key={item.path}
                to={item.path}
                className="flex flex-col items-center -mt-5"
              >
                <div className="w-14 h-14 rounded-2xl bg-primary shadow-lg shadow-primary/30 flex items-center justify-center transform transition-transform active:scale-90">
                  <Plus className="w-7 h-7 text-primary-foreground" strokeWidth={2.5} />
                </div>
              </Link>
            );
          }

          if (item.labelKey === 'settings') {
            return (
              <button
                key="lang"
                onClick={toggleLang}
                className="flex flex-col items-center gap-0.5 py-1 px-3 min-w-[60px]"
              >
                <span className="text-xs font-bold text-muted-foreground w-6 h-6 flex items-center justify-center rounded-md">
                  {lang === 'en' ? '中' : 'EN'}
                </span>
                <span className="text-[10px] font-medium text-muted-foreground">
                  {t('language')}
                </span>
              </button>
            );
          }

          const isActive = pathname === item.path;
          const Icon = item.icon;

          return (
            <Link
              key={item.path}
              to={item.path}
              className={cn(
                "flex flex-col items-center gap-0.5 py-1 px-3 min-w-[60px] transition-colors",
                isActive ? "text-primary" : "text-muted-foreground"
              )}
            >
              <Icon className={cn("w-6 h-6", isActive && "stroke-[2.5px]")} />
              <span className={cn("text-[10px] font-medium", isActive && "font-semibold")}>
                {t(item.labelKey)}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}