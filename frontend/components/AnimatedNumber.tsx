'use client';

import { useState, useEffect } from 'react';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  decimals?: number;
}

// Animate from 0 → target using cubic ease-out
export default function AnimatedNumber({ value, duration = 1200, decimals = 1 }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    const end = value;
    const startTime = performance.now();

    // ease-out: fast start, slow finish → 1 - (1 - t)³
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);

      setDisplay(end * eased);
      if (progress < 1) requestAnimationFrame(animate);
    };

    requestAnimationFrame(animate);
  }, [value, duration]);

  return <span>{display.toFixed(decimals)}</span>;
}
