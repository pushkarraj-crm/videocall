import Image from 'next/image';
import Link from 'next/link';
import { BRAND_NAME } from '@/lib/app-brand';
import { cn } from '@/lib/utils';

/** Official Lovenexa logo, including its wordmark. */
export const BRAND_LOGO_SRC = '/lovenexa-logo.png';

/**
 * Size scale — desktop headers use md/lg at ~52–64px height for premium presence.
 * Aspect ratio is preserved via object-contain + fixed height.
 */
const sizeClasses = {
  /** Compact (admin sidebar, dense UI) */
  sm: 'h-10 w-auto max-w-[160px] sm:h-11 sm:max-w-[180px]',
  /**
   * Default app header
   * Mobile ~40–44px · Desktop ~56–64px
   */
  md: 'h-11 w-auto max-w-[180px] sm:h-12 sm:max-w-[220px] md:h-14 md:max-w-[260px] lg:h-16 lg:max-w-[300px]',
  /**
   * Marketing / public home header
   * Desktop ~56–64px+
   */
  lg: 'h-12 w-auto max-w-[200px] sm:h-14 sm:max-w-[260px] md:h-16 md:max-w-[300px] lg:h-[68px] lg:max-w-[340px]',
} as const;

type BrandLogoProps = {
  href?: string;
  size?: keyof typeof sizeClasses;
  /** @deprecated Kept for call-site compatibility; official logo replaces star + text. */
  showStar?: boolean;
  className?: string;
  asLink?: boolean;
  /** Show brand name text beside the mark (off by default — logo already includes Lovenexa). */
  showWordmark?: boolean;
};

export function BrandLogo({
  href = '/',
  size = 'md',
  className,
  asLink = true,
  showWordmark = false,
}: BrandLogoProps) {
  const content = (
    <span
      className={cn(
        'brand-logo inline-flex items-center gap-2.5 font-bold',
        className,
      )}
    >
      <Image
        src={BRAND_LOGO_SRC}
        alt={BRAND_NAME}
        width={1774}
        height={887}
        sizes="(max-width: 640px) 200px, 340px"
        priority
        className={cn(
          'shrink-0 object-contain',
          sizeClasses[size],
        )}
      />
      {showWordmark ? (
        <span className="brand-logo-text hidden text-lg tracking-tight sm:inline">{BRAND_NAME}</span>
      ) : null}
    </span>
  );

  if (!asLink) return content;

  return (
    <Link
      href={href}
      className="inline-flex min-w-0 transition-opacity duration-200 hover:opacity-90"
      aria-label={`${BRAND_NAME} home`}
    >
      {content}
    </Link>
  );
}
