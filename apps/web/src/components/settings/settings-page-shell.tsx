import { cn } from '@/lib/utils';

type SettingsPageShellProps = {
  children: React.ReactNode;
  className?: string;
  /** Narrower content for detail lists (notifications, etc.) */
  narrow?: boolean;
};

/**
 * Centered premium container for settings + settings subpages.
 * Desktop: max ~1100–1200px, not full viewport stretch.
 */
export function SettingsPageShell({
  children,
  className,
  narrow = false,
}: SettingsPageShellProps) {
  return (
    <div className="premium-glow-bg min-h-full animate-fade-in">
      <div
        className={cn(
          'relative z-10 mx-auto w-full px-4 py-6 pb-12 sm:px-6 sm:py-8 sm:pb-14 lg:px-10 lg:py-10',
          narrow ? 'max-w-[900px]' : 'max-w-[1200px]',
          className,
        )}
      >
        {children}
      </div>
    </div>
  );
}
