'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { PageLoader } from '@/components/shared/page-loader';

export default function AdminKycPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/admin/hosts');
  }, [router]);

  return <PageLoader label="Redirecting..." />;
}