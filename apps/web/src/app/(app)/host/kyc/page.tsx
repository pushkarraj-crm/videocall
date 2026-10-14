'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageLoader } from '@/components/shared/page-loader';

export default function HostKycPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/host/dashboard');
  }, [router]);

  return <PageLoader label="Redirecting..." />;
}