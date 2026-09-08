import { PromoDiscountType } from '@prisma/client';
import { coinsToUnits } from '../constants/coins';

export interface PromoBenefitInput {
  rechargeInr: number;
  baseCoinUnits: bigint;
  discountType: PromoDiscountType;
  discountValue: number;
  maxDiscount: number | null;
  bonusCoins: number;
  cashbackCoins: number;
}

export interface PromoBenefitResult {
  originalInr: number;
  discountInr: number;
  finalInr: number;
  bonusCoinUnits: bigint;
  cashbackCoinUnits: bigint;
  totalCoinUnits: bigint;
  savingsInr: number;
}

export function calculatePromoBenefits(input: PromoBenefitInput): PromoBenefitResult {
  const originalInr = input.rechargeInr;
  let discountInr: number;

  switch (input.discountType) {
    case PromoDiscountType.fixed_amount:
      discountInr = Math.min(input.discountValue, originalInr);
      break;
    case PromoDiscountType.percentage:
    case PromoDiscountType.mixed:
      discountInr = (originalInr * input.discountValue) / 100;
      if (input.maxDiscount != null) {
        discountInr = Math.min(discountInr, input.maxDiscount);
      }
      discountInr = Math.min(discountInr, originalInr);
      break;
    default:
      discountInr = 0;
  }

  discountInr = Math.round(discountInr * 100) / 100;
  const finalInr = Math.max(1, Math.round((originalInr - discountInr) * 100) / 100);

  const bonusCoinUnits =
    input.discountType === PromoDiscountType.bonus_coins ||
    input.discountType === PromoDiscountType.mixed
      ? coinsToUnits(input.bonusCoins)
      : 0n;

  const cashbackCoinUnits =
    input.discountType === PromoDiscountType.cashback || input.cashbackCoins > 0
      ? coinsToUnits(input.cashbackCoins)
      : 0n;

  const totalCoinUnits = input.baseCoinUnits + bonusCoinUnits + cashbackCoinUnits;

  return {
    originalInr,
    discountInr,
    finalInr,
    bonusCoinUnits,
    cashbackCoinUnits,
    totalCoinUnits,
    savingsInr: discountInr,
  };
}

export interface PromoScoreInput {
  discountInr: number;
  bonusCoins: number;
  cashbackCoins: number;
  minimumRecharge: number;
  rechargeInr: number;
}

export function scorePromoForRecharge(input: PromoScoreInput): number {
  const minGap = Math.max(0, input.minimumRecharge - input.rechargeInr);
  return (
    input.discountInr * 10 +
    input.bonusCoins * 2 +
    input.cashbackCoins * 1.5 -
    minGap * 0.5
  );
}