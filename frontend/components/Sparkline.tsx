'use client';

interface SparklineProps {
  data: number[];
  color: string;
  width?: number;
  height?: number;
}

// Mini SVG line chart — normalizes data to fit width × height
export default function Sparkline({ data, color, width = 64, height = 24 }: SparklineProps) {
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;

  const points = data
    .map((v, i) => {
      const x = (i / (data.length - 1)) * width;
      const y = height - ((v - min) / range) * (height - 4) - 2;
      return `${x},${y}`;
    })
    .join(' ');

  return (
    <svg width={width} height={height} className="block">
      <polyline
        points={points} fill="none"
        stroke={color} strokeWidth="1.5"
        strokeLinecap="round" strokeLinejoin="round"
      />
    </svg>
  );
}
