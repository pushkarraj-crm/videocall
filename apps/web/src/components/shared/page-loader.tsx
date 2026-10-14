import { PageSkeleton, type PageSkeletonVariant } from '@/components/shared/page-skeleton';

export function PageLoader({
  variant = 'generic',
}: {
  label?: string;
  variant?: PageSkeletonVariant;
}) {
  return <PageSkeleton variant={variant} />;
}