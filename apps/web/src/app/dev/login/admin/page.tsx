import { notFound } from 'next/navigation';
import { DevLoginRunner } from '@/components/auth/dev-login-runner';
import { isDevLoginRoutesEnabled } from '@/lib/auth/dev-login';

/** Local only: http://localhost:3000/dev/login/admin — not linked from public UI. */
export default function DevLoginAdminPage() {
  if (!isDevLoginRoutesEnabled()) {
    notFound();
  }
  return <DevLoginRunner role="admin" />;
}
