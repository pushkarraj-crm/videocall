'use client';

import { BrandLogo } from '@/components/brand/brand-logo';
import { GradientBg } from '@/components/shared/gradient-bg';
import { LegalFooterLinks } from '@/components/legal/legal-footer-links';
import { BRAND_TAGLINE } from '@/lib/app-brand';
import { cn } from '@/lib/utils';

export function AuthLayout({
  children,
  title,
  subtitle,
  className,
}: {
  children: React.ReactNode;
  title?: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className="relative flex min-h-dvh flex-col items-center justify-center p-4 sm:p-6">
      <GradientBg />
      <div
        className={cn(
          'relative z-10 w-full max-w-md animate-in fade-in slide-in-from-bottom-4 duration-500',
          className,
        )}
      >
        <div className="mb-8 text-center">
          <BrandLogo size="lg" className="mx-auto justify-center" />
          <p className="mt-2.5 text-sm tracking-wide text-white/55 sm:text-base">{BRAND_TAGLINE}</p>
          {title ? (
            <>
              <h1 className="mt-5 text-xl font-semibold tracking-tight text-white sm:text-2xl">
                {title}
              </h1>
              {subtitle ? (
                <p className="mt-1.5 text-sm text-white/50">{subtitle}</p>
              ) : null}
            </>
          ) : null}
        </div>
        <div className="rounded-3xl border border-white/8 bg-[#12121A]/80 p-6 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-8">
          {children}
        </div>
        <footer className="mt-6 space-y-2 text-center">
          <LegalFooterLinks className="text-xs text-white/40" />
          <p className="text-xs text-white/35">18+ only</p>
        </footer>
      </div>
    </div>
  );
}