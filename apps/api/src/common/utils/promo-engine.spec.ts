import { PromoDiscountType } from '@prisma/client';
import { calculatePromoBenefits, scorePromoForRecharge } from './promo-engine';

describe('promo-engine', () => {
  it('applies fixed amount discount', () => {
    const result = calculatePromoBenefits({
      rechargeInr: 500,
      baseCoinUnits: 50000n,
      discountType: PromoDiscountType.fixed_amount,
      discountValue: 100,
      maxDiscount: null,
      bonusCoins: 0,
      cashbackCoins: 0,
    });
    expect(result.discountInr).toBe(100);
    expect(result.finalInr).toBe(400);
  });

  it('applies percentage with max cap', () => {
    const result = calculatePromoBenefits({
      rechargeInr: 1000,
      baseCoinUnits: 100000n,
      discountType: PromoDiscountType.percentage,
      discountValue: 20,
      maxDiscount: 150,
      bonusCoins: 0,
      cashbackCoins: 0,
    });
    expect(result.discountInr).toBe(150);
    expect(result.finalInr).toBe(850);
  });

  it('adds bonus and cashback coins', () => {
    const result = calculatePromoBenefits({
      rechargeInr: 500,
      baseCoinUnits: 50000n,
      discountType: PromoDiscountType.mixed,
      discountValue: 10,
      maxDiscount: 100,
      bonusCoins: 150,
      cashbackCoins: 50,
    });
    expect(result.bonusCoinUnits).toBe(15000n);
    expect(result.cashbackCoinUnits).toBe(5000n);
    expect(result.totalCoinUnits).toBe(70000n);
  });

  it('scores higher discount promos better', () => {
    const high = scorePromoForRecharge({
      discountInr: 100,
      bonusCoins: 0,
      cashbackCoins: 0,
      minimumRecharge: 0,
      rechargeInr: 500,
    });
    const low = scorePromoForRecharge({
      discountInr: 10,
      bonusCoins: 0,
      cashbackCoins: 0,
      minimumRecharge: 0,
      rechargeInr: 500,
    });
    expect(high).toBeGreaterThan(low);
  });
});