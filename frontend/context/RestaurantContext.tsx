'use client';


import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  ReactNode,
} from 'react';

import type { RestaurantData } from '@/lib/restaurantTypes';
import {
  fetchRestaurantIds,
  loadRestaurantData,
  loadImpactAttribution,
  folderToDisplayName,
} from '@/lib/restaurantData';


interface RestaurantContextValue {
  restaurantId: string;
  setRestaurantId: (id: string) => void;
  data: RestaurantData | null;
  impactAttribution: Record<string, number> | null;
  loading: boolean;
  restaurantOptions: { id: string; displayName: string }[];
}


const RestaurantContext = createContext<RestaurantContextValue | null>(null);


export function RestaurantProvider({ children }: { children: ReactNode }) {
  const [restaurantIds, setRestaurantIds] = useState<string[]>([]);
  const [restaurantId, setRestaurantIdState] = useState<string>('');
  const [data, setData] = useState<RestaurantData | null>(null);
  const [impactAttribution, setImpactAttribution] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);


  const setRestaurantId = useCallback((id: string) => {
    setRestaurantIdState(id);
  }, []);


  // Load restaurant folder list from API (reads data folder)
  useEffect(() => {
    fetchRestaurantIds().then((ids) => {
      setRestaurantIds(ids);
      if (ids.length > 0 && !restaurantId) setRestaurantIdState(ids[0]!);
    });
  }, []);


  const restaurantOptions = restaurantIds.map((id) => ({
    id,
    displayName: folderToDisplayName(id),
  }));


  // Load data when restaurant changes
  useEffect(() => {
    if (!restaurantId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    Promise.all([
      loadRestaurantData(restaurantId),
      loadImpactAttribution(),
    ])
      .then(([restaurantData, attribution]) => {
        if (!cancelled) {
          setData(restaurantData);
          setImpactAttribution(attribution);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [restaurantId]);


  return (
    <RestaurantContext.Provider
      value={{
        restaurantId,
        setRestaurantId,
        data,
        impactAttribution,
        loading,
        restaurantOptions,
      }}
    >
      {children}
    </RestaurantContext.Provider>
  );
}


export function useRestaurant() {
  const ctx = useContext(RestaurantContext);
  if (!ctx) throw new Error('useRestaurant must be used within RestaurantProvider');
  return ctx;
}
