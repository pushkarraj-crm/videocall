'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ApiClientError } from '@/lib/api/client';
import { devLog } from '@/lib/dev-log';
import { Button } from '@/components/ui/button';

export default function CallPageError({
  error,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const router = useRouter();

  useEffect(() => {
    const details =
      error instanceof ApiClientError
        ? {
            endpoint: error.message,
            statusCode: error.statusCode,
            code: error.code,
            requestId: error.requestId,
            message: error.message,
          }
        : { message: error.message, name: error.name };
    console.warn('CALL_PAGE_RUNTIME_ERROR', details);
    devLog('CALL_PAGE_RUNTIME_ERROR', details);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-[#0F0F12] px-6">
      <p className="text-center text-sm text-[#A7A7B3]">
        A background request failed. Your call may still be active.
      </p>
      <Button variant="outline" onClick={() => router.push('/home')}>
        Go home
      </Button>
    </div>
  );
}