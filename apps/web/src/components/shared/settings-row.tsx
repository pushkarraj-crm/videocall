import Link from 'next/link';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';

interface SettingsRowProps {
  icon?: LucideIcon;
  label: string;
  description?: string;
  href?: string;
  onClick?: () => void;
  trailing?: React.ReactNode;
  switchChecked?: boolean;
  onSwitchChange?: (v: boolean) => void;
  switchDisabled?: boolean;
  destructive?: boolean;
  className?: string;
}

/** Section card with optional title — compact, not full-viewport stretch. */
export function SettingsGroup({
  children,
  title,
  className,
}: {
  children: React.ReactNode;
  title?: string;
  className?: string;
}) {
  return (
    <section className={cn('space-y-3', className)}>
      {title && (
        <p className="px-0.5 text-xs font-semibold uppercase tracking-[0.12em] text-[#A7A7B3]">
          {title}
        </p>
      )}
      <div className="overflow-hidden rounded-2xl border border-white/8 bg-[#17171C]/90 shadow-[0_8px_32px_rgba(0,0,0,0.25)] divide-y divide-white/6">
        {children}
      </div>
    </section>
  );
}

export function SettingsRow({
  icon: Icon,
  label,
  description,
  href,
  onClick,
  trailing,
  switchChecked,
  onSwitchChange,
  switchDisabled,
  destructive,
  className,
}: SettingsRowProps) {
  const content = (
    <>
      {Icon && (
        <div
          className={cn(
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl',
            destructive ? 'bg-red-500/15' : 'bg-white/5',
          )}
        >
          <Icon className={cn('h-4 w-4', destructive ? 'text-red-400' : 'text-[#FF2E74]')} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p
          className={cn(
            'text-sm font-semibold sm:text-[15px]',
            destructive ? 'text-red-400' : 'text-white',
          )}
        >
          {label}
        </p>
        {description && (
          <p className="mt-0.5 text-xs leading-relaxed text-[#A7A7B3] sm:text-[13px]">
            {description}
          </p>
        )}
      </div>
      {onSwitchChange != null || switchChecked != null ? (
        <Switch
          checked={switchChecked}
          disabled={switchDisabled ?? onSwitchChange == null}
          onCheckedChange={onSwitchChange ?? (() => {})}
        />
      ) : trailing ? (
        trailing
      ) : href ? (
        <ChevronRight className="h-4 w-4 shrink-0 text-[#A7A7B3]/60" aria-hidden />
      ) : null}
    </>
  );

  const rowClass = cn(
    'flex items-center gap-3 px-4 py-3.5 transition-colors sm:px-5 sm:py-4',
    (href || onClick) && 'hover:bg-white/[0.03]',
    className,
  );

  if (href) {
    return (
      <Link href={href} className={rowClass}>
        {content}
      </Link>
    );
  }

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cn(rowClass, 'w-full text-left')}>
        {content}
      </button>
    );
  }

  return <div className={rowClass}>{content}</div>;
}
