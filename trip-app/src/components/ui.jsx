import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { X, Star } from 'lucide-react';
import { cn } from '../lib/utils';
import { categoryOf } from '../lib/parse';

/** Bottom sheet that behaves well with the on-screen keyboard (no drag-to-close). */
export function Sheet({ open, onClose, title, children, footer }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Portal: a sheet opened from inside another sheet must not inherit its transform.
  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <motion.div className="absolute inset-0 bg-black/40" onClick={onClose}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} />
          <motion.div role="dialog" aria-label={title}
            className="relative w-full max-w-lg bg-background rounded-t-3xl shadow-2xl flex flex-col max-h-[92dvh]"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }} transition={{ type: 'spring', damping: 30, stiffness: 320 }}>
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <h2 className="text-base font-bold">{title}</h2>
              <button onClick={onClose} aria-label="关闭" className="w-8 h-8 -mr-1 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="overflow-y-auto px-5 pb-4 flex-1">{children}</div>
            {footer && <div className="px-5 pt-3 border-t border-border" style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}>{footer}</div>}
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

export function Stars({ value = 0, onChange, size = 'w-5 h-5' }) {
  const star = (n) => <Star className={cn(size, n <= value ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/40')} />;
  // Read-only stars are plain icons so they can sit inside a clickable card.
  if (!onChange) {
    return <div className="flex gap-0.5" aria-label={`${value} 星`}>{[1, 2, 3, 4, 5].map((n) => <span key={n}>{star(n)}</span>)}</div>;
  }
  return (
    <div className="flex gap-0.5" role="radiogroup" aria-label="评分">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" aria-label={`${n} 星`}
          onClick={(e) => { e.stopPropagation(); onChange(n === value ? 0 : n); }}
          className="p-0.5 -m-0.5 active:scale-90 transition-transform">
          {star(n)}
        </button>
      ))}
    </div>
  );
}

export function CategoryBadge({ id, className }) {
  const c = categoryOf(id);
  return (
    <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', c.color, className)}>
      {c.emoji} {c.label}
    </span>
  );
}

export function Chip({ active, onClick, children, className }) {
  return (
    <button type="button" onClick={onClick}
      className={cn(
        'shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold border transition-colors whitespace-nowrap',
        active ? 'bg-foreground text-background border-foreground' : 'bg-card text-muted-foreground border-border hover:text-foreground',
        className,
      )}>
      {children}
    </button>
  );
}

export function Field({ label, children, hint }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      {children}
      {hint && <span className="block text-[11px] text-muted-foreground">{hint}</span>}
    </label>
  );
}

export const inputCls =
  'w-full rounded-xl border border-input bg-card px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring/40 placeholder:text-muted-foreground/60';

export function PrimaryButton({ className, ...props }) {
  return (
    <button {...props}
      className={cn('w-full rounded-xl bg-primary text-primary-foreground py-3 text-sm font-bold disabled:opacity-40 active:scale-[0.99] transition', className)} />
  );
}

export function Empty({ emoji, title, children }) {
  return (
    <div className="text-center py-12 px-6">
      <div className="text-4xl mb-3">{emoji}</div>
      <p className="font-semibold">{title}</p>
      {children && <div className="text-sm text-muted-foreground mt-1">{children}</div>}
    </div>
  );
}
