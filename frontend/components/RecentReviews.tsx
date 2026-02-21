'use client';


import { useState, useMemo } from 'react';
import ReviewCard from './ReviewCard';
import { useRestaurant } from '@/context/RestaurantContext';
import { sentimentToScoreDisplay, formatRelativeTime } from '@/lib/restaurantData';


export default function RecentReviews() {
  const { data } = useRestaurant();
  const [aspectFilter, setAspectFilter] = useState('All Aspects');
  const [ratingFilter, setRatingFilter] = useState('All Ratings');
  const [searchQuery, setSearchQuery] = useState('');


  const allReviews = useMemo(() => {
    if (!data?.reviewData) return [];
    return data.reviewData
      .slice()
      .sort((a, b) => {
        const [am, ad, ay] = a.date.split('/').map(Number);
        const [bm, bd, by] = b.date.split('/').map(Number);
        const da = new Date(ay!, am! - 1, ad!).getTime();
        const db = new Date(by!, bm! - 1, bd!).getTime();
        return db - da;
      })
      .map((r) => ({
        rating: r.rating,
        text: r.review,
        time: formatRelativeTime(r.date),
        aspects: Object.entries(r.aspects || {}).map(([name, sentiment]) => ({
          name,
          score: sentimentToScoreDisplay(sentiment),
        })),
      }));
  }, [data]);


  const aspectOptions = useMemo(() => {
    const set = new Set<string>();
    allReviews.forEach((r) => r.aspects.forEach((a) => set.add(a.name)));
    return ['All Aspects', ...Array.from(set).sort()];
  }, [allReviews]);


  const ratingOptions = ['All Ratings', '5 stars', '4 stars', '3 stars', '2 stars', '1 star'];


  const reviews = useMemo(() => {
    return allReviews
      .filter((r) => {
        if (aspectFilter !== 'All Aspects' && !r.aspects.some((a) => a.name === aspectFilter)) return false;
        if (ratingFilter !== 'All Ratings') {
          const stars = parseInt(ratingFilter, 10);
          if (Math.round(r.rating) !== stars) return false;
        }
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          if (!r.text.toLowerCase().includes(q)) return false;
        }
        return true;
      })
      .slice(0, 20);
  }, [allReviews, aspectFilter, ratingFilter, searchQuery]);


  return (
    <div className="flex flex-col h-[1110px] overflow-hidden bg-white rounded-2xl border border-neutral-border">

      {/* HEADER row with filters beside */}
      <div className="pt-22 px-24 pb-12 shrink-0">
        <div className="flex items-center justify-between mb-16">
          <h3 className="font-display text-xl font-normal">
            Review Deep Dive
          </h3>
          <div className="flex gap-12 flex-wrap">
            <select
              value={aspectFilter}
              onChange={(e) => setAspectFilter(e.target.value)}
              className="text-sm font-semibold py-6 px-12 rounded-lg border border-neutral-border-inactive bg-white cursor-pointer appearance-none pr-32 outline-none focus:border-terracotta"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='8' height='5' viewBox='0 0 8 5' fill='%23999' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l3 3 3-3'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 10px center',
              }}
            >
              {aspectOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>

            <select
              value={ratingFilter}
              onChange={(e) => setRatingFilter(e.target.value)}
              className="text-sm font-semibold py-6 px-12 rounded-lg border border-neutral-border-inactive bg-white cursor-pointer appearance-none pr-32 outline-none focus:border-terracotta"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='8' height='5' viewBox='0 0 8 5' fill='%23999' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l3 3 3-3'/%3E%3C/svg%3E")`,
                backgroundRepeat: 'no-repeat',
                backgroundPosition: 'right 10px center',
              }}
            >
              {ratingOptions.map((opt) => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>

            <input
              type="text"
              placeholder="Search reviews..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 min-w-[180px] text-sm py-6 px-12 rounded-lg border border-neutral-border-inactive bg-white outline-none focus:border-terracotta placeholder:text-neutral-text-muted"
            />
          </div>
        </div>
      </div>


      {/* SCROLLABLE REVIEW LIST */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {reviews.length === 0 && (
          <p className="py-14 px-24 text-sm text-neutral-text-secondary">No reviews match your filters.</p>
        )}
        {reviews.map((r, i) => (
          <ReviewCard key={i} {...r} />
        ))}
      </div>
    </div>
  );
}
