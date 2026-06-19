export const COIN_UNIT_SCALE = 100;

export function coinsToUnits(coins: number): bigint {
  return BigInt(Math.round(coins * COIN_UNIT_SCALE));
}

export function unitsToCoins(units: bigint): number {
  return Number(units) / COIN_UNIT_SCALE;
}