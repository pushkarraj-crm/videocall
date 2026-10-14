'use client';

import { Suspense } from 'react';
import { AuthLayout } from '@/components/auth/auth-layout';
import { LoginForm } from '@/components/auth/login-form';
import { PageLoader } from '@/components/shared/page-loader';

function LoginContent() {
  return (
    <AuthLayout>
      <LoginForm intent="user" />
    </AuthLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<PageLoader label="Loading..." />}>
      <LoginContent />
    </Suspense>
  );
}