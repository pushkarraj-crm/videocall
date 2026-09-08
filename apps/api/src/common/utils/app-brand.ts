/** Configured app title; empty string when unset. */
export const APP_TITLE = (process.env.APP_TITLE ?? process.env.NEXT_PUBLIC_APP_TITLE ?? '').trim();

export function appTitleOr(fallback = ''): string {
  return APP_TITLE || fallback;
}

export function withAppTitle(suffix: string): string {
  if (!APP_TITLE) return suffix.trim();
  return `${APP_TITLE} — ${suffix}`;
}

export function smsPrefix(): string {
  return APP_TITLE ? `${APP_TITLE}: ` : '';
}