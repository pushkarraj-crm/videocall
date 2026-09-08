import { unitsToCoins } from '../constants/coins';

/** Host net coin units map 1:1 to INR payout display */
export function hostUnitsToInr(units: bigint | number): number {
  const coins = typeof units === 'bigint' ? unitsToCoins(units) : units / 100;
  return Math.round(coins);
}

export function hostCoinsToInr(coins: number): number {
  return Math.round(coins);
}