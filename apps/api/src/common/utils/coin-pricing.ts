import type { PrismaClient } from '@prisma/client';
import type { ConfigService } from '@nestjs/config';
import { unitsToCoins } from '../constants/coins';

export function defaultCoinsPerMinuteUnits(config: ConfigService): bigint {
  return BigInt(config.get<number>('COINS_PER_MINUTE_UNITS', 500));
}

export function resolveCoinsPerMinuteUnits(
  hostCoinsPerMinuteUnits: bigint | null | undefined,
  config: ConfigService,
): bigint {
  if (hostCoinsPerMinuteUnits != null && hostCoinsPerMinuteUnits > 0n) {
    return hostCoinsPerMinuteUnits;
  }
  return defaultCoinsPerMinuteUnits(config);
}

export function unitsToCoinsPerMinute(units: bigint): number {
  return Number(units) / 100;
}

export async function getInrPerCoin(prisma: PrismaClient): Promise<number> {
  const packages = await prisma.coinPackage.findMany({
    where: { isActive: true, deletedAt: null },
    select: { priceInr: true, coinUnits: true, bonusUnits: true },
  });

  if (!packages.length) return 1;

  let totalInr = 0;
  let totalCoins = 0;

  for (const pkg of packages) {
    const coins = Number(pkg.coinUnits + pkg.bonusUnits) / 100;
    if (coins <= 0) continue;
    totalInr += Number(pkg.priceInr);
    totalCoins += coins;
  }

  return totalCoins > 0 ? totalInr / totalCoins : 1;
}

export function unitsToMonetary(
  units: bigint,
  inrPerCoin: number,
  platformFeePercent: number,
): {
  grossInr: number;
  platformFeeInr: number;
  hostInr: number;
} {
  const coins = unitsToCoins(units);
  const grossInr = Math.round(coins * inrPerCoin * 100) / 100;
  const platformFeeInr = Math.round(grossInr * (platformFeePercent / 100) * 100) / 100;
  const hostInr = Math.round((grossInr - platformFeeInr) * 100) / 100;

  return { grossInr, platformFeeInr, hostInr };
}