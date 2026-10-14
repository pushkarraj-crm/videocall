'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { BrandLogo } from '@/components/brand/brand-logo';
import { Button } from '@/components/ui/button';

const navLinks = [
  { href: '#hosts', label: 'Hosts' },
  { href: '#features', label: 'Features' },
  { href: '#gifts', label: 'Gifts' },
] as const;

export function LandingNav() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-black/55 backdrop-blur-2xl"
    >
      <div className="mx-auto grid h-[72px] max-w-[1600px] grid-cols-[1fr_auto_1fr] items-center gap-4 px-4 sm:h-[80px] sm:px-6 lg:h-[88px] lg:px-10 xl:px-12">
        <div className="flex min-w-0 items-center justify-start">
          <BrandLogo size="lg" />
        </div>

        <nav className="hidden items-center gap-8 md:flex lg:gap-10">
          {navLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-base font-medium text-white/60 transition-colors duration-200 hover:text-white lg:text-[17px]"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center justify-end gap-2 sm:gap-3">
          <Button
            variant="ghost"
            className="h-11 px-4 text-base text-white/75 transition-colors hover:bg-white/8 hover:text-white sm:h-12 sm:px-5"
            asChild
          >
            <Link href="/login">Log in</Link>
          </Button>
          <Button
            className="h-11 border-0 px-5 text-base gradient-primary shadow-lg shadow-[#ff4d8d]/25 transition-shadow hover:shadow-[#ff4d8d]/40 sm:h-12 sm:px-6"
            asChild
          >
            <Link href="/login">Get Started</Link>
          </Button>
        </div>
      </div>
    </motion.header>
  );
}
