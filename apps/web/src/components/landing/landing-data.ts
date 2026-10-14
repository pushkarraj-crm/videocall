import { COINS_PER_MINUTE, GIFT_ITEMS, REFERRAL_REWARD_COINS } from '@/lib/constants';

export const PLATFORM_STATS = [
  { label: 'Calls', value: 10000, suffix: '+' },
  { label: 'Hosts', value: 2000, suffix: '+' },
  { label: 'Users', value: 50000, suffix: '+' },
  { label: 'Coins Earned', value: 1000000, suffix: '+', format: 'compact' as const },
];

export const LANDING_FEATURES = [
  {
    icon: 'video' as const,
    title: 'HD Video Calling',
    description: 'Crystal-clear video with seamless connection and premium audio quality.',
  },
  {
    icon: 'zap' as const,
    title: 'Instant Match',
    description: 'Get matched with online hosts in seconds — no waiting around.',
  },
  {
    icon: 'shuffle' as const,
    title: 'Random Connections',
    description: 'Discover new people worldwide with one-tap random matching.',
  },
  {
    icon: 'wallet' as const,
    title: 'Coin Wallet',
    description: 'Recharge, track spending, and manage your balance effortlessly.',
  },
  {
    icon: 'gift' as const,
    title: 'Gifts & Rewards',
    description: 'Send stunning gifts during calls and make every moment memorable.',
  },
  {
    icon: 'users' as const,
    title: 'Referral Earnings',
    description: `Invite friends and earn ${REFERRAL_REWARD_COINS} coins for every successful referral.`,
  },
];

export const DEMO_HOSTS = [
  { id: '1', name: 'Priya Sharma', age: 24, country: 'India', image: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=400&h=500&fit=crop&q=80', online: true },
  { id: '2', name: 'Ananya Reddy', age: 22, country: 'India', image: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=400&h=500&fit=crop&q=80', online: true },
  { id: '3', name: 'Kavya Iyer', age: 26, country: 'India', image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=400&h=500&fit=crop&q=80', online: true },
  { id: '4', name: 'Meera Nair', age: 23, country: 'India', image: 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=400&h=500&fit=crop&q=80', online: true },
  { id: '5', name: 'Riya Kapoor', age: 25, country: 'India', image: 'https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=400&h=500&fit=crop&q=80', online: true },
  { id: '6', name: 'Sneha Patel', age: 21, country: 'India', image: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8a04?w=400&h=500&fit=crop&q=80', online: true },
  { id: '7', name: 'Divya Menon', age: 27, country: 'India', image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=400&h=500&fit=crop&q=80', online: true },
  { id: '8', name: 'Ishita Bose', age: 24, country: 'India', image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=400&h=500&fit=crop&q=80', online: true },
] as const;

export const COINS_PER_MIN = COINS_PER_MINUTE;

export const LANDING_GIFTS = GIFT_ITEMS;

export const TESTIMONIALS = [
  {
    id: '1',
    name: 'Rahul K.',
    role: 'User',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100&h=100&fit=crop&q=80',
    text: 'The video quality is incredible. I matched with hosts instantly and the whole experience feels premium.',
    rating: 5,
  },
  {
    id: '2',
    name: 'Emily R.',
    role: 'Host',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100&h=100&fit=crop&q=80',
    text: 'Earning coins through calls and gifts has been amazing. The dashboard makes everything simple.',
    rating: 5,
  },
  {
    id: '3',
    name: 'Carlos M.',
    role: 'User',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&q=80',
    text: 'Random match is so fun! Met people from different countries in one evening. Highly recommend.',
    rating: 5,
  },
  {
    id: '4',
    name: 'Ananya S.',
    role: 'User',
    avatar: 'https://images.unsplash.com/photo-1580489944761-15a19d654956?w=100&h=100&fit=crop&q=80',
    text: 'Referral rewards are generous. I invited three friends and earned enough coins for hours of calls.',
    rating: 4,
  },
];

/** Landing hero uses the local asset at /public/hero-image.png */
export const HERO_IMAGES = {
  main: '/hero-image.png',
};