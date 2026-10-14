'use client';

import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import { AuthGuard } from '@/components/auth/auth-guard';
import { PwaRegister } from '@/components/shared/pwa-register';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
      <AuthGuard>{children}</AuthGuard>
      <PwaRegister />
      <Toaster richColors position="top-center" />
    </ThemeProvider>
  );
}