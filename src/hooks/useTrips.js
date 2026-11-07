import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useAuth } from '@/lib/AuthContext';
import { isMember } from '@/lib/trips';

// All trips the current user created or joined.
export function useMyTrips() {
  const { user } = useAuth();
  const email = user?.email;
  return useQuery({
    queryKey: ['trips', email],
    enabled: !!email,
    queryFn: async () => {
      const all = await base44.entities.Trip.list('-created_date', 200);
      return all.filter(t => isMember(t, email));
    },
  });
}

// One trip with its expenses and settlements, kept live so every member
// sees new entries without refreshing.
export function useTripData(tripId) {
  const qc = useQueryClient();

  const trip = useQuery({
    queryKey: ['trip', tripId],
    enabled: !!tripId,
    queryFn: () => base44.entities.Trip.get(tripId),
    refetchInterval: 30000,
  });
  const expenses = useQuery({
    queryKey: ['tripExpenses', tripId],
    enabled: !!tripId,
    queryFn: () => base44.entities.TripExpense.filter({ trip_id: tripId }, '-date', 1000),
    refetchInterval: 30000,
  });
  const settlements = useQuery({
    queryKey: ['tripSettlements', tripId],
    enabled: !!tripId,
    queryFn: () => base44.entities.TripSettlement.filter({ trip_id: tripId }, '-date', 500),
    refetchInterval: 30000,
  });

  useEffect(() => {
    if (!tripId) return;
    const unsubs = [];
    const watch = (entity, key) => {
      try {
        const u = base44.entities[entity].subscribe?.(() => qc.invalidateQueries({ queryKey: [key, tripId] }));
        if (typeof u === 'function') unsubs.push(u);
      } catch { /* realtime unavailable: polling still works */ }
    };
    watch('Trip', 'trip');
    watch('TripExpense', 'tripExpenses');
    watch('TripSettlement', 'tripSettlements');
    return () => unsubs.forEach(u => u());
  }, [tripId, qc]);

  return {
    trip: trip.data,
    expenses: expenses.data || [],
    settlements: settlements.data || [],
    isLoading: trip.isLoading || expenses.isLoading || settlements.isLoading,
    error: trip.error,
  };
}

export function invalidateTrip(qc, tripId) {
  qc.invalidateQueries({ queryKey: ['trip', tripId] });
  qc.invalidateQueries({ queryKey: ['tripExpenses', tripId] });
  qc.invalidateQueries({ queryKey: ['tripSettlements', tripId] });
  qc.invalidateQueries({ queryKey: ['trips'] });
}
