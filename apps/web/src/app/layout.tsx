import type { Metadata, Viewport } from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { AppProviders } from '@/providers/app-providers';
import { APP_TITLE, withAppTitle } from '@/lib/app-brand';
import './globals.css';

export const metadata: Metadata = {
  title: withAppTitle() || 'Video Calls & Rewards',
  description: 'Discover hosts, video chat live, earn rewards',
  manifest: '/manifest',
  icons: { icon: '/lovenexa-logo.png', apple: '/lovenexa-logo.png' },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: APP_TITLE || 'Video Calls',
  },
};

export const viewport: Viewport = {
  themeColor: '#0F0F12',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${GeistSans.variable} ${GeistMono.variable} antialiased`}>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
