'use client';

import { useCallback } from 'react';
import Link from 'next/link';
import { ArrowRight, Compass, Video } from 'lucide-react';
import { DiscoverHostCard } from '@/components/hosts/discover-host-card';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/shared/empty-state';
import { Button } from '@/components/ui/button';
import { useHosts } from '@/hooks/use-hosts';
import { useCallFlow } from '@/hooks/use-call-flow';

export default function HomePage() {
  const { online, loading, error, refresh } = useHosts({ onlineOnly: true });
  const { startCall } = useCallFlow();

  const scrollToLive = useCallback(() => {
    const el = document.getElementById('live-now');
    el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, []);

  return (
    <div className="premium-glow-bg min-h-full">
      <div className="relative z-10 mx-auto w-full px-4 pb-10 pt-8 sm:px-6 sm:pb-12 sm:pt-10 lg:px-10 lg:pb-16 lg:pt-12 xl:px-12">
        {/* ── Hero ── */}
        <section className="mx-auto max-w-3xl text-center">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl lg:text-6xl">
            Meet Someone{' '}
            <span className="gradient-text">New</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[#A7A7B3] sm:mt-4 sm:text-base md:text-lg">
            Connect instantly with people who are online right now.
          </p>
        </section>

        {/* ── Video Call (above Discover) ── */}
        <section className="mx-auto mt-8 max-w-xl sm:mt-10 lg:mt-12">
          <Link
            href="/video-call"
            className="group block overflow-hidden rounded-2xl border border-white/10 bg-[#17171C]/90 shadow-[0_12px_40px_rgba(0,0,0,0.35)] ring-1 ring-white/5 transition-all duration-300 hover:border-[#FF2E74]/35 hover:shadow-[0_16px_48px_rgba(255,46,116,0.18)] sm:rounded-3xl"
          >
            <div className="relative flex flex-col items-center gap-4 px-6 py-8 text-center sm:px-10 sm:py-10">
              <div className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#FF2E74]/12 via-transparent to-[#FFB347]/8 opacity-80" />
              <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl gradient-primary shadow-[0_8px_28px_rgba(255,46,116,0.4)] transition-transform duration-300 group-hover:scale-105 sm:h-16 sm:w-16">
                <Video className="h-7 w-7 text-white sm:h-8 sm:w-8" />
              </div>
              <div className="relative space-y-1.5">
                <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[#FF2E74]">
                  Video Call
                </p>
                <h2 className="text-xl font-bold text-white sm:text-2xl">
                  Start a Video Call
                </h2>
                <p className="text-sm text-[#A7A7B3]">
                  Live video conversations with online hosts
                </p>
              </div>
              <span className="relative inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-5 py-2.5 text-sm font-semibold text-white transition-colors group-hover:bg-white/10">
                Go to Video Call
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </Link>
        </section>

        {/* ── Discover CTA ── */}
        <section className="mt-8 flex justify-center sm:mt-10">
          <Button
            size="lg"
            onClick={scrollToLive}
            className="h-12 min-w-[200px] rounded-full gradient-primary border-0 px-10 text-base font-semibold shadow-[0_8px_32px_rgba(255,46,116,0.35)] transition-all hover:shadow-[0_12px_40px_rgba(255,46,116,0.45)] sm:h-14 sm:min-w-[220px] sm:text-lg"
          >
            Discover
            <ArrowRight className="ml-2 h-5 w-5" />
          </Button>
        </section>

        {/* ── Live Now — real online hosts ── */}
        <section id="live-now" className="mt-12 scroll-mt-24 sm:mt-14 lg:mt-16">
          <div className="mb-6 flex flex-col items-start justify-between gap-2 sm:mb-8 sm:flex-row sm:items-end">
            <div>
              <div className="mb-1.5 flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                </span>
                <h2 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
                  Live Now
                </h2>
              </div>
              <p className="text-sm text-[#A7A7B3]">People ready to connect</p>
            </div>
            {!loading && online.length > 0 && (
              <span className="text-xs font-medium text-[#A7A7B3] sm:text-sm">
                {online.length} online
              </span>
            )}
          </div>

          {loading ? (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {Array.from({ length: 8 }).map((_, i) => (
                <Skeleton
                  key={i}
                  className="aspect-[3/4] rounded-2xl bg-[#17171C] sm:rounded-[24px]"
                />
              ))}
            </div>
          ) : error ? (
            <div className="premium-card">
              <EmptyState
                icon={Compass}
                title="Couldn’t load hosts"
                description={error}
                action={
                  <Button variant="outline" onClick={() => refresh()}>
                    Try again
                  </Button>
                }
              />
            </div>
          ) : online.length === 0 ? (
            <div className="premium-card">
              <EmptyState
                icon={Compass}
                title="No one is live right now"
                description="Check back soon — hosts appear here when they’re online and ready to connect."
                action={
                  <Button variant="outline" onClick={() => refresh()}>
                    Refresh
                  </Button>
                }
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {online.map((host) => (
                <DiscoverHostCard
                  key={host.userId}
                  host={host}
                  onCall={startCall}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
