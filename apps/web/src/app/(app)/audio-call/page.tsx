'use client';

import { Phone } from 'lucide-react';
import { QuickCallPage } from '@/components/calls/quick-call-page';

export default function AudioCallPage() {
  return (
    <QuickCallPage
      title="Audio Call"
      description="Get matched with an online host for a voice conversation"
      ctaLabel="Start audio call"
      icon={Phone}
    />
  );
}