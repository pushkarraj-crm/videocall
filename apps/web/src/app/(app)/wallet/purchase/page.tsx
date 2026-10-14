'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Clock, Gift, Sparkles, Tag, X } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { formatInr, cn } from '@/lib/utils';
import { paymentsApi } from '@/lib/api/payments';
import { promotionsApi, type AvailableCoupon, type PromoPreview } from '@/lib/api/promotions';
import { openRazorpayCheckout } from '@/lib/razorpay/checkout';
import { useWalletStore } from '@/stores/wallet-store';
import { PageLoader } from '@/components/shared/page-loader';
import { CoinPackageCard, type CoinPackageCardData } from '@/components/wallet/coin-package-card';

type PackageItem = CoinPackageCardData;

type AppliedCoupon = {
  code: string;
  expiresAt: string;
};

function Countdown({ expiresAt }: { expiresAt: string }) {
  const [left, setLeft] = useState('');
  useEffect(() => {
    const tick = () => {
      const ms = new Date(expiresAt).getTime() - Date.now();
      if (ms <= 0) {
        setLeft('Expired');
        return;
      }
      const m = Math.floor(ms / 60000);
      const s = Math.floor((ms % 60000) / 1000);
      setLeft(`${m}m ${s}s`);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return <span className="font-mono text-xs text-amber-400">{left}</span>;
}

function packagePreview(pkg: PackageItem): PromoPreview {
  const price = Number(pkg.priceInr);
  return {
    originalInr: price,
    finalInr: price,
    discountInr: 0,
    bonusCoins: 0,
    cashbackCoins: 0,
    totalCoins: pkg.totalCoins,
    savingsInr: 0,
  };
}

export default function CoinPurchasePage() {
  const fetchWallet = useWalletStore((s) => s.fetchWallet);
  const [packages, setPackages] = useState<PackageItem[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [coupons, setCoupons] = useState<AvailableCoupon[]>([]);
  const [recommended, setRecommended] = useState<AvailableCoupon | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [activePreview, setActivePreview] = useState<PromoPreview | null>(null);
  const [banners, setBanners] = useState<
    Array<{ id: string; name: string; banner: string | null; endDate: string }>
  >([]);
  const [couponInput, setCouponInput] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const appliedCouponRef = useRef<AppliedCoupon | null>(null);

  useEffect(() => {
    appliedCouponRef.current = appliedCoupon;
  }, [appliedCoupon]);

  const selected = packages.find((p) => p.id === selectedId) ?? packages[0] ?? null;

  const refreshCouponPreview = useCallback(
    async (packageId: string, code: string, silent = true) => {
      setPreviewLoading(true);
      try {
        const res = await promotionsApi.apply(code, packageId);
        setAppliedCoupon({ code: res.preview.code, expiresAt: res.preview.expiresAt });
        setActivePreview(res.preview);
        return res.preview;
      } catch (e) {
        if (!silent) {
          toast.error(e instanceof Error ? e.message : 'Invalid coupon');
        }
        throw e;
      } finally {
        setPreviewLoading(false);
      }
    },
    [],
  );

  const loadAvailableCoupons = useCallback(
    async (packageId: string) => {
      try {
        const res = await promotionsApi.available(packageId);
        setCoupons(res.coupons);
        setRecommended(res.recommended);
        setBanners(res.banners);

        const sessionCoupon = appliedCouponRef.current;
        if (sessionCoupon) {
          await refreshCouponPreview(packageId, sessionCoupon.code);
          return;
        }

        if (res.activePromo?.code) {
          const code = res.activePromo.code;
          setAppliedCoupon({
            code,
            expiresAt: res.activePreview
              ? (res.activePreview as PromoPreview & { expiresAt?: string }).expiresAt ??
                new Date(Date.now() + 30 * 60 * 1000).toISOString()
              : new Date(Date.now() + 30 * 60 * 1000).toISOString(),
          });
          await refreshCouponPreview(packageId, code);
          return;
        }

        const pkg = packages.find((p) => p.id === packageId);
        setActivePreview(pkg ? packagePreview(pkg) : null);
      } catch {
        setCoupons([]);
        const pkg = packages.find((p) => p.id === packageId);
        if (pkg && !appliedCouponRef.current) {
          setActivePreview(packagePreview(pkg));
        }
      }
    },
    [packages, refreshCouponPreview],
  );

  useEffect(() => {
    const preselectId =
      typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search).get('package')
        : null;

    paymentsApi
      .getPackages()
      .then((pkgs) => {
        const list = pkgs as PackageItem[];
        setPackages(list);
        const preferred =
          (preselectId && list.find((p) => p.id === preselectId)?.id) || list[0]?.id || null;
        if (preferred) setSelectedId(preferred);
      })
      .catch(() => toast.error('Failed to load packages'))
      .finally(() => setFetching(false));
  }, []);

  useEffect(() => {
    if (!selectedId || packages.length === 0) return;
    void loadAvailableCoupons(selectedId);
  }, [selectedId, packages.length, loadAvailableCoupons]);

  const applyCoupon = async (code: string) => {
    if (!selected) return;
    try {
      await refreshCouponPreview(selected.id, code, false);
      setCouponInput('');
      toast.success('Coupon applied!');
    } catch {
      /* toast shown in refreshCouponPreview */
    }
  };

  const removeCoupon = async () => {
    try {
      await promotionsApi.remove();
      setAppliedCoupon(null);
      setActivePreview(selected ? packagePreview(selected) : null);
      toast.success('Coupon removed');
      if (selectedId) void loadAvailableCoupons(selectedId);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Could not remove coupon');
    }
  };

  const purchase = async (pkg: PackageItem) => {
    setSelectedId(pkg.id);
    setLoading(pkg.id);
    try {
      if (appliedCoupon) {
        await refreshCouponPreview(pkg.id, appliedCoupon.code);
        const order = await promotionsApi.checkout(pkg.id);
        await openRazorpayCheckout({
          keyId: order.keyId,
          orderId: order.razorpayOrderId,
          amountInr: order.totalInr,
          name: 'Connect',
          description: `${pkg.totalCoins} coins`,
          onSuccess: async (paymentId, orderId, signature) => {
            await paymentsApi.confirm(orderId, paymentId, signature);
            await fetchWallet();
            setAppliedCoupon(null);
            setActivePreview(packagePreview(pkg));
            toast.success('Coins added!');
          },
        });
        return;
      }

      const order = await paymentsApi.createOrder(pkg.id);
      await openRazorpayCheckout({
        keyId: order.keyId,
        orderId: order.razorpayOrderId,
        amountInr: order.totalInr,
        name: 'Connect',
        description: `${pkg.totalCoins} coins`,
        onSuccess: async (paymentId, orderId, signature) => {
          await paymentsApi.confirm(orderId, paymentId, signature);
          await fetchWallet();
          toast.success('Coins added!');
        },
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Payment failed');
    } finally {
      setLoading(null);
    }
  };

  const selectedPreview =
    selectedId === selected?.id && activePreview
      ? activePreview
      : selected
        ? packagePreview(selected)
        : null;

  if (fetching) return <PageLoader variant="purchase" />;

  return (
    <div className="premium-glow-bg min-h-full">
      <div className="relative z-10 mx-auto w-full max-w-5xl space-y-6 px-4 py-6 pb-14 sm:space-y-8 sm:px-6 sm:py-8 lg:px-10 xl:px-12">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Buy <span className="gradient-text">Coins</span>
            </h1>
            <p className="mt-1.5 text-sm text-[#A7A7B3] sm:text-base">
              Choose a package that works for you and recharge your wallet.
            </p>
          </div>
          <Link
            href="/promotions/history"
            className="text-sm font-medium text-[#FF6B9D] hover:underline"
          >
            Promo history
          </Link>
        </div>

        {banners[0] && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="overflow-hidden rounded-2xl border border-[#FF2E74]/20 bg-gradient-to-r from-[#17171C]/95 to-[#2a1020]/90 p-4 sm:p-5"
          >
            <div className="flex items-center gap-3">
              <Sparkles className="h-5 w-5 shrink-0 text-[#FF6B9D]" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold text-white">{banners[0].name}</p>
                <p className="text-xs text-muted-foreground">
                  Ends {new Date(banners[0].endDate).toLocaleDateString()}
                </p>
              </div>
              <Countdown expiresAt={banners[0].endDate} />
            </div>
          </motion.div>
        )}

        {/* Compact coupon section */}
        <div className="rounded-2xl border border-white/10 bg-[#17171C]/90 p-4 sm:p-5">
          <div className="mb-3 flex items-center gap-2">
            <Tag className="h-4 w-4 text-[#FF6B9D]" />
            <span className="text-sm font-semibold text-white">Coupon Code</span>
          </div>
          {appliedCoupon ? (
            <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2.5 sm:px-4">
              <div>
                <p className="font-mono text-sm text-emerald-400">{appliedCoupon.code}</p>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  <Countdown expiresAt={appliedCoupon.expiresAt} />
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void removeCoupon()}
                aria-label="Remove coupon"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Input
                placeholder="ENTER COUPON"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                className="h-11 font-mono uppercase sm:h-12"
              />
              <Button
                className="h-11 shrink-0 border-0 px-6 gradient-primary sm:h-12"
                onClick={() => void applyCoupon(couponInput.trim())}
                disabled={!couponInput.trim() || !selected}
              >
                Apply
              </Button>
            </div>
          )}
          {recommended && !appliedCoupon && (
            <button
              type="button"
              className="mt-3 w-full rounded-xl border border-dashed border-[#FF2E74]/40 bg-[#FF2E74]/5 px-3 py-2.5 text-left text-sm transition hover:bg-[#FF2E74]/10"
              onClick={() => void applyCoupon(recommended.code)}
            >
              <span className="text-[#FF6B9D]">Recommended:</span> {recommended.code} — save up to{' '}
              {formatInr(recommended.preview.savingsInr)}
            </button>
          )}
        </div>

        {selectedPreview && appliedCoupon && selectedPreview.discountInr > 0 && (
          <motion.div
            initial={{ scale: 0.98, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 sm:p-5"
          >
            <p className="text-sm font-medium text-emerald-400">Payment summary</p>
            <div className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between text-white/70">
                <span>Original price</span>
                <span className="line-through">{formatInr(selectedPreview.originalInr)}</span>
              </div>
              <div className="flex justify-between text-emerald-400">
                <span>Coupon discount</span>
                <span>−{formatInr(selectedPreview.discountInr)}</span>
              </div>
              <div className="flex justify-between border-t border-white/10 pt-2 text-base font-semibold text-white">
                <span>You pay</span>
                <span>{formatInr(selectedPreview.finalInr)}</span>
              </div>
            </div>
            {(selectedPreview.bonusCoins > 0 || selectedPreview.cashbackCoins > 0) && (
              <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                {selectedPreview.bonusCoins > 0 && (
                  <span className="flex items-center gap-1">
                    <Gift className="h-3.5 w-3.5" />+{selectedPreview.bonusCoins} bonus coins
                  </span>
                )}
                {selectedPreview.cashbackCoins > 0 && (
                  <span>+{selectedPreview.cashbackCoins} cashback coins</span>
                )}
              </div>
            )}
          </motion.div>
        )}

        {coupons.length > 0 && !appliedCoupon && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">Available coupons</p>
            <div className="flex gap-2 overflow-x-auto pb-1">
              {coupons.slice(0, 6).map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => void applyCoupon(c.code)}
                  className={cn(
                    'min-w-[140px] shrink-0 rounded-xl border border-white/8 bg-[#17171C]/90 p-3 text-left transition hover:border-[#FF2E74]/40',
                    c.isBestValue && 'ring-1 ring-[#FF6B9D]/50',
                  )}
                >
                  <p className="font-mono text-xs text-[#FF6B9D]">{c.code}</p>
                  <p className="mt-1 text-xs text-white">{c.title}</p>
                  {c.isBestValue && (
                    <span className="mt-1 inline-block rounded-full bg-[#FF2E74]/20 px-1.5 py-0.5 text-[10px] text-[#FF6B9D]">
                      Best Value
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Recharge plans — responsive 2–3 column grid */}
        <section>
          <h2 className="mb-4 text-lg font-semibold text-white sm:mb-5 sm:text-xl">
            Recharge Plans
          </h2>
          {packages.length === 0 ? (
            <p className="py-12 text-center text-muted-foreground">No packages available</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3">
              {packages.map((pkg) => {
                const isSelected = selectedId === pkg.id;
                const cardPreview = isSelected && activePreview ? activePreview : null;
                const hasCouponDiscount =
                  isSelected &&
                  appliedCoupon &&
                  cardPreview &&
                  cardPreview.discountInr > 0;

                return (
                  <CoinPackageCard
                    key={pkg.id}
                    pkg={pkg}
                    selected={isSelected}
                    loading={loading === pkg.id}
                    previewLoading={previewLoading && isSelected}
                    couponApplied={Boolean(appliedCoupon && isSelected)}
                    finalInr={hasCouponDiscount ? cardPreview!.finalInr : null}
                    originalInr={hasCouponDiscount ? cardPreview!.originalInr : null}
                    onSelect={() => setSelectedId(pkg.id)}
                    onPurchase={() => void purchase(pkg)}
                  />
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
