'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { setAgeConfirmed } from '@/lib/legal/age-gate';
import { appTitleOr } from '@/lib/app-brand';

export function AgeGate({ onConfirmed }: { onConfirmed: () => void }) {
  const [checked, setChecked] = useState(false);
  const brand = appTitleOr();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0F0F12]/95 p-4 backdrop-blur-md">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-[#17171C] p-6 shadow-2xl">
        <div className="mb-4 flex items-center gap-3">
          <div className="rounded-xl bg-[#FF2E74]/15 p-3 text-[#FF6B9D]">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white">Age Verification</h2>
            <p className="text-sm text-white/55">{brand} is for adults only</p>
          </div>
        </div>

        <p className="text-sm leading-relaxed text-white/70">
          You must be at least 18 years old to use {brand}. By continuing, you confirm that you meet
          this requirement and agree to our{' '}
          <Link href="/age-policy" className="text-[#FF6B9D] hover:underline">
            Age Policy
          </Link>
          .
        </p>

        <label className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-white/8 bg-white/[0.03] p-4 text-sm text-white/90">
          <span>I confirm that I am at least 18 years old.</span>
          <Switch checked={checked} onCheckedChange={setChecked} />
        </label>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button
            className="flex-1"
            variant="gradient"
            size="lg"
            disabled={!checked}
            onClick={() => {
              setAgeConfirmed();
              onConfirmed();
            }}
          >
            Enter {brand}
          </Button>
          <Button className="flex-1" variant="outline" size="lg" asChild>
            <Link href="/age-policy">I am under 18</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}