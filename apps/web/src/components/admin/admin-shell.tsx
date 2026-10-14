'use client';

import { usePathname } from 'next/navigation';
import { AdminGuard } from '@/components/auth/admin-guard';
import { AdminSidebar } from '@/components/admin/admin-sidebar';

/**
 * Admin chrome: sidebar + guard for protected admin routes only.
 * /admin/login is rendered bare so logged-out admins see the login form (not a blank guard).
 */
export function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/admin/login' || pathname.startsWith('/admin/login/');

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <AdminGuard>
      <div className="flex min-h-dvh bg-[#0F0F12]">
        <AdminSidebar />
        <main className="flex-1 overflow-auto p-6 md:p-8">
          <div className="mx-auto max-w-7xl animate-fade-in">{children}</div>
        </main>
      </div>
    </AdminGuard>
  );
}
