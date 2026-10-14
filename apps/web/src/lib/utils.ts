import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCoins(units: string | number): string {
  const n = typeof units === 'string' ? parseInt(units, 10) : units;
  return (n / 100).toFixed(n % 100 === 0 ? 0 : 1);
}

export function formatInr(amount: number | string): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(amount));
}

export function coinsToMinutes(coins: number, coinsPerMinute = 5): number {
  return Math.floor(coins / coinsPerMinute);
}

export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function hostCoinsToInr(coins: number): number {
  return Math.round(coins);
}

export function formatHostInr(coins: number): string {
  return formatInr(hostCoinsToInr(coins));
}

export function hostRating(rating?: number | null): string {
  if (rating == null || rating === 0) return 'New';
  return rating.toFixed(1);
}