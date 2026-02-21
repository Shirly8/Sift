'use client';

import { useState, useEffect, useRef } from 'react';

interface AnimatedCountProps {
  value: number;
  duration?: number;
  replay?: boolean;
}

// Animate integer from 0 → target with comma formatting
// When `replay` toggles to true, resets and re-animates
export default function AnimatedCount({ value, duration = 1700, replay }: AnimatedCountProps) {
  const [display, setDisplay] = useState(0);
  const rafRef = useRef<number | null>(null);

  const runAnimation = (end: number) => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    const startTime = performance.now();

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.floor(end * eased));
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

  return <span>{display.toLocaleString()}</span>;
}
