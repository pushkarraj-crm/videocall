'use client';

import { motion } from 'framer-motion';
import { Gift, Sparkles } from 'lucide-react';
import { LANDING_GIFTS } from '@/components/landing/landing-data';

export function LandingGifts() {
  return (
    <section id="gifts" className="relative py-20 sm:py-28 lg:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12 text-center"
        >
          <p className="text-sm font-medium uppercase tracking-widest text-pink-400">Gifts & Rewards</p>
          <h2 className="mt-2 text-3xl font-bold sm:text-4xl">Make every call unforgettable</h2>
          <p className="mx-auto mt-3 max-w-xl text-white/50">
            Send premium gifts during live video calls. Hosts earn rewards instantly.
          </p>
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {LANDING_GIFTS.map((gift, i) => (
            <motion.div
              key={gift.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -6 }}
              className="landing-gradient-border"
            >
              <div className="landing-glass flex flex-col items-center rounded-2xl p-6 text-center">
                <span className="text-5xl">{gift.emoji}</span>
                <h3 className="mt-4 text-lg font-semibold">{gift.name}</h3>
                <p className="mt-1 text-2xl font-bold gradient-text">{gift.coins}</p>
                <p className="text-xs text-white/40">coins</p>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mt-10 flex items-center justify-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-6 py-4 text-sm text-white/60"
        >
          <Gift className="h-5 w-5 text-pink-400" />
          <span>Gifts are deducted from your wallet and credited to host earnings in real time.</span>
          <Sparkles className="h-4 w-4 text-amber-400" />
        </motion.div>
      </div>
    </section>
  );
}