'use client';

import Link from 'next/link';
import { Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CallEndedScreenProps {
  homeHref: string;
  discoverHref?: string;
  onStartNewCall?: () => void;
  title?: string;
  message?: string;
}

export function CallEndedScreen({
  homeHref,
  discoverHref = '/home',
  onStartNewCall,
  title = 'Call Ended',
  message = 'This session has finished.',
}: CallEndedScreenProps) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-[#0F0F12] px-6 text-center">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-white/5">
        <Phone className="h-7 w-7 text-[#A7A7B3]" aria-hidden />
      </div>
      <h1 className="text-2xl font-semibold text-white">{title}</h1>
      <p className="mt-2 max-w-sm text-sm text-[#A7A7B3]">{message}</p>
      <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
        <Button asChild className="w-full">
          <Link href={homeHref}>Return Home</Link>
        </Button>
        <Button asChild variant="secondary" className="w-full">
          <Link href={discoverHref}>Discover Hosts</Link>
        </Button>
        {onStartNewCall ? (
          <Button type="button" variant="outline" className="w-full" onClick={onStartNewCall}>
            Start New Call
          </Button>
        ) : (
          <Button asChild variant="outline" className="w-full">
            <Link href="/video-call">Start New Call</Link>
          </Button>
        )}
      </div>
    </div>
  );
}