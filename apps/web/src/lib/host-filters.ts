import type { HostDiscoverItem } from '@/types/api';

export interface DiscoverFilters {
  gender: string;
  language: string;
  region: string;
  onlineOnly: boolean;
  search: string;
}

export const defaultFilters: DiscoverFilters = {
  gender: 'all',
  language: 'all',
  region: 'all',
  onlineOnly: true,
  search: '',
};

export function filterHosts(hosts: HostDiscoverItem[], filters: DiscoverFilters): HostDiscoverItem[] {
  return hosts.filter((host) => {
    if (filters.onlineOnly && !(host.isOnline ?? host.isAvailable)) return false;
    if (filters.gender !== 'all' && host.user.gender !== filters.gender) return false;
    if (filters.language !== 'all' && host.user.primaryLanguage !== filters.language) return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      const name = host.user.displayName?.toLowerCase() ?? '';
      const bio = host.user.bio?.toLowerCase() ?? '';
      if (!name.includes(q) && !bio.includes(q)) return false;
    }
    return true;
  });
}

export function sortFeatured(hosts: HostDiscoverItem[]): HostDiscoverItem[] {
  return [...hosts].sort((a, b) => {
    const ratingA = a.rating ?? 0;
    const ratingB = b.rating ?? 0;
    if (ratingB !== ratingA) return ratingB - ratingA;
    return (b.totalCalls ?? 0) - (a.totalCalls ?? 0);
  });
}