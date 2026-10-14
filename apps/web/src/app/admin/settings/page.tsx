'use client';

import Link from 'next/link';
import { Route, Settings } from 'lucide-react';

const settingsLinks = [
  {
    href: '/admin/settings/call-routing',
    icon: Route,
    title: 'Call Routing',
    description: 'Configure AI host routing, fallbacks, and default call behavior.',
  },
];

export default function AdminSettingsPage() {
  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <Settings className="h-7 w-7 text-[#FF2E74]" />
        <div>
          <h1 className="text-2xl font-bold text-white">Settings</h1>
          <p className="text-sm text-[#A7A7B3]">Platform configuration and routing</p>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        {settingsLinks.map(({ href, icon: Icon, title, description }) => (
          <Link
            key={href}
            href={href}
            className="rounded-2xl border border-white/10 bg-[#17171C]/90 p-5 transition-colors hover:border-[#FF6B9D]/30 hover:bg-white/[0.03]"
          >
            <div className="flex items-start gap-3">
              <div className="rounded-xl bg-[#FF2E74]/15 p-2.5 text-[#FF6B9D]">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <h2 className="font-semibold text-white">{title}</h2>
                <p className="mt-1 text-sm text-[#A7A7B3]">{description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}