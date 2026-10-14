'use client';

import { useEffect, useRef, useState } from 'react';
import { useInView } from 'framer-motion';

interface AnimatedCounterProps {
  value: number;
  suffix?: string;
  format?: 'default' | 'compact';
  duration?: number;
}

function formatValue(value: number, format: 'default' | 'compact') {
  if (format === 'compact' && value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(0)}M`;
  }
  if (format === 'compact' && value >= 1_000) {
    return `${Math.round(value / 1_000)}K`;
  }
  return value.toLocaleString();
}

export function AnimatedCounter({
  value,
  suffix = '',
  format = 'default',
  duration = 2000,
}: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (!isInView) return;

    const start = performance.now();
    let frame = 0;

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - (1 - progress) ** 3;
      setDisplay(Math.floor(value * eased));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [isInView, value, duration]);

  return (
    <span ref={ref}>
      {formatValue(display, format)}
      {suffix}
    </span>
  );
}