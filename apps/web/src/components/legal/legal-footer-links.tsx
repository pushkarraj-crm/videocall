import Link from 'next/link';
import { cn } from '@/lib/utils';

const links = [
  { href: '/privacy', label: 'Privacy Policy' },
  { href: '/terms', label: 'Terms' },
  { href: '/refund-policy', label: 'Refund Policy' },
  { href: '/community-guidelines', label: 'Community Guidelines' },
  { href: '/contact', label: 'Contact' },
] as const;

export function LegalFooterLinks({ className }: { className?: string }) {
  return (
    <div className={cn('flex flex-wrap items-center justify-center gap-x-4 gap-y-1', className)}>
      {links.map((link, index) => (
        <span key={link.href} className="inline-flex items-center gap-4">
          {index > 0 && <span aria-hidden className="text-white/20">·</span>}
          <Link href={link.href} className="transition-colors hover:text-white/70">
            {link.label}
          </Link>
        </span>
      ))}
    </div>
  );
}