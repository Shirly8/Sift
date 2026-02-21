'use client';

import { RestaurantProvider } from '@/context/RestaurantContext';

export default function Providers({ children }: { children: React.ReactNode }) {
  return <RestaurantProvider>{children}</RestaurantProvider>;
}
