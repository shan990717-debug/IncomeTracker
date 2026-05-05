import React from 'react';
import { useLanguage } from '@/lib/i18n';
import { format } from 'date-fns';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

export default function RecentRecordsList({ records }) {
  const { t } = useLanguage();

  if (!records || records.length === 0) {
    return (
      <div className="text-center py-10">
        <p className="text-muted-foreground text-sm">{t('noRecords')}</p>
        <p className="text-xs text-muted-foreground/60 mt-1">{t('startTracking')}</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-semibold text-foreground px-1">{t('recentRecords')}</h3>
      {records.slice(0, 7).map((record, i) => (
        <motion.div
          key={record.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.05 }}
        >
          <Link
            to={`/add?date=${record.date}&edit=${record.id}`}
            className="flex items-center justify-between bg-card rounded-2xl p-4 border border-border hover:border-primary/30 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                <span className="text-sm font-bold text-primary">
                  {format(new Date(record.date), 'dd')}
                </span>
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {format(new Date(record.date), 'EEE, MMM d')}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('income')}: RM {(record.total_income || 0).toFixed(0)} · {t('expense')}: RM {(record.total_expense || 0).toFixed(0)}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-bold ${(record.actual_income || 0) >= 0 ? 'text-primary' : 'text-destructive'}`}>
                RM {(record.actual_income || 0).toFixed(2)}
              </span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </Link>
        </motion.div>
      ))}
    </div>
  );
}