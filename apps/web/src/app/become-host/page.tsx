'use client';

import Link from 'next/link';
import { ArrowLeft, Check, Clock, Globe, Wallet } from 'lucide-react';
import { AuthLayout } from '@/components/auth/auth-layout';
import { LoginForm } from '@/components/auth/login-form';
import { Button } from '@/components/ui/button';

const BENEFITS = [
  { icon: Clock, text: 'Flexible Hours' },
  { icon: Wallet, text: 'Weekly Earnings' },
  { icon: Globe, text: 'Work From Anywhere' },
];

export default function BecomeHostPage() {
  return (
    <div className="relative min-h-dvh">
      <AuthLayout
        title="Become a Host"
        subtitle="Earn by receiving premium video calls"
        className="max-w-lg"
      >
        <Button
          variant="ghost"
          size="sm"
          className="-mt-2 mb-4 -ml-2 text-white/50 hover:text-white"
          asChild
        >
          <Link href="/login">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to login
          </Link>
        </Button>

        <ul className="mb-6 space-y-3">
          {BENEFITS.map(({ icon: Icon, text }) => (
            <li
              key={text}
              className="flex items-center gap-3 rounded-xl bg-white/5 px-4 py-3 text-sm text-white/80"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#FF2E74]/15">
                <Icon className="h-4 w-4 text-[#FF6B9D]" />
              </div>
              <Check className="h-4 w-4 text-emerald-400" />
              {text}
            </li>
          ))}
        </ul>

        <LoginForm
          intent="host"
          showBecomeHost={false}
          tagline="Start earning today"
          subtitle="Authenticate to begin host registration"
        />
      </AuthLayout>
    </div>
  );
}