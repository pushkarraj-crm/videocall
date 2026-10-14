import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

export type PageSkeletonVariant =
  | 'generic'
  | 'discover'
  | 'wallet'
  | 'dashboard'
  | 'list'
  | 'profile'
  | 'admin'
  | 'history'
  | 'purchase';

interface PageSkeletonProps {
  variant?: PageSkeletonVariant;
  className?: string;
}

function Shimmer({ className }: { className?: string }) {
  return <Skeleton className={cn('skeleton-shimmer', className)} />;
}

export function PageSkeleton({ variant = 'generic', className }: PageSkeletonProps) {
  switch (variant) {
    case 'discover':
      return (
        <div className={cn('premium-glow-bg min-h-full space-y-6 p-4', className)}>
          <div className="flex items-center justify-between">
            <Shimmer className="h-7 w-28" />
            <div className="flex gap-2">
              <Shimmer className="h-9 w-16 rounded-full" />
              <Shimmer className="h-9 w-9 rounded-full" />
            </div>
          </div>
          <Shimmer className="h-24 w-full rounded-[24px]" />
          <div className="grid grid-cols-3 gap-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <Shimmer key={i} className="h-16 rounded-2xl" />
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Shimmer key={i} className="aspect-[3/4] rounded-[24px]" />
            ))}
          </div>
        </div>
      );

    case 'wallet':
      return (
        <div className={cn('space-y-4 p-4', className)}>
          <Shimmer className="h-40 w-full rounded-[24px]" />
          <Shimmer className="h-24 w-full rounded-2xl" />
          <div className="grid grid-cols-2 gap-3">
            <Shimmer className="h-11 rounded-xl" />
            <Shimmer className="h-11 rounded-xl" />
          </div>
          <Shimmer className="h-11 w-full rounded-xl" />
        </div>
      );

    case 'dashboard':
      return (
        <div className={cn('premium-glow-bg space-y-4 p-4 pb-8', className)}>
          <Shimmer className="h-7 w-40" />
          <Shimmer className="h-36 w-full rounded-[24px]" />
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Shimmer key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
          <Shimmer className="h-32 w-full rounded-2xl" />
          <Shimmer className="h-28 w-full rounded-2xl" />
        </div>
      );

    case 'profile':
      return (
        <div className={cn('min-h-full bg-[#0F0F12]', className)}>
          <Shimmer className="aspect-[4/5] max-h-[420px] w-full rounded-none" />
          <div className="relative z-10 -mt-16 space-y-4 px-4">
            <Shimmer className="h-48 w-full rounded-[24px]" />
            <Shimmer className="h-36 w-full rounded-[24px]" />
            <Shimmer className="h-28 w-full rounded-[24px]" />
          </div>
        </div>
      );

    case 'list':
      return (
        <div className={cn('premium-glow-bg space-y-4 p-4 pb-8', className)}>
          <div className="flex items-center gap-3">
            <Shimmer className="h-11 w-11 rounded-2xl" />
            <div className="space-y-2">
              <Shimmer className="h-6 w-32" />
              <Shimmer className="h-4 w-24" />
            </div>
          </div>
          <Shimmer className="h-11 w-full rounded-xl" />
          {Array.from({ length: 5 }).map((_, i) => (
            <Shimmer key={i} className="h-20 w-full rounded-2xl" />
          ))}
        </div>
      );

    case 'history':
      return (
        <div className={cn('premium-glow-bg min-h-full pb-8', className)}>
          <div className="border-b border-white/8 px-4 py-5">
            <Shimmer className="h-7 w-36" />
            <Shimmer className="mt-2 h-4 w-28" />
          </div>
          <div className="space-y-3 px-4 pt-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <Shimmer key={i} className="h-[72px] w-full rounded-2xl" />
            ))}
          </div>
        </div>
      );

    case 'purchase':
      return (
        <div className={cn('space-y-4 p-4', className)}>
          <Shimmer className="h-7 w-32" />
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <Shimmer key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
          <Shimmer className="h-24 w-full rounded-2xl" />
          <Shimmer className="h-12 w-full rounded-xl" />
        </div>
      );

    case 'admin':
      return (
        <div className={cn('space-y-6', className)}>
          <Shimmer className="h-8 w-48" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Shimmer key={i} className="h-28 rounded-2xl" />
            ))}
          </div>
          <Shimmer className="h-8 w-40" />
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Shimmer key={i} className="h-24 rounded-2xl" />
            ))}
          </div>
        </div>
      );

    default:
      return (
        <div className={cn('flex min-h-[50vh] flex-col gap-4 p-4', className)}>
          <Shimmer className="h-8 w-40" />
          <Shimmer className="h-32 w-full rounded-2xl" />
          <Shimmer className="h-24 w-full rounded-2xl" />
          <Shimmer className="h-24 w-full rounded-2xl" />
        </div>
      );
  }
}