import { AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { typography } from '@/lib/design-tokens';

export function ErrorState({
  title = 'Something went wrong',
  message,
  code,
  onRetry,
  retryLabel = 'Try again',
  onSecondary,
  secondaryLabel = 'Go home',
  className,
}: {
  title?: string;
  message?: string;
  code?: string;
  onRetry?: () => void;
  retryLabel?: string;
  onSecondary?: () => void;
  secondaryLabel?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'animate-fade-in flex min-h-[40vh] flex-col items-center justify-center gap-4 p-6 text-center',
        className,
      )}
    >
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-red-500/10 ring-1 ring-red-500/20">
        <AlertCircle className="h-7 w-7 text-red-400" aria-hidden />
      </div>
      <div className="max-w-sm">
        <h3 className={typography.sectionTitle}>{title}</h3>
        {message && <p className={cn(typography.caption, 'mt-1.5')}>{message}</p>}
        {code && process.env.NODE_ENV === 'development' && (
          <p className="mt-2 font-mono text-[10px] text-[#A7A7B3]/60">Error: {code}</p>
        )}
      </div>
      <div className="flex w-full max-w-xs flex-col gap-2 sm:flex-row sm:justify-center">
        {onRetry && (
          <Button variant="outline" className="border-white/10 bg-white/5" onClick={onRetry}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {retryLabel}
          </Button>
        )}
        {onSecondary && (
          <Button variant="ghost" className="text-[#A7A7B3] hover:text-white" onClick={onSecondary}>
            {secondaryLabel}
          </Button>
        )}
      </div>
    </div>
  );
}