'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Copy, Share2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { REFERRAL_REWARD_COINS } from '@/lib/constants';

export function LandingReferral() {
  return (
    <section id="referrals" className="relative py-20 sm:py-28 lg:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="landing-gradient-border overflow-hidden rounded-3xl"
        >
          <div className="landing-glass relative overflow-hidden rounded-3xl p-8 sm:p-12">
            <div className="landing-glow-orb absolute -right-20 -top-20 h-60 w-60 rounded-full bg-fuchsia-500/20 blur-[80px]" />

            <div className="relative grid gap-8 lg:grid-cols-2 lg:items-center">
              <div>
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl gradient-primary">
                  <Users className="h-6 w-6 text-white" />
                </div>
                <h2 className="text-3xl font-bold sm:text-4xl">Invite Friends. Earn Coins.</h2>
                <p className="mt-4 text-white/50">
                  Share your unique referral code with friends. When they join and recharge,
                  you both earn <span className="font-semibold text-pink-300">{REFERRAL_REWARD_COINS} coins</span>.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Button className="gradient-primary border-0" asChild>
                    <Link href="/login?redirect=/referrals">
                      <Share2 className="mr-2 h-4 w-4" />
                      Get Referral Code
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="landing-glass rounded-2xl border border-white/10 p-6">
                <p className="text-xs uppercase tracking-wider text-white/40">Your referral card</p>
                <div className="mt-4 flex items-center justify-between rounded-xl bg-black/40 px-4 py-3">
                  <code className="font-mono text-lg tracking-wider text-pink-300">PLATFORM-XXXX</code>
                  <Copy className="h-4 w-4 text-white/40" />
                </div>
                <div className="mt-6 grid grid-cols-3 gap-4 text-center">
                  {[
                    { label: 'Invited', value: '—' },
                    { label: 'Earned', value: '—' },
                    { label: 'Per friend', value: `${REFERRAL_REWARD_COINS}` },
                  ].map((item) => (
                    <div key={item.label}>
                      <p className="text-xl font-bold">{item.value}</p>
                      <p className="text-xs text-white/40">{item.label}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}