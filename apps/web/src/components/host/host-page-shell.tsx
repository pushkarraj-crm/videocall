import { cn } from '@/lib/utils';

/** Centered premium container for host dashboard / earnings / withdraw. */
export function HostPageShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className="premium-glow-bg min-h-full animate-fade-in">
      <div
        className={cn(
          'relative z-10 mx-auto w-full max-w-[1400px] px-4 py-6 pb-12 sm:px-6 sm:py-8 sm:pb-14 lg:px-10 lg:py-10 xl:px-12',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}

export function HostStatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#17171C]/95 p-4 shadow-[0_8px_28px_rgba(0,0,0,0.25)] sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.1em] text-[#A7A7B3]">
            {label}
          </p>
          <p
            className={cn(
              'mt-1.5 truncate text-2xl font-bold tracking-tight sm:text-[1.65rem]',
              accent ?? 'text-white',
            )}
          >
            {value}
          </p>
          {sub && <p className="mt-1 text-xs text-[#A7A7B3] sm:text-[13px]">{sub}</p>}
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#FF2E74]/12 sm:h-11 sm:w-11">
          <Icon className="h-5 w-5 text-[#FF2E74]" />
        </div>
      </div>
    </div>
  );
}
