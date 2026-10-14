/** Unified design tokens — use these class strings for consistent premium UI. */

export const colors = {
  bg: 'bg-[#0F0F12]',
  card: 'bg-[#17171C]',
  text: 'text-white',
  textSecondary: 'text-[#A7A7B3]',
  primary: 'text-[#FF2E74]',
  accent: 'text-[#FFB347]',
  success: 'text-emerald-400',
  warning: 'text-amber-400',
  danger: 'text-red-400',
} as const;

export const typography = {
  pageTitle: 'text-xl font-bold tracking-tight text-white',
  pageSubtitle: 'text-sm text-[#A7A7B3]',
  sectionTitle: 'text-lg font-semibold text-white',
  sectionLabel: 'text-xs font-semibold uppercase tracking-wider text-[#A7A7B3]',
  body: 'text-sm leading-relaxed text-white/90',
  caption: 'text-xs text-[#A7A7B3]',
  label: 'text-xs font-medium text-[#A7A7B3]',
  stat: 'text-2xl font-bold tabular-nums text-white',
  statSm: 'text-lg font-bold tabular-nums text-white',
} as const;

export const layout = {
  page: 'premium-glow-bg min-h-full',
  pagePad: 'space-y-4 p-4 pb-8',
  pageHeader: 'flex items-center justify-between gap-3',
  section: 'space-y-3',
} as const;

export const surfaces = {
  card: 'premium-card',
  cardInteractive: 'premium-card hover-lift transition-all duration-200',
  glass: 'premium-glass',
  glassSm: 'rounded-2xl border border-white/8 bg-white/5 backdrop-blur-xl',
} as const;

export const radius = {
  sm: 'rounded-xl',
  md: 'rounded-2xl',
  lg: 'rounded-[24px]',
  full: 'rounded-full',
} as const;

export const focusRing =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF2E74]/50 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0F0F12]';