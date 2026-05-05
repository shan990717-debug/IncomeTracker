import React from 'react';
import { useLanguage } from '@/lib/i18n';
import { Landmark, Banknote } from 'lucide-react';
import { motion } from 'framer-motion';

export default function StorageCards({ record }) {
  const { t } = useLanguage();
  const bankAmount = record?.stored_bank || 0;
  const cashAmount = record?.stored_cash || 0;

  return (
    <div className="grid grid-cols-2 gap-3">
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-card rounded-2xl p-4 border border-border"
      >
        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center mb-3">
          <Landmark className="w-5 h-5 text-blue-500" />
        </div>
        <p className="text-xs text-muted-foreground font-medium">{t('inBank')}</p>
        <p className="text-xl font-bold text-foreground mt-0.5">RM {bankAmount.toFixed(2)}</p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.15 }}
        className="bg-card rounded-2xl p-4 border border-border"
      >
        <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center mb-3">
          <Banknote className="w-5 h-5 text-amber-500" />
        </div>
        <p className="text-xs text-muted-foreground font-medium">{t('inCash')}</p>
        <p className="text-xl font-bold text-foreground mt-0.5">RM {cashAmount.toFixed(2)}</p>
      </motion.div>
    </div>
  );
}