import type { MetadataRoute } from 'next';
import { APP_TITLE, withAppTitle } from '@/lib/app-brand';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: withAppTitle() || 'Video Calls & Rewards',
    short_name: APP_TITLE || 'Video Calls',
    description: 'Premium video calls, wallet, and rewards',
    start_url: '/home',
    display: 'standalone',
    background_color: '#0f0a14',
    theme_color: '#e84393',
    orientation: 'portrait',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}