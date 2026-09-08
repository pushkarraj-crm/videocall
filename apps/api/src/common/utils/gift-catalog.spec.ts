import { GiftAnimationTier, GiftCategory } from '@prisma/client';
import { resolveLegacyGift, resolvedFromCatalog } from './gift-catalog';

describe('gift-catalog', () => {
  it('resolves legacy rose gift', () => {
    const gift = resolveLegacyGift('rose');
    expect(gift?.coinPrice).toBe(10);
    expect(gift?.units).toBe(1000n);
  });

  it('resolves catalog row', () => {
    const gift = resolvedFromCatalog({
      id: 'id-1',
      slug: 'rocket',
      name: 'Rocket',
      icon: '🚀',
      category: GiftCategory.vip,
      coinPrice: 10000,
      animationTier: GiftAnimationTier.cinematic,
      animationKey: 'rocket_launch',
    });
    expect(gift.coinPrice).toBe(10000);
    expect(gift.units).toBe(1000000n);
    expect(gift.catalogGiftId).toBe('id-1');
  });
});