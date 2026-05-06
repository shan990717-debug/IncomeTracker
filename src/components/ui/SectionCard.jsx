import React from 'react';
import { cn } from '@/lib/utils';

export default function SectionCard({ title, subtitle, children, className, action }) {
  return (
    <div className={cn("bg-card rounded-2xl border border-border overflow-hidden", className)}>
      {title && (
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div>
            <h3 className="text-sm font-bold text-foreground">{title}</h3>
            {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className="px-4 pb-4">{children}</div>
    </div>
  );
}