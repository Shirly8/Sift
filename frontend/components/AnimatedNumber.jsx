'use client';

import { useState, useEffect, useRef } from 'react';


export default function AnimatedNumber({ value, duration = 1400, prefix = '', suffix = '' }) {

  const [display, setDisplay] = useState(0);
  const rafRef = useRef(null);


  useEffect(() => {
    const start = performance.now();

    function tick(now) {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      setDisplay(Math.floor(eased * value));

      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);


  return <>{prefix}{display.toLocaleString()}{suffix}</>;
}
