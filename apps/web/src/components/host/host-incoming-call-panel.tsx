'use client';

import { Phone, PhoneOff, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIncomingCallActions } from '@/hooks/use-incoming-call-actions';
import { useCallStore } from '@/stores/call-store';
import { cn } from '@/lib/utils';

/**
 * Live incoming-call surface for Host Dashboard.
 * Uses existing call store + accept/reject APIs — no navigation to /calls/incoming.
 */
export function HostIncomingCallPanel({ className }: { className?: string }) {
  const incoming = useCallStore((s) => s.incomingCall);
  const { accept, decline, loading } = useIncomingCallActions();

  return (
    <section
      className={cn(
        'overflow-hidden rounded-2xl border border-white/10 bg-[#17171C]/95 shadow-[0_8px_32px_rgba(0,0,0,0.3)]',
        incoming && 'border-[#FF2E74]/35 shadow-[0_12px_40px_rgba(255,46,116,0.2)]',
        className,
      )}
    >
      <div className="border-b border-white/6 px-5 py-3.5 sm:px-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-white">
          <Video className="h-4 w-4 text-[#FF2E74]" />
          Incoming Calls
          {incoming && (
            <span className="relative ml-1 flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#FF2E74] opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-[#FF2E74]" />
            </span>
          )}
        </div>
      </div>

      <div className="p-5 sm:p-6">
        {!incoming ? (
          <div className="flex flex-col items-center justify-center py-6 text-center sm:py-8">
            <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-white/5">
              <Phone className="h-5 w-5 text-[#A7A7B3]" />
            </div>
            <p className="font-medium text-white">No active calls</p>
            <p className="mt-1 max-w-xs text-sm text-[#A7A7B3]">
              You&apos;ll see incoming calls here when someone calls you.
            </p>
          </div>
        ) : (
          <div className="relative">
            <div
              className="pointer-events-none absolute -inset-1 rounded-2xl bg-gradient-to-br from-[#FF2E74]/20 via-transparent to-[#FFB347]/10 blur-xl"
              aria-hidden
            />
            <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <span className="absolute inset-0 animate-pulse-ring rounded-full bg-[#FF2E74]/35" />
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-full gradient-primary text-2xl font-bold text-white shadow-[0_8px_28px_rgba(255,46,116,0.45)]">
                    {incoming.callerName?.[0]?.toUpperCase() ?? '?'}
                  </div>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#FF6B9D]">
                    Incoming video call
                  </p>
                  <p className="mt-0.5 text-xl font-bold text-white">
                    {incoming.callerName || 'Someone'}
                  </p>
                  <p className="text-sm text-[#A7A7B3]">is calling you</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="outline"
                  className="h-12 min-w-[130px] cursor-pointer rounded-xl border-white/15 bg-white/5 font-semibold text-white hover:bg-red-500/15 hover:border-red-400/40 hover:text-red-300 disabled:cursor-not-allowed"
                  disabled={loading}
                  onClick={() => void decline(incoming.callId)}
                >
                  <PhoneOff className="h-4 w-4" />
                  Decline
                </Button>
                <Button
                  className="h-12 min-w-[130px] cursor-pointer rounded-xl border-0 font-semibold gradient-primary shadow-[0_6px_24px_rgba(255,46,116,0.4)] animate-match-pulse disabled:cursor-not-allowed"
                  disabled={loading}
                  loading={loading}
                  onClick={() => void accept(incoming)}
                >
                  <Phone className="h-4 w-4" />
                  Accept
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
