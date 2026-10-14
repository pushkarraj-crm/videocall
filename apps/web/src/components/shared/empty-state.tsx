import { cn } from '@/lib/utils';
import { typography } from '@/lib/design-tokens';

export function EmptyState({
  icon: Icon,
  illustration,
  title,
  description,
  action,
  className,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  illustration?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'animate-fade-in flex flex-col items-center justify-center gap-4 py-16 text-center',
        className,
      )}
    >
      {illustration ?? (
        <div className="relative flex h-20 w-20 items-center justify-center rounded-full bg-white/5 ring-1 ring-white/10">
          {Icon && <Icon className="h-9 w-9 text-[#A7A7B3]/60" aria-hidden />}
          <div className="absolute -inset-2 rounded-full bg-[#FF2E74]/5 blur-xl" aria-hidden />
        </div>
      )}
      <div className="max-w-xs">
        <h3 className={typography.sectionTitle}>{title}</h3>
        {description && <p className={cn(typography.caption, 'mt-1.5 leading-relaxed')}>{description}</p>}
      </div>
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}