'use client';

import { Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn, formatInr } from '@/lib/utils';

export type CoinPackageCardData = {
  id: string;
  name: string;
  priceInr: string | number;
  mrpInr: string | number;
  totalCoins: number;
  discountPercent: number;
  isBestValue: boolean;
  isMostPopular: boolean;
  isLimitedOffer?: boolean;
};

type CoinPackageCardProps = {
  pkg: CoinPackageCardData;
  selected?: boolean;
  loading?: boolean;
  previewLoading?: boolean;
  /** Optional coupon-adjusted final price display */
  finalInr?: number | null;
  originalInr?: number | null;
  couponApplied?: boolean;
  onSelect?: () => void;
  onPurchase: () => void;
  className?: string;
};

export function CoinPackageCard({
  pkg,
  selected = false,
  loading = false,
  previewLoading = false,
  finalInr,
  originalInr,
  couponApplied = false,
  onSelect,
  onPurchase,
  className,
}: CoinPackageCardProps) {
  const price = Number(pkg.priceInr);
  const mrp = Number(pkg.mrpInr);
  const showCouponPrice =
    couponApplied && finalInr != null && originalInr != null && finalInr < originalInr;
  const badge = pkg.isBestValue
    ? 'BEST VALUE'
    : pkg.isMostPopular
      ? 'MOST POPULAR'
      : pkg.isLimitedOffer
        ? 'LIMITED'
        : null;

  return (
    <article
      role={onSelect ? 'button' : undefined}
      tabIndex={onSelect ? 0 : undefined}
      onClick={onSelect}
      onKeyDown={
        onSelect
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect();
              }
            }
          : undefined
      }
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-[#17171C]/95 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.3)] transition-all duration-300',
        'hover:border-[#FF2E74]/35 hover:shadow-[0_12px_40px_rgba(255,46,116,0.12)]',
        selected && 'border-[#FF2E74]/45 ring-1 ring-[#FF2E74]/30',
        (pkg.isBestValue || pkg.isMostPopular) && !selected && 'border-[#FF2E74]/20',
        className,
      )}
    >
      {(pkg.isBestValue || pkg.isMostPopular) && (
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#FF2E74]/10 via-transparent to-[#FFB347]/5 opacity-80"
          aria-hidden
        />
      )}

      <div className="relative flex flex-1 flex-col">
        <div className="mb-3 flex min-h-[1.5rem] flex-wrap items-center gap-2">
          {badge && (
            <span className="inline-flex rounded-full gradient-primary px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-white shadow-sm">
              {badge}
            </span>
          )}
          {couponApplied && selected && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-medium text-emerald-400">
              <Check className="h-3 w-3" />
              Coupon
            </span>
          )}
        </div>

        <p className="text-sm font-medium text-[#A7A7B3]">{pkg.name}</p>
        <p className="mt-1 text-2xl font-bold tracking-tight text-white sm:text-[1.65rem]">
          {pkg.totalCoins}{' '}
          <span className="text-base font-semibold text-[#FF6B9D] sm:text-lg">coins</span>
        </p>

        <div className="mt-4 flex flex-wrap items-end gap-2">
          {showCouponPrice ? (
            <>
              <p className="text-xs text-white/40 line-through">{formatInr(originalInr!)}</p>
              <p className="text-2xl font-bold tabular-nums text-emerald-400">
                {formatInr(finalInr!)}
              </p>
            </>
          ) : (
            <p className="text-2xl font-bold tabular-nums text-white">{formatInr(price)}</p>
          )}
          {mrp > price && (
            <p className="pb-0.5 text-sm text-white/40 line-through">MRP {formatInr(mrp)}</p>
          )}
        </div>

        {pkg.discountPercent > 0 && (
          <p className="mt-1 text-sm font-semibold text-emerald-400">{pkg.discountPercent}% OFF</p>
        )}

        <div className="mt-auto pt-5">
          <Button
            className="h-11 w-full rounded-xl border-0 text-sm font-semibold gradient-primary shadow-[0_6px_20px_rgba(255,46,116,0.3)] sm:h-12 sm:text-base"
            disabled={loading || previewLoading}
            onClick={(e) => {
              e.stopPropagation();
              onPurchase();
            }}
          >
            {loading ? 'Opening…' : previewLoading ? 'Updating…' : 'Recharge Now'}
          </Button>
        </div>
      </div>
    </article>
  );
}
