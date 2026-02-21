'use client';

import AnimatedNumber from './AnimatedNumber';
import AnimatedCount from './AnimatedCount';
import Sparkline from './Sparkline';
import { useRestaurant } from '@/context/RestaurantContext';
import {
  getOverallRating,
  getReviewCountSparkline,
  getRatingTrendVsLast30d,
  sentimentToScore,
  getSparklineFromTrends,
  computeTrend,
  formatTrendPercent,
} from '@/lib/restaurantData';

export default function MetricsRow() {
  const { data } = useRestaurant();

  const totalReviews = data?.reviewData?.length ?? 0;
  const overallRating = data ? getOverallRating(data.reviewData) : 4.2;
  const ratingTrend = data ? getRatingTrendVsLast30d(data.reviewData) : 0.3;
  const reviewSparkline = data
    ? getReviewCountSparkline(data.reviewData)
    : [980, 1020, 1060, 1100, 1140, 1190, 1247];

  const aspects = data?.aspectSentiments
    ? Object.entries(data.aspectSentiments).map(([name, s]) => ({
        name,
        score: sentimentToScore(s.avg),
        sparkline: getSparklineFromTrends(data.aspectTrends, name),
      }))
    : [];
  const sortedByScore = [...aspects].sort((a, b) => b.score - a.score);
  const topStrength = sortedByScore[0];
  const topWeakness = sortedByScore[sortedByScore.length - 1];
  const strengthTrend = topStrength ? computeTrend(topStrength.sparkline) : 0;
  const weaknessTrend = topWeakness ? computeTrend(topWeakness.sparkline) : -0.4;

  return (
    <div className="grid grid-cols-[280px_1fr_1fr_1fr] gap-16 py-20">


      {/* OVERALL RATING — Hero card */}
      <div className="bg-white rounded-2xl py-22 px-24 border border-neutral-border relative overflow-hidden">
        {/* gradient accent bar */}
        <div
          className="absolute top-0 left-0 right-0 h-3 rounded-t-2xl"
          style={{ background: 'linear-gradient(90deg, #CF5532, #D4915E)' }}
        />

        <span className="text-sm font-semibold uppercase tracking-[0.08em] text-neutral-text-secondary">
          Overall Rating
        </span>

        <div className="flex items-baseline gap-4 mt-6">
          <span className="font-display text-5xl leading-none text-neutral-text">
            <AnimatedNumber value={overallRating} />
          </span>
          <span className="text-[18px] font-medium text-neutral-text-secondary">/ 5.0</span>
        </div>

        {ratingTrend != null && (
          <div className="flex items-center gap-6 mt-8">
            {ratingTrend >= 0 ? (
              <svg width="12" height="12" viewBox="0 0 16 16" fill="#6B8F71"><path d="M8 2l2 5H4z" /></svg>
            ) : (
              <svg width="10" height="10" viewBox="0 0 16 16" fill="#CF5532"><path d="M8 14l-2-5h6z" /></svg>
            )}
            <span className={`text-base font-semibold ${ratingTrend >= 0 ? 'text-sage' : 'text-terracotta'}`}>
              {formatTrendPercent(ratingTrend)}
            </span>
            <span className="text-sm text-neutral-text-secondary">vs last 30d</span>
          </div>
        )}
      </div>


      {/* TOTAL REVIEWS */}
      <div className="bg-white rounded-2xl py-22 px-24 border border-neutral-border relative overflow-hidden">
        {/* warm tan to burnt orange accent bar */}
        <div
          className="absolute top-0 left-0 right-0 h-3 rounded-t-2xl"
          style={{ background: 'linear-gradient(90deg, #C4A87A, #D4915E)' }}
        />
        <span className="text-sm font-semibold uppercase tracking-[0.08em] text-neutral-text-secondary">
          Total Reviews
        </span>

        <div className="font-display text-4xl leading-none mt-6">
          <AnimatedCount value={totalReviews} />
        </div>

        <div className="mt-8">
          <Sparkline data={reviewSparkline} color="#CF5532" />
        </div>
      </div>


      {/* TOP STRENGTH */}
      <div className="bg-white rounded-2xl py-22 px-24 border border-neutral-border relative overflow-hidden">
        {/* sage accent bar */}
        <div className="absolute top-0 left-0 right-0 h-3 rounded-t-2xl bg-sage" />
        <div className="flex items-center gap-6">
          <div className="w-6 h-6 rounded-full bg-sage" />
          <span className="text-sm font-semibold uppercase tracking-[0.08em] text-sage">
            Top Strength
          </span>
        </div>

        <div className="font-bold text-[16px] mt-8">{topStrength?.name ?? 'Food Quality'}</div>

        <div className="flex items-baseline gap-6 mt-2">
          <span className="font-display text-[32px] text-neutral-text">
            <AnimatedNumber value={topStrength?.score ?? 4.6} />
          </span>
          <span className="text-sm text-neutral-text-secondary">
            {formatTrendPercent(strengthTrend)}
          </span>
        </div>
      </div>


      {/* TOP WEAKNESS */}
      <div className="bg-white rounded-2xl py-22 px-24 border border-neutral-border relative overflow-hidden">
        {/* red accent bar */}
        <div className="absolute top-0 left-0 right-0 h-3 rounded-t-2xl bg-red-text" />
        <div className="flex items-center gap-6">
          <div className="w-6 h-6 rounded-full bg-terracotta" />
          <span className="text-sm font-semibold uppercase tracking-[0.08em] text-terracotta">
            Top Weakness
          </span>
        </div>

        <div className="font-bold text-[16px] mt-8">{topWeakness?.name ?? 'Service'}</div>

        <div className="flex items-baseline gap-6 mt-2">
          <span className="font-display text-[32px] text-neutral-text">
            <AnimatedNumber value={topWeakness?.score ?? 2.8} />
          </span>

          <div className="flex items-center gap-3">
            {weaknessTrend < 0 && (
              <>
                <svg width="10" height="10" viewBox="0 0 16 16" fill="#CF5532"><path d="M8 14l-2-5h6z" /></svg>
                <span className="text-sm font-semibold text-terracotta">{formatTrendPercent(weaknessTrend)}</span>
              </>
            )}
            {weaknessTrend >= 0 && (
              <span className="text-sm text-neutral-text-secondary">{formatTrendPercent(weaknessTrend)}</span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
