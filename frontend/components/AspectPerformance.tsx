'use client';


import { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import DonutChart from './DonutChart';
import Sparkline from './Sparkline';
import { useRestaurant } from '@/context/RestaurantContext';
import {
  sentimentToScore,
  getSparklineFromTrends,
  computeTrend,
  formatTrendPercent,
} from '@/lib/restaurantData';


const ASPECT_COLORS = ['#CF5532', '#D4915E', '#8B7355', '#6B8F71', '#7B8794', '#C4A87A', '#A8B0A0', '#D4735A', '#7B8794'];


const ASPECT_KEYWORDS: Record<string, string[]> = {
  Service: ['service', 'wait times', 'staff', 'waiter', 'waitress', 'reservations'],
  Ambience: ['ambience', 'atmosphere', 'decor', 'noise level', 'lighting', 'seating'],
  Price: ['pricing', 'cost', 'affordability', 'value for money'],
  'Food Quality': ['food quality', 'freshness', 'ingredients', 'presentation'],
  Taste: ['taste', 'flavor', 'seasoning', 'texture'],
  Menu: ['menu variety', 'menu options', 'selection of dishes'],
  Location: ['location', 'accessibility', 'parking'],
  Drinks: ['drinks', 'cocktails', 'wine', 'beer', 'beverages'],
  Desserts: ['desserts', 'tiramisu', 'panna cotta', 'cheesecake', 'gelato'],
};


const SENTIMENT_SCORE: Record<string, number> = { Positive: 2, Neutral: 1, Negative: 0 };

export default function AspectPerformance() {
  const { data } = useRestaurant();
  const [activeAspect, setActiveAspect] = useState<number | null>(null);
  const [expandedKeywords, setExpandedKeywords] = useState<Set<string>>(new Set());
  const [reviewModalAspect, setReviewModalAspect] = useState<string | null>(null);


  const aspects = useMemo(() => {
    if (!data?.aspectSentiments || !data?.aspectTrends) return [];
    return Object.entries(data.aspectSentiments)
      .map(([name, s], i) => ({
        name,
        score: sentimentToScore(s.avg),
        reviews: s.total,
        trend: computeTrend(getSparklineFromTrends(data.aspectTrends, name)),
        sparkline: getSparklineFromTrends(data.aspectTrends, name),
        keywords: ASPECT_KEYWORDS[name] ?? [name.toLowerCase()],
        color: ASPECT_COLORS[i % ASPECT_COLORS.length] ?? '#CF5532',
      }))
      .sort((a, b) => b.reviews - a.reviews);
  }, [data]);


  // Reviews for modal — filtered to those mentioning the selected aspect
  const modalReviews = useMemo(() => {
    if (!reviewModalAspect || !data?.reviewData) return [];
    return data.reviewData.filter((r) => reviewModalAspect in (r.aspects ?? {}));
  }, [reviewModalAspect, data]);

  const toggleKeywords = (name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedKeywords((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  return (
    <>
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-white rounded-2xl border border-neutral-border">

        {/* Header */}
        <div className="flex items-center mb-16 pt-22 px-20 shrink-0">
          <h3 className="font-display text-lg font-normal">
            Aspect Performance
          </h3>
        </div>


        {/* ASPECT CARDS — scrollable */}
        <div className="flex-1 min-h-0 overflow-y-auto px-20 pb-22">
          {aspects.length === 0 && (
            <p className="text-sm text-neutral-text-secondary">No aspect data available.</p>
          )}
          {aspects.map((a, i) => {
            const isExpanded = expandedKeywords.has(a.name);
            const visibleKeywords = isExpanded ? a.keywords : a.keywords.slice(0, 3);

            return (
              <div
                key={a.name}
                className={`py-14 px-16 rounded-xl mb-8 border cursor-pointer transition-all duration-base ease ${
                  activeAspect === i
                    ? 'border-terracotta'
                    : 'border-[#F0EFEB]'
                }`}
                onMouseEnter={() => setActiveAspect(i)}
                onMouseLeave={() => setActiveAspect(null)}
              >

                {/* CARD CONTENT */}
                <div className="flex justify-between items-center">

                  {/* left — name, trend, reviews, keywords */}
                  <div className="flex-1">

                    <div className="flex items-center gap-8 mb-4">
                      <span className="font-bold text-[14px]">{a.name}</span>

                      <span
                        className={`text-xs font-semibold px-6 py-2 rounded-xs ${
                          a.trend > 0
                            ? 'bg-green-bg text-green-text'
                            : a.trend < 0
                              ? 'bg-red-bg text-red-text'
                              : 'bg-neutral-hover text-neutral-text-secondary'
                        }`}
                      >
                        {a.trend > 0 ? '↑' : a.trend < 0 ? '↓' : ''} {formatTrendPercent(a.trend)}
                      </span>
                    </div>

                    <div className="flex items-center gap-8 mb-6">
                      <span className="text-sm text-neutral-text-secondary">{a.reviews} reviews</span>
                      <Sparkline data={a.sparkline} color={a.color} width={48} height={18} />
                    </div>

                    {/* keyword tags — 3 collapsed, all when expanded */}
                    <div className="flex gap-4 flex-wrap items-center">
                      {visibleKeywords.map((k, ki) => (
                        <span
                          key={ki}
                          className="text-xs py-2 px-7 rounded-xs bg-neutral-hover text-neutral-text-muted font-medium"
                        >
                          {k}
                        </span>
                      ))}
                      {a.keywords.length > 3 && (
                        <span
                          className="text-xs font-semibold text-terracotta cursor-pointer hover:underline"
                          onClick={(e) => toggleKeywords(a.name, e)}
                        >
                          {isExpanded ? 'See less' : `+${a.keywords.length - 3} more`}
                        </span>
                      )}
                    </div>
                  </div>


                  {/* right — donut with score below */}
                  <div className="flex flex-col items-center gap-6 ml-12">
                    <DonutChart value={a.score} color={a.color} size={48} stroke={6} replay={activeAspect === i} />
                    <span className="font-display text-3xl text-neutral-text">
                      {a.score}
                    </span>
                  </div>
                </div>


                {/* view full reviews link */}
                <div className="mt-10 pt-10 border-t border-[#F0EFEB]">
                  <span
                    className="text-base font-semibold text-terracotta cursor-pointer hover:underline"
                    onClick={(e) => { e.stopPropagation(); setReviewModalAspect(a.name); }}
                  >
                    View Full Reviews →
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>


      {/* REVIEW DEEP DIVE MODAL */}
      {reviewModalAspect !== null &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed inset-0 z-[200000] flex items-center justify-center"
            style={{ background: 'rgba(0,0,0,0.35)' }}
            onClick={() => setReviewModalAspect(null)}
          >
            <div
              className="bg-white rounded-2xl border border-neutral-border w-[640px] h-[720px] flex flex-col shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >

              {/* Modal header */}
              <div className="flex items-center justify-between px-24 pt-22 pb-16 border-b border-neutral-border shrink-0">
                <div>
                  <h2 className="font-display text-xl font-normal">Review Deep Dive</h2>
                  <p className="text-sm text-neutral-text-secondary mt-2">
                    {modalReviews.length} reviews mentioning this aspect
                  </p>
                </div>

                <div className="flex items-center gap-10">
                  {/* Active filter chip */}
                  <div className="flex items-center gap-6 py-4 px-10 rounded-md bg-terracotta-light border border-terracotta-border">
                    <span className="text-sm font-semibold text-terracotta">{reviewModalAspect}</span>
                    <button
                      onClick={() => setReviewModalAspect(null)}
                      className="text-terracotta opacity-60 hover:opacity-100 transition-opacity"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Close button */}
                  <button
                    onClick={() => setReviewModalAspect(null)}
                    className="w-32 h-32 rounded-lg border border-neutral-border-inactive flex items-center justify-center text-neutral-text-muted hover:border-terracotta transition-[border-color] duration-[200ms]"
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M2 2l12 12M14 2L2 14" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Review list */}
              <div className="flex-1 overflow-y-auto">
                {modalReviews.length === 0 ? (
                  <p className="text-sm text-neutral-text-secondary px-24 py-16">No reviews found.</p>
                ) : (
                  modalReviews.map((r, i) => {
                    const aspectLabel = r.aspects[reviewModalAspect] ?? 'Neutral';
                    const score = SENTIMENT_SCORE[aspectLabel] ?? 1;
                    return (
                      <div key={i} className="px-24 py-14 border-b border-neutral-border last:border-b-0">

                        {/* Stars + date */}
                        <div className="flex justify-between items-center mb-6">
                          <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((s) => (
                              <svg key={s} width="12" height="12" viewBox="0 0 16 16">
                                <path
                                  d="M8 1.5l1.85 3.75L14 5.9l-3 2.92.71 4.13L8 10.88 4.29 12.95 5 8.82 2 5.9l4.15-.65z"
                                  fill={s <= r.rating ? '#CF5532' : '#E0DFDA'}
                                />
                              </svg>
                            ))}
                          </div>
                          <span className="text-sm text-neutral-text-secondary">{r.date}</span>
                        </div>

                        {/* Review text */}
                        <p className="text-md leading-[1.5] text-neutral-text-secondary-dark mb-8">{r.review}</p>

                        {/* Aspect sentiment badge */}
                        <span
                          className={`text-xs font-semibold py-3 px-8 rounded-xs uppercase tracking-[0.03em] ${
                            score >= 2
                              ? 'bg-green-bg text-green-text'
                              : score >= 1
                                ? 'bg-yellow-bg text-yellow-text'
                                : 'bg-red-bg text-red-text'
                          }`}
                        >
                          {reviewModalAspect} · {aspectLabel}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>,
          document.body
        )}
    </>
  );
}
