-- Gift catalog & premium gift economy extensions

CREATE TYPE "gift_category_enum" AS ENUM ('basic', 'premium', 'luxury', 'vip');
CREATE TYPE "gift_animation_tier_enum" AS ENUM ('floating', 'center', 'fullscreen', 'cinematic');

CREATE TABLE "gift_catalog" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "slug" VARCHAR(64) NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "icon" VARCHAR(16) NOT NULL,
    "category" "gift_category_enum" NOT NULL,
    "coin_price" INTEGER NOT NULL,
    "animation_tier" "gift_animation_tier_enum" NOT NULL,
    "animation_key" VARCHAR(64) NOT NULL,
    "popularity" INTEGER NOT NULL DEFAULT 0,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "is_enabled" BOOLEAN NOT NULL DEFAULT true,
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "is_trending" BOOLEAN NOT NULL DEFAULT false,
    "is_limited" BOOLEAN NOT NULL DEFAULT false,
    "season_tag" VARCHAR(64),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "gift_catalog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "gift_catalog_slug_key" ON "gift_catalog"("slug");
CREATE INDEX "gift_catalog_is_enabled_sort_order_idx" ON "gift_catalog"("is_enabled", "sort_order");
CREATE INDEX "gift_catalog_category_is_enabled_idx" ON "gift_catalog"("category", "is_enabled");

ALTER TABLE "call_gifts" ADD COLUMN "catalog_gift_id" UUID;
ALTER TABLE "call_gifts" ADD COLUMN "quantity" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE "call_gifts" ADD CONSTRAINT "call_gifts_catalog_gift_id_fkey"
    FOREIGN KEY ("catalog_gift_id") REFERENCES "gift_catalog"("id") ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "gift_catalog" ("slug", "name", "icon", "category", "coin_price", "animation_tier", "animation_key", "popularity", "sort_order", "is_enabled", "is_featured", "is_trending") VALUES
('rose', 'Rose', '🌹', 'basic', 10, 'floating', 'rose_petals', 100, 1, true, true, true),
('tulip', 'Tulip', '🌷', 'basic', 15, 'floating', 'floating_petals', 80, 2, true, false, false),
('heart', 'Heart', '❤️', 'basic', 25, 'floating', 'heart_burst', 95, 3, true, true, true),
('teddy', 'Teddy', '🐻', 'basic', 30, 'floating', 'floating_float', 70, 4, true, false, false),
('coffee', 'Coffee', '☕', 'basic', 35, 'floating', 'floating_float', 60, 5, true, false, false),
('chocolate', 'Chocolate', '🍫', 'premium', 50, 'floating', 'floating_float', 75, 10, true, false, true),
('cake', 'Cake', '🎂', 'premium', 80, 'center', 'center_sparkle', 65, 11, true, false, false),
('ring', 'Ring', '💍', 'premium', 120, 'center', 'center_sparkle', 55, 12, true, true, false),
('diamond', 'Diamond', '💎', 'luxury', 250, 'center', 'diamond_sparkle', 90, 20, true, true, true),
('crown', 'Crown', '👑', 'luxury', 300, 'center', 'center_sparkle', 85, 21, true, true, false),
('sports_car', 'Sports Car', '🚗', 'luxury', 1000, 'fullscreen', 'car_drive', 40, 22, true, true, false),
('super_bike', 'Super Bike', '🏍', 'luxury', 800, 'fullscreen', 'car_drive', 35, 23, true, false, false),
('yacht', 'Yacht', '🛥', 'vip', 2500, 'fullscreen', 'yacht_sail', 25, 30, true, true, false),
('jet', 'Jet', '✈', 'vip', 5000, 'cinematic', 'jet_fly', 20, 31, true, true, false),
('rocket', 'Rocket', '🚀', 'vip', 10000, 'cinematic', 'rocket_launch', 30, 32, true, true, true),
('castle', 'Castle', '🏰', 'vip', 7500, 'cinematic', 'castle_glow', 15, 33, true, false, false),
('unicorn', 'Unicorn', '🦄', 'vip', 6000, 'cinematic', 'unicorn_magic', 18, 34, true, false, true),
('dragon', 'Dragon', '🐉', 'vip', 8000, 'cinematic', 'dragon_roar', 12, 35, true, false, false),
('galaxy', 'Galaxy', '🌌', 'vip', 15000, 'cinematic', 'galaxy_cosmic', 22, 36, true, true, true);