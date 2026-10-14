'use client';

import Image from 'next/image';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Coins, Video } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { COINS_PER_MIN, DEMO_HOSTS } from '@/components/landing/landing-data';

export function LandingHostShowcase() {
  return (
    <section id="hosts" className="relative py-20 sm:py-28 lg:py-32">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="mb-10 text-center"
        >
          <p className="text-sm font-medium uppercase tracking-widest text-pink-400">Featured hosts</p>
          <h2 className="mt-2 text-3xl font-bold sm:text-4xl">Premium video companions</h2>
          <p className="mx-auto mt-3 max-w-lg text-white/50">
            Discover beautiful hosts from India — ready for HD video calls.
          </p>
        </motion.div>

        <div className="landing-hide-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4 pb-4 sm:-mx-6 sm:px-6">
          {DEMO_HOSTS.map((host, i) => (
            <motion.article
              key={host.id}
              initial={{ opacity: 0, x: 24 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.05 }}
              className="w-[260px] shrink-0 sm:w-[280px]"
            >
              <div className="landing-gradient-border overflow-hidden rounded-2xl">
                <div className="landing-glass rounded-2xl p-4">
                  <div className="relative mb-4 aspect-[3/4] overflow-hidden rounded-xl">
                    <Image
                      src={host.image}
                      alt={host.name}
                      fill
                      sizes="280px"
                      className="object-cover transition-transform duration-500 hover:scale-105"
                    />
                    {host.online && (
                      <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1 text-xs backdrop-blur">
                        <span className="h-2 w-2 rounded-full bg-emerald-400" />
                        Online
                      </div>
                    )}
                  </div>

                  <h3 className="text-lg font-semibold">{host.name}</h3>

                  <div className="mt-2 flex items-center gap-2 text-sm text-white/50">
                    <span>{host.age}</span>
                    <span className="text-white/25">·</span>
                    <span>{host.country}</span>
                  </div>

                  <div className="mt-3 flex items-center justify-between">
                    <span className="flex items-center gap-1 text-sm text-pink-300">
                      <Coins className="h-4 w-4" />
                      {COINS_PER_MIN}/min
                    </span>
                    <Button size="sm" className="gradient-primary border-0 shadow-md" asChild>
                      <Link href="/login">
                        <Video className="mr-1 h-4 w-4" />
                        Call
                      </Link>
                    </Button>
                  </div>
                </div>
              </div>
            </motion.article>
          ))}
        </div>
      </div>
    </section>
  );
}