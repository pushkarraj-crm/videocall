/**
 * Account home helpers derived from authenticated roles.
 * There is no client-side User/Host mode switch — role comes from the session/DB only.
 */
import { hasHostRole } from '@/lib/auth/redirect';
import type { Role } from '@/types/api';

/** Home path for the authenticated account (host → dashboard, otherwise user home). */
export function getHomeHref(isHost: boolean): string {
  return isHost ? '/host/dashboard' : '/home';
}

/** Resolve home from role list on the session/profile. */
export function getHomeHrefForRoles(roles: Role[] | undefined | null): string {
  return getHomeHref(hasHostRole(roles ?? []));
}
