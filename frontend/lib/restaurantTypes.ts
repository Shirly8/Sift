/**
 * Types and interfaces for restaurant data.
 * Kept separate from functions for cleaner organization.
 */


export interface AspectSentiment {
  Positive: number;
  Neutral: number;
  Negative: number;
  total: number;
  avg: number; // 0–2 scale (Negative=0, Neutral=1, Positive=2)
}


export interface AspectTrends {
  [month: string]: Record<string, number>;
}


export interface ReviewRecord {
  restaurant: string;
  review: string;
  rating: number;
  date: string;
  aspects: Record<string, 'Positive' | 'Neutral' | 'Negative'>;
}


export interface RestaurantData {
  restaurantId: string;
  displayName: string;
  reviewData: ReviewRecord[];
  aspectSentiments: Record<string, AspectSentiment>;
  aspectTrends: AspectTrends;
  pairDistribution: Record<string, Record<string, number>>;
}


export type RestaurantId = string;
