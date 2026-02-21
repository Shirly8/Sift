'use client';


import { useState } from 'react';


interface Aspect {
  name: string;
  score: number;
}


interface ReviewCardProps {
  rating: number;
  text: string;
  aspects: Aspect[];
  time: string;
}


// Render text with <br> as line breaks
function formatReviewText(text: string) {
  const parts = text.split(/<br\s*\/?>/i);
  return parts.flatMap((p, i) => (i < parts.length - 1 ? [p, <br key={i} />] : [p]));
}


export default function ReviewCard({ rating, text, aspects, time }: ReviewCardProps) {
  const [hovered, setHovered] = useState(false);


  return (
    <div
      className={`py-14 px-16 border-b border-neutral-border cursor-pointer transition-[background] duration-[200ms] ${
        hovered ? 'bg-neutral-background' : 'bg-transparent'
      }`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >

      {/* TOP ROW — Stars + Timestamp */}
      <div className="flex justify-between items-center mb-6">

        {/* stars */}
        <div className="flex gap-2">
          {[1, 2, 3, 4, 5].map((i) => (
            <svg key={i} width="13" height="13" viewBox="0 0 16 16">
              <path
                d="M8 1.5l1.85 3.75L14 5.9l-3 2.92.71 4.13L8 10.88 4.29 12.95 5 8.82 2 5.9l4.15-.65z"
                fill={i <= rating ? '#CF5532' : '#E0DFDA'}
              />
            </svg>
          ))}
        </div>

        {/* timestamp */}
        <span className="text-sm text-neutral-text-secondary">{time}</span>
      </div>


      {/* review text — <br> renders as line break */}
      <p className="text-md leading-[1.5] text-neutral-text-secondary-dark mb-8">
        {formatReviewText(text)}
      </p>


      {/* ASPECT TAGS */}
      <div className="flex gap-5 flex-wrap">
        {aspects.map((a, i) => (
          <span
            key={i}
            className={`text-xs font-semibold py-3 px-8 rounded-xs uppercase tracking-[0.03em] ${
              a.score >= 4
                ? 'bg-green-bg text-green-text'
                : a.score >= 3
                  ? 'bg-yellow-bg text-yellow-text'
                  : 'bg-red-bg text-red-text'
            }`}
          >
            {a.name} {a.score}
          </span>
        ))}
      </div>
    </div>
  );
}
