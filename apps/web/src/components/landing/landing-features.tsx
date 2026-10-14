'use client';

import { motion } from 'framer-motion';
import {
  Gift,
  Shuffle,
  Users,
  Video,
  Wallet,
  Zap,
} from 'lucide-react';
import { LANDING_FEATURES } from '@/components/landing/landing-data';

const iconMap = {
  video: Video,
  zap: Zap,
  shuffle: Shuffle,
  wallet: Wallet,
  gift: Gift,
  users: Users,
};

export function LandingFeatures() {
  return (
    <section id="features" className="relative py-20 sm:py-28 lg:py-32">
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-transparent via-violet-950/20 to-transparent" />

      <div className="relative mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-12 text-center"
        >
          <p className="text-sm font-medium uppercase tracking-widest text-violet-400">Why us</p>
          <h2 className="mt-2 text-3xl font-bold sm:text-4xl">Everything you need to connect</h2>
        </motion.div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {LANDING_FEATURES.map((feature, i) => {
            const Icon = iconMap[feature.icon];
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.08 }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="group landing-glass rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-[#ff4d8d]/10"
              >
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl gradient-primary shadow-lg shadow-fuchsia-500/20 transition-transform group-hover:scale-110">
                  <Icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold">{feature.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-white/50">{feature.description}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}