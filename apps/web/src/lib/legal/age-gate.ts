export const LOVINEXA_AGE_CONFIRMED_KEY = 'lovinexa_age_confirmed';

export function isAgeConfirmed(): boolean {
  if (typeof window === 'undefined') return false;
  return localStorage.getItem(LOVINEXA_AGE_CONFIRMED_KEY) === 'true';
}

export function setAgeConfirmed(): void {
  localStorage.setItem(LOVINEXA_AGE_CONFIRMED_KEY, 'true');
}

export function clearAgeConfirmed(): void {
  localStorage.removeItem(LOVINEXA_AGE_CONFIRMED_KEY);
}