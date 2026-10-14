/** Canonical product brand — used for all UI logos and wordmarks. */
export const BRAND_NAME = 'Lovenexa';

/** Default tagline shown on authentication screens. */
export const BRAND_TAGLINE = 'Premium Live Video Calls';

/** Configured app name from NEXT_PUBLIC_APP_TITLE. */
export const APP_TITLE = process.env.NEXT_PUBLIC_APP_TITLE?.trim() || BRAND_NAME;

/** Alias used across UI copy. */
export const APP_NAME = APP_TITLE;

export function appTitleOr(fallback = BRAND_NAME): string {
  return APP_TITLE || fallback;
}

export function withAppTitle(suffix?: string): string {
  if (!APP_TITLE) return suffix?.trim() ?? '';
  if (!suffix?.trim()) return APP_TITLE;
  return `${APP_TITLE} — ${suffix.trim()}`;
}