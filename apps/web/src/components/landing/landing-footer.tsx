import Link from 'next/link';
import { BrandLogo } from '@/components/brand/brand-logo';
import { BRAND_TAGLINE, appTitleOr } from '@/lib/app-brand';

const footerLinks = {
  Product: [
    { href: '#hosts', label: 'Hosts' },
    { href: '#features', label: 'Features' },
    { href: '#gifts', label: 'Gifts' },
    { href: '/login', label: 'Get Started' },
  ],
  Legal: [
    { href: '/privacy', label: 'Privacy Policy' },
    { href: '/terms', label: 'Terms' },
    { href: '/refund-policy', label: 'Refund Policy' },
    { href: '/community-guidelines', label: 'Community Guidelines' },
  ],
  Support: [
    { href: '/contact', label: 'Contact' },
    { href: 'mailto:support@lovenexa.com', label: 'Support' },
  ],
};

export function LandingFooter() {
  return (
    <footer className="border-t border-white/5 bg-black/40 py-12 sm:py-16">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div className="lg:col-span-1">
            <BrandLogo size="md" />
            <p className="mt-3 text-sm leading-relaxed text-white/40">
              {BRAND_TAGLINE}. Connect, chat, gift, and earn — all in one beautiful app.
            </p>
          </div>

          {Object.entries(footerLinks).map(([title, links]) => (
            <div key={title}>
              <h4 className="text-sm font-semibold uppercase tracking-wider text-white/60">{title}</h4>
              <ul className="mt-4 space-y-2">
                {links.map((link) => (
                  <li key={link.label}>
                    {link.href.startsWith('/') || link.href.startsWith('mailto') ? (
                      <Link
                        href={link.href}
                        className="text-sm text-white/40 transition-colors hover:text-white"
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <a
                        href={link.href}
                        className="text-sm text-white/40 transition-colors hover:text-white"
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}

          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wider text-white/60">About</h4>
            <p className="mt-4 text-sm text-white/40">
              Built for meaningful connections. Safe, secure, and app-store friendly.
            </p>
          </div>
        </div>

        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-white/5 pt-8 text-xs text-white/30 sm:flex-row">
          <p>© {new Date().getFullYear()} {appTitleOr()}. All rights reserved.</p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link href="/privacy" className="hover:text-white/60">Privacy</Link>
            <Link href="/terms" className="hover:text-white/60">Terms</Link>
            <Link href="/refund-policy" className="hover:text-white/60">Refund</Link>
            <Link href="/community-guidelines" className="hover:text-white/60">Guidelines</Link>
            <Link href="/contact" className="hover:text-white/60">Contact</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}