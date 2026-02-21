'use client';

import { useState, useEffect } from 'react';
import Header from './Header';
import MetricsRow from './MetricsRow';
import RatingDrivers from './RatingDrivers';
import RatingHeatmap from './RatingHeatmap';
import RecentReviews from './RecentReviews';
import AspectPerformance from './AspectPerformance';
import DistributionHeatmap from './DistributionHeatmap';
import Footer from './Footer';
import AspectTrends from './AspectTrends';


export default function Dashboard() {
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLoaded(true);
  }, []);

  // staggered fade-in — opacity + translateY with spring easing
  const fadeIn = (delay: number): React.CSSProperties => ({
    opacity: loaded ? 1 : 0,
    transform: loaded ? 'translateY(0)' : 'translateY(12px)',
    transition: `opacity 0.6s cubic-bezier(0.22, 1, 0.36, 1) ${delay}s, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1) ${delay}s`,
  });

  return (
    <div className="font-sans bg-neutral-background min-h-screen text-neutral-text relative overflow-hidden">
      
      
      {/* subtle noise texture overlay */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E")`,
          backgroundSize: '200px 200px',
        }}
      />
      {/* MAIN CONTENT — centred, max-width, generous horizontal padding */}
      <div className="relative z-[1] max-w-[1320px] mx-auto px-28">
        {/* Header */}
        <div style={fadeIn(0)}>
          <Header />
        </div>



        {/* ===== METRICS ROW ===== */}
        <div style={fadeIn(0.1)}>
          <MetricsRow />
        </div>

        
        {/* ===== MAIN CONTENT GRID ===== */}
        <div
          className="grid grid-cols-[1fr_0.33fr] gap-16"
          style={fadeIn(0.2)}
        >
          {/* LEFT COLUMN */}
          <div className="flex flex-col gap-16">
            {/* What Drives Your Rating */}
            <RatingDrivers />
            {/* BOTTOM ROW — Heatmap + Reviews side by side */}
            <div className="grid grid-cols-2 gap-16">
              <RatingHeatmap />
              <DistributionHeatmap />
            </div>

            <RecentReviews />
          </div>
          {/* RIGHT COLUMN — Aspect Performance + Aspect Trends */}
          <div className="flex flex-col gap-16">
            <AspectPerformance />
            <AspectTrends />

          </div>
        </div>



        {/* ===== FOOTER ===== */}
        <div style={fadeIn(0.4)}>
          <Footer />
        </div>
      </div>
    </div>
  );
}
