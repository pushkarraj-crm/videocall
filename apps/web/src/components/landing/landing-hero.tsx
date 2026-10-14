'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BRAND_TAGLINE } from '@/lib/app-brand';

/** Local hero asset — woman on a live video call with floating profiles. */
const HERO_IMAGE_SRC = '/hero-image.png';

export function LandingHero() {
  return (
    <section className="relative min-h-screen overflow-hidden pt-32 pb-16 sm:pt-36 lg:pt-40">
      <div className="pointer-events-none absolute inset-0">
        <div className="landing-glow-orb absolute -left-32 top-20 h-72 w-72 rounded-full bg-fuchsia-600/30 blur-[100px]" />
        <div className="landing-glow-orb absolute -right-32 top-40 h-80 w-80 rounded-full bg-violet-600/25 blur-[120px] [animation-delay:1.5s]" />
        <div className="absolute bottom-0 left-1/2 h-64 w-[600px] -translate-x-1/2 rounded-full bg-pink-600/10 blur-[80px]" />
      </div>

      <div className="relative mx-auto grid max-w-6xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-2 lg:gap-12 xl:gap-16">
        {/* LEFT — copy + CTAs (first on mobile) */}
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.7 }}
          className="relative z-10 order-1 text-center lg:text-left"
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-1.5 text-sm text-white/80 backdrop-blur-sm"
          >
            <Sparkles className="h-4 w-4 text-[#ff4d8d]" />
            {BRAND_TAGLINE}
          </motion.div>

          <h1 className="text-4xl font-bold leading-[1.08] tracking-tight text-white sm:text-5xl lg:text-6xl xl:text-7xl">
            One Call Away From{' '}
            <span className="gradient-text">Someone New</span>
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-white/60 sm:text-lg lg:mx-0">
            Meet interesting people, start instant video calls and make real connections from
            anywhere.
          </p>

          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row lg:justify-start">
            <Button
              size="lg"
              className="h-12 w-full min-w-[180px] gradient-primary border-0 px-8 text-base shadow-xl shadow-[#ff4d8d]/25 transition-shadow duration-300 hover:shadow-[#ff4d8d]/40 sm:w-auto"
              asChild
            >
              <Link href="/login">
                Start Calling
                <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="h-12 w-full border-white/15 bg-white/5 text-white backdrop-blur-sm transition-colors duration-300 hover:border-white/25 hover:bg-white/10 sm:w-auto"
              asChild
            >
              <Link href="/login?redirect=/home">Explore Hosts</Link>
            </Button>
          </div>

          <p className="mt-5 text-xs text-white/40">5 free calls · From 5 coins/min</p>
        </motion.div>

        {/* RIGHT — local hero image (second on mobile) */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.8, delay: 0.15 }}
          className="relative order-2 mx-auto w-full max-w-lg lg:max-w-none"
        >
          {/* Soft glow frame so the image sits in the dark/pink design */}
          <div
            className="pointer-events-none absolute -inset-3 rounded-[2rem] bg-gradient-to-br from-[#ff4d8d]/25 via-violet-500/15 to-transparent blur-2xl sm:-inset-4"
            aria-hidden
          />
          <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/20 shadow-2xl shadow-black/50 ring-1 ring-white/5 sm:rounded-3xl">
            <Image
              src={HERO_IMAGE_SRC}
              alt="Live video call — connect with someone new"
              width={1536}
              height={1024}
              priority
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 560px"
              className="h-auto w-full object-contain"
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}
