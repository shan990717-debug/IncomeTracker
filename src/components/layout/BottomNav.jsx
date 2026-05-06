import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, CalendarDays, Layers, FileText, Target, BarChart2, Settings, Receipt } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const navItems = [
  { path: '/',           icon: Home,         en: 'Home',      zh: '主页' },
  { path: '/today',      icon: FileText,      en: 'Today',     zh: '今日' },
  { path: '/calendar',   icon: CalendarDays,  en: 'Calendar',  zh: '日历' },
  { path: '/settlement', icon: Layers,        en: 'Settle',    zh: '结算' },
  { path: '/claims',     icon: FileText,      en: 'Claims',    zh: '报销' },
  { path: '/goals',      icon: Target,        en: 'Goals',     zh: '目标' },
  { path: '/review',     icon: BarChart2,     en: 'Review',    zh: '回顾' },
];

// Show 5 at a time, with a lang toggle replacing one slot
export default function BottomNav() {
  const { pathname } = useLocation();
  const { lang, toggleLang } = useLanguage();

  const visibleItems = navItems.slice(0, 5);
  const extraItems = navItems.slice(5);

  // Always show: Home, Today, Calendar, Settle, +more
  const displayItems = [
    { path: '/',           icon: Home,         en: 'Home',      zh: '主页' },
    { path: '/today',      icon: FileText,      en: 'Today',     zh: '今日' },
    { path: '/settlement', icon: Layers,        en: 'Settle',    zh: '结算' },
    { path: '/review',     icon: BarChart2,     en: 'Review',    zh: '回顾' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/90 backdrop-blur-xl border-t border-border">
      <div className="max-w-lg mx-auto flex items-center justify-around px-1 pt-1 pb-safe pb-2">
        {displayItems.map(item => {
          const Icon = item.icon;
          const isActive = pathname === item.path;
          return (
            <Link key={item.path} to={item.path}
              className={cn("flex flex-col items-center gap-0.5 py-1 px-3 min-w-[56px] rounded-xl transition-colors",
                isActive ? "text-primary" : "text-muted-foreground")}>
              <Icon className={cn("w-5 h-5", isActive && "stroke-[2.5px]")} />
              <span className={cn("text-[10px] font-medium", isActive && "font-bold")}>{lang === 'zh' ? item.zh : item.en}</span>
            </Link>
          );
        })}

        {/* More menu: Goals + Claims + Calendar + Lang */}
        <MoreMenu lang={lang} toggleLang={toggleLang} pathname={pathname} />
      </div>
    </nav>
  );
}

function MoreMenu({ lang, toggleLang, pathname }) {
  const [open, setOpen] = React.useState(false);
  const moreItems = [
    { path: '/bills',      icon: Receipt,       en: 'Bills',     zh: '账单' },
    { path: '/calendar',   icon: CalendarDays,  en: 'Calendar',  zh: '日历' },
    { path: '/claims',     icon: FileText,      en: 'Claims',    zh: '报销' },
    { path: '/goals',      icon: Target,        en: 'Goals',     zh: '目标' },
    { path: '/settings',   icon: Settings,      en: 'Settings',  zh: '设置' },
  ];
  const anyActive = moreItems.some(i => i.path === pathname);

  return (
    <div className="relative">
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute bottom-12 right-0 bg-card border border-border rounded-2xl shadow-xl z-50 p-2 min-w-[140px]">
            {moreItems.map(item => {
              const Icon = item.icon;
              const isActive = pathname === item.path;
              return (
                <Link key={item.path} to={item.path} onClick={() => setOpen(false)}
                  className={cn("flex items-center gap-2 px-3 py-2.5 rounded-xl transition-colors",
                    isActive ? "bg-primary/10 text-primary" : "hover:bg-secondary text-foreground")}>
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{lang === 'zh' ? item.zh : item.en}</span>
                </Link>
              );
            })}
            <div className="border-t border-border mt-1 pt-1">
              <button onClick={toggleLang}
                className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-secondary text-foreground transition-colors">
                <span className="text-base">🌐</span>
                <span className="text-sm font-medium">{lang === 'en' ? '中文' : 'English'}</span>
              </button>
            </div>
          </div>
        </>
      )}
      <button onClick={() => setOpen(v => !v)}
        className={cn("flex flex-col items-center gap-0.5 py-1 px-3 min-w-[56px] rounded-xl transition-colors",
          anyActive || open ? "text-primary" : "text-muted-foreground")}>
        <span className="text-lg leading-5 font-bold">···</span>
        <span className={cn("text-[10px] font-medium", (anyActive || open) && "font-bold text-primary")}>{lang === 'zh' ? '更多' : 'More'}</span>
      </button>
    </div>
  );
}