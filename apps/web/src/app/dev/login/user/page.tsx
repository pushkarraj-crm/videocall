import { notFound } from 'next/navigation';
import { DevLoginRunner } from '@/components/auth/dev-login-runner';
import { isDevLoginRoutesEnabled } from '@/lib/auth/dev-login';

/** Local only: http://localhost:3000/dev/login/user — not linked from public UI. */
export default function DevLoginUserPage() {
  if (!isDevLoginRoutesEnabled()) {
    notFound();
  }
  return <DevLoginRunner role="user" />;
}
