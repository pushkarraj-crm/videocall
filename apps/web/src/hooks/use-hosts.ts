'use client';

import { useCallback, useEffect, useState } from 'react';
import { hostsApi } from '@/lib/api/hosts';
import {
  filterHosts,
  sortFeatured,
  type DiscoverFilters,
  defaultFilters,
} from '@/lib/host-filters';
import type { HostDiscoverItem } from '@/types/api';

export function useHosts(initialFilters?: Partial<DiscoverFilters>) {
  const [allHosts, setAllHosts] = useState<HostDiscoverItem[]>([]);
  const [filters, setFiltersState] = useState<DiscoverFilters>({
    ...defaultFilters,
    ...initialFilters,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await hostsApi.discover(1, 50);
      setAllHosts(res.hosts ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load hosts');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const setFilters = useCallback((patch: Partial<DiscoverFilters>) => {
    setFiltersState((prev) => ({ ...prev, ...patch }));
  }, []);

  const resetFilters = useCallback(() => {
    setFiltersState({ ...defaultFilters, ...initialFilters });
  }, [initialFilters]);

  const filtered = filterHosts(allHosts, filters);
  const featured = sortFeatured(filtered).slice(0, 6);
  const online = filtered.filter((h) => h.isOnline ?? h.isAvailable);

  return {
    allHosts,
    hosts: filtered,
    filtered,
    featured,
    online,
    filters,
    setFilters,
    resetFilters,
    loading,
    error,
    refresh: load,
  };
}