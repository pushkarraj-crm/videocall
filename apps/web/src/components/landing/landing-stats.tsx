'use client';

import { motion } from 'framer-motion';
import { AnimatedCounter } from '@/components/landing/animated-counter';
import { PLATFORM_STATS } from '@/components/landing/landing-data';

export function LandingStats() {
  return (
    <section className="relative py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.98 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="landing-gradient-border overflow-hidden rounded-3xl"
        >
          <div className="landing-glass grid grid-cols-2 gap-6 rounded-3xl p-8 sm:grid-cols-4 sm:gap-8 sm:p-12">
            {PLATFORM_STATS.map((stat, i) => (
              <motion.div
                key={stat.label}
                initial={{ opacity: 0, y: 16 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="text-center"
              >
                <p className="text-2xl font-bold sm:text-3xl lg:text-4xl">
                  <AnimatedCounter
                    value={stat.value}
                    suffix={stat.suffix}
                    format={stat.format}
                  />
                </p>
                <p className="mt-1 text-sm text-white/50">{stat.label}</p>
              </motion.div>
            ))}
          </div>
        </motion.div>
      </div>
    </section>
  );
}