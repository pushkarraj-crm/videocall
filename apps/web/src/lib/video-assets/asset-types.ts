export const ASSET_TYPES = [
  'idle',
  'talking',
  'listening',
  'thinking',
  'smile',
  'laugh',
  'gift_small',
  'gift_vip',
  'wave',
  'bye',
  'surprised',
  'welcome',
] as const;

export type AssetType = (typeof ASSET_TYPES)[number];

export type AssetClip = {
  path: string;
  url: string;
  host: string;
  outfit: string;
  scene: string;
  type: AssetType;
  file: string;
  weight: number;
};

export type HostAssetCatalog = {
  hosts: Record<
    string,
    {
      outfits: Record<
        string,
        {
          scenes: Record<string, AssetClip[]>;
        }
      >;
    }
  >;
  scannedAt: string;
  totalClips: number;
};

export const FILENAME_PREFIX_MAP: Record<string, AssetType> = {
  idle: 'idle',
  talking: 'talking',
  listening: 'listening',
  thinking: 'thinking',
  smile: 'smile',
  laugh: 'laugh',
  gift_small: 'gift_small',
  gift_big: 'gift_vip',
  gift_vip: 'gift_vip',
  wave: 'wave',
  bye: 'bye',
  surprised: 'surprised',
  welcome: 'welcome',
};

export const EXPECTED_ASSET_TYPES: AssetType[] = [
  'idle',
  'talking',
  'thinking',
  'smile',
  'laugh',
  'gift_small',
  'gift_vip',
  'bye',
];

export function parseFilenameAssetType(filename: string): AssetType | null {
  const base = filename.replace(/\.(mp4|webm)$/i, '');
  const prefixes = Object.keys(FILENAME_PREFIX_MAP).sort((a, b) => b.length - a.length);
  for (const prefix of prefixes) {
    if (base.startsWith(`${prefix}_`) || base === prefix) {
      return FILENAME_PREFIX_MAP[prefix];
    }
  }
  return null;
}