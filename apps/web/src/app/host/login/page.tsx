'use client';

import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft, Radio } from 'lucide-react';
import { AuthLayout } from '@/components/auth/auth-layout';
import { LoginForm } from '@/components/auth/login-form';
import { PageLoader } from '@/components/shared/page-loader';
import { Button } from '@/components/ui/button';

function HostLoginContent() {
  return (
    <AuthLayout
      title="Host Login"
      subtitle="Sign in to manage calls and earnings"
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
          Back to user login
        </Link>
      </Button>

      <div className="mb-5 flex items-center justify-center gap-2 rounded-xl bg-[#FF2E74]/10 py-3 text-sm text-[#FF6B9D]">
        <Radio className="h-4 w-4" />
        Host dashboard access
      </div>

      <LoginForm
        intent="host"
        showBecomeHost={false}
        tagline="Welcome back"
        subtitle="Receive live calls and track your earnings"
      />

      <p className="mt-4 text-center text-sm text-white/45">
        New host?{' '}
        <Link href="/become-host" className="text-[#FF6B9D] hover:underline">
          Apply to become a host
        </Link>
      </p>
    </AuthLayout>
  );
}

export default function HostLoginPage() {
  return (
    <Suspense fallback={<PageLoader label="Loading..." />}>
      <HostLoginContent />
    </Suspense>
  );
}