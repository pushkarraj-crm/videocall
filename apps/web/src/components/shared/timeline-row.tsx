import { cn } from '@/lib/utils';

interface TimelineRowProps {
  title: string;
  subtitle?: string;
  meta?: string;
  amount?: string;
  amountPositive?: boolean;
  badge?: React.ReactNode;
  className?: string;
}

export function TimelineList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn('premium-card divide-y divide-white/6 overflow-hidden', className)}>{children}</div>;
}

export function TimelineRow({
  title,
  subtitle,
  meta,
  amount,
  amountPositive,
  badge,
  className,
}: TimelineRowProps) {
  return (
    <div className={cn('flex items-start justify-between gap-4 px-4 py-4', className)}>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-medium text-white">{title}</p>
          {badge}
        </div>
        {subtitle && <p className="mt-0.5 text-xs text-[#A7A7B3]">{subtitle}</p>}
        {meta && <p className="mt-1 text-[10px] tabular-nums text-[#A7A7B3]/70">{meta}</p>}
      </div>
      {amount && (
        <p
          className={cn(
            'shrink-0 text-sm font-semibold tabular-nums',
            amountPositive ? 'text-emerald-400' : 'text-white',
          )}
        >
          {amount}
        </p>
      )}
    </div>
  );
}