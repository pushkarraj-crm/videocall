'use client';

import { Bell } from 'lucide-react';

export function NotificationEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="relative">
        <svg
          width="120"
          height="120"
          viewBox="0 0 120 120"
          fill="none"
          aria-hidden
          className="opacity-90"
        >
          <circle cx="60" cy="60" r="54" fill="url(#glow)" />
          <circle cx="60" cy="60" r="40" stroke="rgba(255,255,255,0.08)" strokeWidth="1.5" />
          <path
            d="M60 34c-8.8 0-16 7.2-16 16v10l-4 6h40l-4-6V50c0-8.8-7.2-16-16-16Z"
            fill="rgba(255,46,116,0.15)"
            stroke="#FF6B9D"
            strokeWidth="1.5"
            strokeLinejoin="round"
          />
          <path
            d="M52 78c1.6 3.2 4.8 5 8 5s6.4-1.8 8-5"
            stroke="#FF6B9D"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
          <circle cx="88" cy="36" r="10" fill="#FF2E74" fillOpacity="0.25" />
          <defs>
            <radialGradient id="glow" cx="0" cy="0" r="1" gradientTransform="rotate(90 0 -60) scale(54)">
              <stop stopColor="#FF2E74" stopOpacity="0.12" />
              <stop offset="1" stopColor="#FF2E74" stopOpacity="0" />
            </radialGradient>
          </defs>
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <Bell className="h-8 w-8 text-[#FF6B9D]/80" />
        </div>
      </div>
      <div>
        <p className="text-sm font-semibold text-white">You&apos;re all caught up</p>
        <p className="mt-1 text-xs text-[#A7A7B3]">
          New alerts will appear here instantly — no refresh needed
        </p>
      </div>
    </div>
  );
}