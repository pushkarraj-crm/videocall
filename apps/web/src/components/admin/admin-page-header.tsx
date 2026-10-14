import { cn } from '@/lib/utils';
import { typography } from '@/lib/design-tokens';

export function AdminPageHeader({
  title,
  subtitle,
  action,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn('mb-6 flex flex-wrap items-end justify-between gap-4', className)}>
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-white">{title}</h1>
        {subtitle && <p className={cn(typography.pageSubtitle, 'mt-1')}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}