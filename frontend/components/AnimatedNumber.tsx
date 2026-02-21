'use client';

import { useState, useEffect, useRef } from 'react';

interface AnimatedNumberProps {
  value: number;
  duration?: number;
  decimals?: number;
  replay?: boolean;
}

// Animate from 0 → target using cubic ease-out
// When `replay` toggles to true, resets and re-animates
export default function AnimatedNumber({ value, duration = 1500, decimals = 1, replay }: AnimatedNumberProps) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);

  const runAnimation = (end: number) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(end * eased);
      if (progress < 1) rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);
  };

  useEffect(() => {
    runAnimation(value);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [value, duration]);

  useEffect(() => {
    if (!replay) return;
    setDisplay(0);
    const timer = setTimeout(() => runAnimation(value), 30);
    return () => clearTimeout(timer);
  }, [replay]);

  return <span>{display.toFixed(decimals)}</span>;
}
