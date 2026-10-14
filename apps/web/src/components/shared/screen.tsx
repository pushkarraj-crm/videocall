import { cn } from '@/lib/utils';
import { layout } from '@/lib/design-tokens';

interface ScreenProps {
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
  pad?: boolean;
}

/** Standard app page shell — consistent background, padding, entrance. */
export function Screen({ children, className, glow = true, pad = true }: ScreenProps) {
  return (
    <div
      className={cn(
        glow && layout.page,
        'animate-fade-in min-h-full',
        pad && layout.pagePad,
        className,
      )}
    >
      {children}
    </div>
  );
}