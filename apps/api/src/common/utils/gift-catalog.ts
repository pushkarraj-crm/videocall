import { GiftAnimationTier, GiftCategory } from '@prisma/client';
import { coinsToUnits } from '../constants/coins';

/** Legacy hardcoded catalog — fallback when DB item missing */
export const LEGACY_GIFT_CATALOG = {
  rose: { coins: 10, units: 1000n },
  heart: { coins: 20, units: 2000n },
  diamond: { coins: 50, units: 5000n },
  crown: { coins: 100, units: 10000n },
} as const;

export type ResolvedGift = {
  slug: string;
  name: string;
  icon: string;
  category: GiftCategory;
  coinPrice: number;
  units: bigint;
  animationTier: GiftAnimationTier;
  animationKey: string;
  catalogGiftId: string | null;
};

export function serializeGiftCatalogItem(row: {
  id: string;
  slug: string;
  name: string;
  icon: string;
  category: GiftCategory;
  coinPrice: number;
  animationTier: GiftAnimationTier;
  animationKey: string;
  popularity: number;
  sortOrder: number;
  isEnabled: boolean;
  isFeatured: boolean;
  isTrending: boolean;
  isLimited: boolean;
  seasonTag: string | null;
}) {
  return {
    id: row.slug,
    catalogId: row.id,
    slug: row.slug,
    name: row.name,
    icon: row.icon,
    category: row.category,
    coinPrice: row.coinPrice,
    animationTier: row.animationTier,
    animationKey: row.animationKey,
    popularity: row.popularity,
    sortOrder: row.sortOrder,
    isEnabled: row.isEnabled,
    isFeatured: row.isFeatured,
    isTrending: row.isTrending,
    isLimited: row.isLimited,
    seasonTag: row.seasonTag,
  };
}

export function resolveLegacyGift(slug: string): ResolvedGift | null {
  const legacy = LEGACY_GIFT_CATALOG[slug as keyof typeof LEGACY_GIFT_CATALOG];
  if (!legacy) return null;
  return {
    slug,
    name: slug.charAt(0).toUpperCase() + slug.slice(1),
    icon: '🎁',
    category: GiftCategory.basic,
    coinPrice: legacy.coins,
    units: legacy.units,
    animationTier: GiftAnimationTier.floating,
    animationKey: 'floating_float',
    catalogGiftId: null,
  };
}

export function resolvedFromCatalog(row: {
  id: string;
  slug: string;
  name: string;
  icon: string;
  category: GiftCategory;
  coinPrice: number;
  animationTier: GiftAnimationTier;
  animationKey: string;
}): ResolvedGift {
  return {
    slug: row.slug,
    name: row.name,
    icon: row.icon,
    category: row.category,
    coinPrice: row.coinPrice,
    units: coinsToUnits(row.coinPrice),
    animationTier: row.animationTier,
    animationKey: row.animationKey,
    catalogGiftId: row.id,
  };
}