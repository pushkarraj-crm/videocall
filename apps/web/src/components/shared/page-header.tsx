import { cn } from '@/lib/utils';
import { typography, layout } from '@/lib/design-tokens';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}

export function PageHeader({ title, subtitle, icon, action, className }: PageHeaderProps) {
  return (
    <div className={cn(layout.pageHeader, className)}>
      <div className="flex items-center gap-3">
        {icon && (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#FF2E74]/15">
            {icon}
          </div>
        )}
        <div>
          <h1 className={typography.pageTitle}>{title}</h1>
          {subtitle && <p className={typography.pageSubtitle}>{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}