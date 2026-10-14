'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function LandingCta() {
  return (
    <section className="relative py-20 sm:py-28">
      <div className="mx-auto max-w-4xl px-4 sm:px-6">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative overflow-hidden rounded-3xl gradient-primary p-10 text-center shadow-2xl shadow-[#ff4d8d]/25 transition-shadow duration-300 hover:shadow-[#ff4d8d]/40 sm:p-14"
        >
          <div className="landing-glow-orb absolute -left-10 -top-10 h-40 w-40 rounded-full bg-white/20 blur-[60px]" />
          <h2 className="relative text-3xl font-bold text-white sm:text-4xl">
            Ready to start connecting?
          </h2>
          <p className="relative mx-auto mt-4 max-w-md text-white/80">
            Join thousands making real connections every day. Your first calls are on us.
          </p>
          <Button
            size="lg"
            variant="secondary"
            className="relative mt-8 h-12 px-8 text-base"
            asChild
          >
            <Link href="/login">
              Create free account
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </motion.div>
      </div>
    </section>
  );
}