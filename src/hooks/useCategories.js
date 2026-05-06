import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { base44 } from '@/api/base44Client';
import { seedDefaultCategories } from '@/lib/seedCategories';

export function useIncomeSources() {
  useEffect(() => { seedDefaultCategories(); }, []);

  const { data = [], isLoading, refetch } = useQuery({
    queryKey: ['incomeSources'],
    queryFn: () => base44.entities.IncomeSource.list('sort_order', 50),
    staleTime: 30000,
  });

  return {
    sources: data.filter(s => s.is_active !== false).sort((a, b) => (a.sort_order || 99) - (b.sort_order || 99)),
    allSources: data.sort((a, b) => (a.sort_order || 99) - (b.sort_order || 99)),
    isLoading,
    refetch,
  };
}

export function useDeductionCategories() {
  useEffect(() => { seedDefaultCategories(); }, []);

  const { data = [], isLoading, refetch } = useQuery({
    queryKey: ['deductionCategories'],
    queryFn: () => base44.entities.DeductionCategory.list('sort_order', 50),
    staleTime: 30000,
  });

  return {
    categories: data.filter(d => d.is_active !== false).sort((a, b) => (a.sort_order || 99) - (b.sort_order || 99)),
    allCategories: data.sort((a, b) => (a.sort_order || 99) - (b.sort_order || 99)),
    isLoading,
    refetch,
  };
}