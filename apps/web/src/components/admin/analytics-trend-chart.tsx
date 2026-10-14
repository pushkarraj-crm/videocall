'use client';

import { cn, formatInr } from '@/lib/utils';

interface TrendPoint {
  date: string;
  value: number;
}

interface AnalyticsTrendChartProps {
  title: string;
  subtitle?: string;
  data: TrendPoint[];
  valueLabel?: (value: number) => string;
  accentClass?: string;
}

export function AnalyticsTrendChart({
  title,
  subtitle,
  data,
  valueLabel = (v) => formatInr(v),
  accentClass = 'from-[#FF2E74] to-[#FF6B9D]',
}: AnalyticsTrendChartProps) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#17171C] to-[#1E1E26] p-5 shadow-[0_8px_32px_rgba(0,0,0,0.25)]">
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold text-white">{title}</h3>
          {subtitle && <p className="text-xs text-[#A7A7B3]">{subtitle}</p>}
        </div>
        <p className="text-xs text-[#A7A7B3]">{data.length} days</p>
      </div>

      <div className="flex h-44 items-end gap-1">
        {data.map((point) => {
          const height = Math.max(6, Math.round((point.value / max) * 100));
          return (
            <div
              key={point.date}
              className="group relative flex flex-1 flex-col items-center justify-end"
            >
              <div
                className={cn(
                  'w-full rounded-t-md bg-gradient-to-t opacity-90 transition-opacity group-hover:opacity-100',
                  accentClass,
                )}
                style={{ height: `${height}%` }}
              />
              <div className="pointer-events-none absolute -top-10 z-10 hidden rounded-md bg-black/90 px-2 py-1 text-[10px] text-white group-hover:block">
                <p>{new Date(point.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</p>
                <p className="font-semibold">{valueLabel(point.value)}</p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}