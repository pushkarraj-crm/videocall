'use client';

import { Video } from 'lucide-react';
import { QuickCallPage } from '@/components/calls/quick-call-page';

export default function VideoCallPage() {
  return (
    <QuickCallPage
      title="Video Call"
      description="Get matched with an online host for a live video conversation"
      ctaLabel="Start video call"
      icon={Video}
    />
  );
}