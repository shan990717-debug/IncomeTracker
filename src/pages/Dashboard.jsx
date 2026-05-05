import React from 'react';
import { useLanguage } from '@/lib/i18n';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import TodaySummaryCard from '@/components/dashboard/TodaySummaryCard';
import StorageCards from '@/components/dashboard/StorageCards';
import RecentRecordsList from '@/components/dashboard/RecentRecordsList';
import { Car } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Dashboard() {
  const { t } = useLanguage();
  const todayStr = format(new Date(), 'yyyy-MM-dd');

  const { data: records = [], isLoading } = useQuery({
    queryKey: ['dailyRecords'],
    queryFn: () => base44.entities.DailyRecord.list('-date', 30),
  });

  const todayRecord = records.find(r => r.date === todayStr);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="px-5 pt-14 pb-4 space-y-5">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center">
              <Car className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground leading-tight">{t('appName')}</h1>
              <p className="text-xs text-muted-foreground">{format(new Date(), 'EEEE, MMM d, yyyy')}</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Today's Summary */}
      <TodaySummaryCard record={todayRecord} />

      {/* Storage */}
      <StorageCards record={todayRecord} />

      {/* Recent Records */}
      <RecentRecordsList records={records} />
    </div>
  );
}