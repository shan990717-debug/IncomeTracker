import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useLanguage } from '@/lib/i18n';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Plus, Minus, Receipt, FileText, Wallet, Target } from 'lucide-react';
import { monthStr } from '@/lib/finance';

const QUICK_OPTIONS = [
  {
    key: 'daily_income',
    icon: Plus,
    label: 'Add Daily Income',
    labelZh: '添加每日收入',
    color: 'bg-primary text-primary-foreground',
    path: '/today',
  },
  {
    key: 'bill_payment',
    icon: Receipt,
    label: 'Add Bill / Payment',
    labelZh: '添加账单/付款',
    color: 'bg-blue-500 text-white',
    path: () => `/bills/payment/new?new=1&month=${monthStr()}&section=others`,
  },
  {
    key: 'family_claim',
    icon: FileText,
    label: 'Add Family Claim',
    labelZh: '添加家庭报销',
    color: 'bg-indigo-500 text-white',
    path: '/family-claim/new',
  },
  {
    key: 'see_may',
    icon: Wallet,
    label: 'Add See May Payment',
    labelZh: '添加 See May 付款',
    color: 'bg-purple-500 text-white',
    path: () => `/bills/payment/new?new=1&month=${monthStr()}&section=shared_family`,
  },
  {
    key: 'goal',
    icon: Target,
    label: 'Add Goal Contribution',
    labelZh: '添加目标储蓄',
    color: 'bg-teal-500 text-white',
    path: '/goals',
  },
];

export default function QuickAddModal({ open, onClose }) {
  const { lang } = useLanguage();
  const navigate = useNavigate();

  const handleSelect = (opt) => {
    onClose();
    const path = typeof opt.path === 'function' ? opt.path() : opt.path;
    navigate(path);
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-6"
          style={{ background: 'rgba(0,0,0,0.5)' }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="w-full max-w-lg bg-card rounded-3xl p-5 space-y-3 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-1">
              <p className="text-base font-bold">{lang === 'zh' ? '快速添加' : 'Quick Add'}</p>
              <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-secondary transition-colors">
                <X className="w-4 h-4 text-muted-foreground" />
              </button>
            </div>

            <div className="space-y-2">
              {QUICK_OPTIONS.map(opt => {
                const Icon = opt.icon;
                return (
                  <button
                    key={opt.key}
                    onClick={() => handleSelect(opt)}
                    className="w-full flex items-center gap-4 p-4 rounded-2xl border border-border hover:border-primary/30 hover:bg-secondary/50 transition-all text-left"
                  >
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${opt.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <span className="font-semibold text-sm">
                      {lang === 'zh' ? opt.labelZh : opt.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}