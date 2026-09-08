import { IsIn, IsString } from 'class-validator';

export const GIFT_CATALOG = {
  rose: { coins: 10, units: 1000n },
  heart: { coins: 20, units: 2000n },
  diamond: { coins: 50, units: 5000n },
  crown: { coins: 100, units: 10000n },
} as const;

export type GiftId = keyof typeof GIFT_CATALOG;

export class SendGiftDto {
  @IsString()
  @IsIn(Object.keys(GIFT_CATALOG))
  giftId!: GiftId;
}