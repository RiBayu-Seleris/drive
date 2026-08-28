import { useEffect } from 'react';
import { RouterProvider } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '@/lib/api/queryClient';
import { Toaster } from '@/components/feedback/Toaster';
import { ConfirmRoot } from '@/components/feedback/ConfirmRoot';
import { router } from './router';
import { prefetchLikelyRoutes } from './prefetch';

// Add comment for push

export function App() {
  // Pra-muat rute yang paling mungkin dibuka berikutnya saat browser idle.
  useEffect(() => {
    prefetchLikelyRoutes();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      {/* Overlay global (portal ke body) */}
      <Toaster />
      <ConfirmRoot />
    </QueryClientProvider>
  );
}
