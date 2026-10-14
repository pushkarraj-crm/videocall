'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageLoader } from '@/components/shared/page-loader';

export default function HostApplyPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/become-host');
  }, [router]);

  return <PageLoader label="Redirecting..." />;
}