'use client';

import { useState, useEffect } from 'react';

interface AnimatedCountProps {
  value: number;
  duration?: number;
}

// Animate integer from 0 → target with comma formatting
export default function AnimatedCount({ value, duration = 1400 }: AnimatedCountProps) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const end = value;
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.floor(end * eased));
      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [value, duration]);

  return <span>{display.toLocaleString()}</span>;
}
