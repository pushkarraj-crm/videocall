import { cn } from '@/lib/utils';

export function GradientBg({ className }: { className?: string }) {
  return (
    <div
      className={cn('pointer-events-none fixed inset-0 -z-10 overflow-hidden', className)}
      aria-hidden
    >
      <div className="absolute -left-1/4 -top-1/4 h-[60%] w-[60%] rounded-full bg-primary/20 blur-3xl" />
      <div className="absolute -bottom-1/4 -right-1/4 h-[50%] w-[50%] rounded-full bg-accent/20 blur-3xl" />
    </div>
  );
}