/**
 * Development-only auth helpers.
 * Never link these from public UI. Routes under /dev/login/* gate on isDevLoginRoutesEnabled().
 */

export type DevLoginRole = 'user' | 'host' | 'admin';

/** Private test routes only work in local development builds. */
export function isDevLoginRoutesEnabled(): boolean {
  return process.env.NODE_ENV === 'development';
}

/** Same phone mapping the former public Dev Login panel used. */
export const DEV_LOGIN_PHONES: Record<DevLoginRole, string> = {
  user: '+919999990001',
  host: '+919999990002',
  admin: '+919999990003',
};

export function isDevLoginRole(value: string): value is DevLoginRole {
  return value === 'user' || value === 'host' || value === 'admin';
}
