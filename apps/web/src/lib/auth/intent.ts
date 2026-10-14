import type { AuthIntent } from './constants';
import { AUTH_INTENT_KEY } from './constants';

export function setAuthIntent(intent: AuthIntent) {
  if (typeof window === 'undefined') return;
  sessionStorage.setItem(AUTH_INTENT_KEY, intent);
}

export function getAuthIntent(): AuthIntent {
  if (typeof window === 'undefined') return 'user';
  const value = sessionStorage.getItem(AUTH_INTENT_KEY);
  if (value === 'host' || value === 'admin') return value;
  return 'user';
}

export function clearAuthIntent() {
  if (typeof window === 'undefined') return;
  sessionStorage.removeItem(AUTH_INTENT_KEY);
}