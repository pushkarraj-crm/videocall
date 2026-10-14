import type { AuthSession, Role } from '@/types/api';
import type { AuthIntent } from './constants';

const ADMIN_ROLES: Role[] = [
  'admin',
  'super_admin',
  'moderator',
  'grievance_officer',
  'support',
];

export function hasAdminRole(roles: Role[] = []): boolean {
  return roles.some((r) => ADMIN_ROLES.includes(r));
}

export function hasHostRole(roles: Role[] = []): boolean {
  return roles.includes('host');
}

export function getPostAuthPath(session: AuthSession, intent: AuthIntent = 'user'): string {
  const roles = session.user.roles ?? [];

  if (intent === 'host') {
    if (session.user.needsOnboarding) {
      return '/host/register';
    }
    if (hasHostRole(roles)) {
      return '/host/dashboard';
    }
    return '/host/register';
  }

  if (intent === 'admin') {
    if (hasAdminRole(roles)) {
      return '/admin';
    }
    // Non-admin must not be sent into the user app from the admin login form.
    // Caller (useAuth.navigateAfterAuth) rejects this case before navigating.
    return '/admin/login';
  }

  if (session.user.needsOnboarding) {
    return '/onboarding';
  }

  if (hasAdminRole(roles)) {
    return '/admin';
  }

  if (hasHostRole(roles)) {
    return '/host/dashboard';
  }

  return '/home';
}