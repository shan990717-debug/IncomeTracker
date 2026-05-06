import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { FileText, CalendarDays, Wallet, BarChart2 } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const NAV_ITEMS = [
  { path: '/today',  icon: FileText,     en: 'Today',  zh: '今日' },
  { path: '/month',  icon: CalendarDays, en: 'Month',  zh: '月度' },
  { path: '/wallet', icon: Wallet,       en: 'Wallet', zh: '钱包' },
  { path: '/review', icon: BarChart2,    en: 'Review', zh: '回顾' },
];

export default function BottomNav() {
  const { pathname } = useLocation();
  const { lang } = useLanguage();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-card/95 backdrop-blur-xl border-t border-border">
      <div className="max-w-lg mx-auto flex items-stretch justify-around px-2 pt-2 pb-3">
        {NAV_ITEMS.map(item => {
          const Icon = item.icon;
          const isActive = pathname === item.path || (pathname === '/' && item.path === '/today');
          return (
            <Link key={item.path} to={item.path}
              className={cn(
                "flex flex-col items-center gap-1 py-1 px-4 rounded-2xl transition-all",
                isActive
                  ? "text-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground"
              )}>
              <Icon className={cn("w-5 h-5", isActive && "stroke-[2.5px]")} />
              <span className={cn("text-[10px] font-medium", isActive && "font-bold")}>{lang === 'zh' ? item.zh : item.en}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}