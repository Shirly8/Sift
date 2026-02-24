'use client';

import { useRef, useEffect, useState } from 'react';


export default function Sparkline({ data = [], color = '#CF5532', height = 32 }) {

  const svgRef = useRef(null);
  const [width, setWidth] = useState(260);


  useEffect(() => {
    if (svgRef.current) setWidth(svgRef.current.clientWidth || 260);
  }, []);


  if (!data.length) return null;

  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data.map((v, i) =>
    `${(i / (data.length - 1)) * width},${height - ((v - min) / range) * (height - 6) - 3}`
  ).join(' ');


  return (
    <svg ref={svgRef} width="100%" height={height} preserveAspectRatio="none">
      <defs>
        <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* fill area */}
      <polygon
        points={`0,${height} ${points} ${width},${height}`}
        fill="url(#sparkGrad)"
        opacity="0"
      >
        <animate attributeName="opacity" from="0" to="1" dur="1s" fill="freeze" begin="0.4s" />
      </polygon>

      {/* line */}
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeDasharray="600"
        strokeDashoffset="600"
      >
        <animate
          attributeName="stroke-dashoffset"
          from="600" to="0"
          dur="1.5s" fill="freeze" begin="0.3s"
          calcMode="spline" keySplines="0.22 1 0.36 1"
        />
      </polyline>
    </svg>
  );
}
