'use client';

import { LandingCta } from '@/components/landing/landing-cta';
import { LandingFeatures } from '@/components/landing/landing-features';
import { LandingFooter } from '@/components/landing/landing-footer';
import { LandingGifts } from '@/components/landing/landing-gifts';
import { LandingHero } from '@/components/landing/landing-hero';
import { LandingHostShowcase } from '@/components/landing/landing-host-showcase';
import { LandingNav } from '@/components/landing/landing-nav';
import { LandingStats } from '@/components/landing/landing-stats';
import { LandingTestimonials } from '@/components/landing/landing-testimonials';

export function LandingPage() {
  return (
    <div className="landing-page min-h-screen">
      <LandingNav />
      <main>
        <LandingHero />
        <LandingHostShowcase />
        <LandingFeatures />
        <LandingStats />
        <LandingGifts />
        <LandingTestimonials />
        <LandingCta />
      </main>
      <LandingFooter />
    </div>
  );
}