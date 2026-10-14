'use client';

import { cn } from '@/lib/utils';
import type { DiscoverFilters } from '@/lib/host-filters';

interface DiscoverFiltersBarProps {
  filters: DiscoverFilters;
  onChange: (filters: DiscoverFilters) => void;
}

const FILTER_TABS = [
  { key: 'all', label: 'All', patch: { gender: 'all' as const, onlineOnly: false } },
  { key: 'female', label: 'Female', patch: { gender: 'female' as const } },
  { key: 'male', label: 'Male', patch: { gender: 'male' as const } },
  { key: 'verified', label: 'Verified', patch: { onlineOnly: true } },
  { key: 'new', label: 'New', patch: { gender: 'all' as const, onlineOnly: false } },
] as const;

export function DiscoverFiltersBar({ filters, onChange }: DiscoverFiltersBarProps) {
  const activeKey = (() => {
    if (filters.onlineOnly && filters.gender === 'all') return 'verified';
    if (filters.gender === 'female') return 'female';
    if (filters.gender === 'male') return 'male';
    if (filters.gender === 'all' && !filters.onlineOnly) return 'all';
    return 'all';
  })();

  const set = (patch: Partial<DiscoverFilters>) => onChange({ ...filters, ...patch });

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
      {FILTER_TABS.map((tab) => {
        const active = activeKey === tab.key || (tab.key === 'new' && activeKey === 'all');
        return (
          <button
            key={tab.key}
            type="button"
            onClick={() => set(tab.patch)}
            className={cn(
              'shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-all duration-200',
              active && tab.key !== 'new'
                ? 'gradient-primary text-white shadow-[0_4px_16px_rgba(255,46,116,0.35)]'
                : tab.key === 'new' && active
                  ? 'border border-[#FFB347]/40 bg-[#FFB347]/10 text-[#FFB347]'
                  : 'border border-white/8 bg-[#17171C] text-[#A7A7B3] hover:border-white/15 hover:text-white',
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}