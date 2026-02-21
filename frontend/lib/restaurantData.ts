/**
 * Restaurant data functions — loads and processes data from public/data/<folder>/
 * Types live in restaurantTypes.ts
 */


import type { AspectTrends, ReviewRecord } from './restaurantTypes';
const RECENT_DATE = new Date('2026-02-19T13:50:00');


// ——— Fetch restaurant list from manifest ———
export async function fetchRestaurantIds(): Promise<string[]> {
  const res = await fetch('/data/restaurants.json');
  if (!res.ok) return [];
  return res.json();
}


// ——— Display helpers ———
export function folderToDisplayName(folder: string): string {
  return folder.replace(/_/g, ' ');
}


// Sentiment avg is 0–2 (weighted avg of Positive=2, Neutral=1, Negative=0).
// We scale linearly to 1–5 stars: 0→1, 1→3, 2→5. No extra averaging.
export function sentimentToScore(avg: number): number {
  return Math.round((1 + (avg / 2) * 4) * 10) / 10;
}


export function sentimentToScoreDisplay(s: 'Positive' | 'Neutral' | 'Negative'): number {
  return s === 'Positive' ? 5 : s === 'Neutral' ? 3 : 1;
}


// ——— Format relative time vs RECENT_DATE (data download date) ———
export function formatRelativeTime(dateStr: string): string {
  const [m, d, y] = dateStr.split('/').map(Number);
  const date = new Date(y!, m! - 1, d!);
  const diffMs = RECENT_DATE.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return '1d ago';
  if (diffDays < 7) return `${diffDays}d ago`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}w ago`;

  return dateStr;
}


// ——— Sparkline from aspect_trends (last N months, 0–2 → 1–5) ———
export function getSparklineFromTrends(
  aspectTrends: AspectTrends,
  aspectName: string,
  months = 7
): number[] {
  const sorted = Object.keys(aspectTrends).sort().reverse();
  const values: number[] = [];

  for (let i = 0; i < months && i < sorted.length; i++) {
    const val = aspectTrends[sorted[i]!]?.[aspectName];
    if (val != null) values.push(sentimentToScore(val));
  }

  const result = values.reverse();
  if (result.length < 2) {
    const v = result[0] ?? 3;
    return Array(months).fill(v);
  }
  return result;
}


// ——— Trend as raw change (for internal calc) ———
export function computeTrend(sparkline: number[]): number {
  if (sparkline.length < 2) return 0;
  return Math.round((sparkline[sparkline.length - 1]! - sparkline[0]!) * 10) / 10;
}


// ——— Trend as percentage for display (e.g. -0.4 → -0.4%) ———
export function formatTrendPercent(trend: number): string {
  if (trend === 0) return '0%';
  const sign = trend > 0 ? '+' : '';
  return `${sign}${trend}%`;
}


// ——— Pearson correlation between two arrays ———
function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n < 2) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    num += (xs[i]! - mx) * (ys[i]! - my);
    dx += (xs[i]! - mx) ** 2;
    dy += (ys[i]! - my) ** 2;
  }
  const denom = Math.sqrt(dx * dy);
  return denom === 0 ? (xs[0] === ys[0] ? 1 : 0) : num / denom;
}

const PAIR_SENTIMENT: Record<string, number> = { Positive: 2, Neutral: 1, Negative: 0 };

// ——— Compute pairwise Pearson correlation between aspect sentiments ———
export function computePairDistribution(
  reviewData: ReviewRecord[]
): Record<string, Record<string, number>> {
  const aspects = Array.from(
    new Set(reviewData.flatMap((r) => Object.keys(r.aspects ?? {})))
  );

  const result: Record<string, Record<string, number>> = {};
  for (const a of aspects) {
    result[a] = {};
    for (const b of aspects) {
      if (a === b) { result[a]![b] = 1; continue; }
      const pairs: [number, number][] = [];
      for (const r of reviewData) {
        if (a in (r.aspects ?? {}) && b in (r.aspects ?? {})) {
          pairs.push([PAIR_SENTIMENT[r.aspects[a]!] ?? 1, PAIR_SENTIMENT[r.aspects[b]!] ?? 1]);
        }
      }
      const corr = pairs.length < 2 ? 0 : pearson(pairs.map((p) => p[0]), pairs.map((p) => p[1]));
      result[a]![b] = Math.max(0, Math.round(corr * 100)) / 100;
    }
  }
  return result;
}


// ——— Load single restaurant data ———
export async function loadRestaurantData(id: string) {
  const base = `/data/${id}`;

  const [reviewData, aspectSentiments, aspectTrends] = await Promise.all([
    fetch(`${base}/review_data.json`).then((r) => r.json()),
    fetch(`${base}/aspect_sentiments.json`).then((r) => r.json()),
    fetch(`${base}/aspect_trends.json`).then((r) => r.json()),
  ]);

  const pairDistribution = computePairDistribution(reviewData);

  return {
    restaurantId: id,
    displayName: folderToDisplayName(id),
    reviewData,
    aspectSentiments,
    aspectTrends,
    pairDistribution,
  };
}


// ——— Load global impact attribution ———
export async function loadImpactAttribution(): Promise<Record<string, number>> {
  const r = await fetch('/data/impact_attribution.json');
  return r.json();
}


// ——— Cumulative review counts by month for sparkline ———
export function getReviewCountSparkline(reviews: ReviewRecord[], months = 7): number[] {
  const byMonth: Record<string, number> = {};

  for (const r of reviews) {
    const parts = r.date.split('/');
    if (parts.length < 2) continue;
    const m = parts[0]?.padStart(2, '0') ?? '01';
    const y = parts[2] ?? new Date().getFullYear().toString();
    const key = `${y}-${m}`;
    byMonth[key] = (byMonth[key] ?? 0) + 1;
  }

  const sorted = Object.keys(byMonth).sort();
  let cumulative = 0;
  const slice = sorted.slice(-months);
  const result = slice.map((k) => {
    cumulative += byMonth[k] ?? 0;
    return cumulative;
  });

  if (result.length === 0) {
    const total = reviews.length;
    return Array.from({ length: months }, (_, i) => Math.round((total * (i + 1)) / months));
  }
  while (result.length < months && result.length > 0) {
    result.push(result[result.length - 1]!);
  }
  return result;
}


// ——— Overall rating from reviews ———
export function getOverallRating(reviews: ReviewRecord[]): number {
  if (!reviews.length) return 0;
  const sum = reviews.reduce((s, r) => s + r.rating, 0);
  return Math.round((sum / reviews.length) * 10) / 10;
}


// ——— Rating trend vs "last 30d" (recent vs older) ———
export function getRatingTrendVsLast30d(reviews: ReviewRecord[]): number | null {
  if (!reviews.length) return null;

  const sorted = [...reviews].sort((a, b) => {
    const [am, ad, ay] = a.date.split('/').map(Number);
    const [bm, bd, by] = b.date.split('/').map(Number);
    return new Date(by!, bm! - 1, bd!).getTime() - new Date(ay!, am! - 1, ad!).getTime();
  });

  const recentCount = Math.max(1, Math.floor(sorted.length * 0.3));
  const recent = sorted.slice(0, recentCount);
  const older = sorted.slice(recentCount);
  if (!older.length) return null;

  const recentAvg = recent.reduce((s, r) => s + r.rating, 0) / recent.length;
  const olderAvg = older.reduce((s, r) => s + r.rating, 0) / older.length;

  return Math.round((recentAvg - olderAvg) * 10) / 10;
}


const MONTH_ABBR: Record<string, string> = {
  '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr', '05': 'May', '06': 'Jun',
  '07': 'Jul', '08': 'Aug', '09': 'Sep', '10': 'Oct', '11': 'Nov', '12': 'Dec',
};

// ——— Aspect trend lines for chart (last 6 months) ———
export function getAspectTrendLines(
  aspectTrends: AspectTrends,
  aspectNames?: string[]
): { name: string; data: number[]; color: string }[] {
  const sorted = Object.keys(aspectTrends).sort().reverse();
  const monthKeys = sorted.slice(0, 6).reverse();
  const aspects = aspectNames ?? (monthKeys.length ? Object.keys(aspectTrends[monthKeys[monthKeys.length - 1]!] ?? {}) : []);
  const colors = ['#CF5532', '#D4915E', '#8B7355', '#6B8F71'];
  return aspects.map((name, i) => ({
    name,
    data: monthKeys.map((k) => {
      const v = aspectTrends[k]?.[name];
      return v != null ? sentimentToScore(v) : 3;
    }),
    color: colors[i % colors.length] ?? '#7B8794',
  }));
}

export function getTrendMonthLabels(aspectTrends: AspectTrends): string[] {
  const sorted = Object.keys(aspectTrends).sort().reverse();
  return sorted.slice(0, 6).reverse().map((k) => {
    const m = k.split('-')[1];
    return MONTH_ABBR[m ?? '01'] ?? m ?? '';
  });
}

// ——— Rating distribution heatmap ———
export function getRatingDistributionHeatmap(
  reviews: ReviewRecord[]
): { aspect: string; stars: number[] }[] {
  const byAspect: Record<string, number[]> = {};

  for (const r of reviews) {
    const aspects = Object.keys(r.aspects || {});
    for (const asp of aspects) {
      if (!byAspect[asp]) byAspect[asp] = [0, 0, 0, 0, 0];
      const idx = Math.min(5, Math.max(1, Math.round(r.rating))) - 1;
      byAspect[asp][idx]++;
    }
  }

  return Object.entries(byAspect)
    .map(([aspect, stars]) => ({ aspect, stars }))
    .filter((r) => r.stars.some((v) => v > 0))
    .sort((a, b) => b.stars.reduce((s, v) => s + v, 0) - a.stars.reduce((s, v) => s + v, 0));
}
