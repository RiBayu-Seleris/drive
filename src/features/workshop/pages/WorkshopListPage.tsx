import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Search, Star, Wrench } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { AppHeader } from '@/components/layout/AppHeader';
import { LoadingState } from '@/components/ui/Spinner';
import { ErrorState, EmptyState } from '@/components/feedback/StateViews';
import { DEFAULT_LOCATION } from '@/config/constants';
import { buildPath } from '@/app/routes';
import { cn } from '@/lib/utils/cn';
import { getRecommendations, type RecommendationPlace } from '../api';

export function WorkshopListPage() {
  const navigate = useNavigate();
  const claimNumber = (useLocation().state as { claimNumber?: string } | null)?.claimNumber ?? '';
  const [coords, setCoords] = useState<{ latitude: number; longitude: number }>(DEFAULT_LOCATION);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => undefined,
      { timeout: 8000 },
    );
  }, []);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['recommendations', 'workshop', coords, claimNumber],
    queryFn: () => getRecommendations('workshop', coords, claimNumber),
  });

  const filteredData = useMemo(() => {
    if (!data) return [];
    const query = searchQuery.trim().toLowerCase();
    if (!query) return data;
    return data.filter(
      (place) =>
        place.name.toLowerCase().includes(query) || place.address.toLowerCase().includes(query),
    );
  }, [data, searchQuery]);

  return (
    <PageContainer>
      <AppHeader showLogo />
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <h1 className="mb-4 text-[20px] leading-tight font-bold text-gray-900">
            Rekomendasi Bengkel untuk Kendaraan Anda
          </h1>
          <p className="text-[14px] leading-relaxed text-gray-600">
            {/* {claimNumber
              ? 'Bengkel rekanan asuransi ditampilkan lebih dahulu, kemudian diurutkan berdasarkan jarak dan rating.'
              : 'Pilih bengkel terdekat dan terpercaya untuk memperbaiki kerusakan mobil Anda'} */}
            Berikut adalah rekomendasi bengkel terdekat dan terpercaya untuk memperbaiki kerusakan
            mobil Anda.
          </p>
        </div>

        <div className="mx-auto mb-6 flex max-w-2xl items-center gap-2">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="size-4 text-gray-400" />
            </div>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              type="text"
              placeholder="Search"
              className="h-10 w-full rounded-lg border border-gray-300 pr-3 pl-9 text-sm focus:border-transparent focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>
          <button
            type="button"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-gray-300 transition-colors hover:bg-gray-50"
          >
            <img className="size-4" src="/assets/rekomendasi_bengkel/document-filter.png" alt="" />
          </button>
        </div>

        {isLoading ? (
          <LoadingState label="Mencari bengkel terdekat…" />
        ) : isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : filteredData.length === 0 ? (
          <EmptyState
            icon={<Wrench className="size-7" />}
            title="Belum ada bengkel"
            description="Tidak ada bengkel rekanan di sekitar lokasi Anda."
          />
        ) : (
          <div className="mx-auto flex h-auto w-full max-w-2xl flex-col gap-y-5">
            {filteredData.map((place) => (
              <WorkshopCard
                key={place.id}
                place={place}
                onClick={() =>
                  navigate(buildPath.workshopDetail(String(place.id)), {
                    state: { place, claimNumber },
                  })
                }
              />
            ))}
          </div>
        )}
      </div>
    </PageContainer>
  );
}

function WorkshopCard({ place, onClick }: { place: RecommendationPlace; onClick: () => void }) {
  const isOpen = place.openStatus.toUpperCase() !== 'CLOSED';
  const closeText = isOpen ? 'Tutup 17.00' : 'Buka 07.00';

  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full cursor-pointer overflow-hidden rounded-xl bg-white text-left shadow-sm transition-shadow hover:shadow-md"
    >
      <div className="flex flex-row gap-x-2">
        <div className="h-auto w-[30%] shrink-0">
          {place.imageUrl ? (
            <img
              src={place.imageUrl}
              alt={place.name}
              className="size-28 rounded-lg object-cover"
            />
          ) : (
            <div className="bg-deep-blue-50 text-deep-blue-300 flex size-28 items-center justify-center rounded-lg">
              <Wrench className="size-8" />
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-y-2 py-3 pr-5">
          <div className="mb-2 flex flex-row justify-between">
            <div>
              <h3 className="hover:text-deep-blue-700 cursor-pointer text-[12px] font-semibold text-[#4B61A1]">
                {place.name}
              </h3>
              {place.isInsurerPartner && (
                <span className="mt-1 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                  Rekanan Asuransi
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span
                className={cn(
                  'rounded text-[12px] font-medium',
                  isOpen ? 'text-green-600' : 'text-red-600',
                )}
              >
                {isOpen ? 'Buka' : 'Tutup'}
              </span>
              <span className="text-[10px] text-gray-600">{closeText}</span>
            </div>
          </div>
          <p className="mb-3 line-clamp-2 text-[13px] text-gray-600">{place.address}</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-[10px] text-gray-600">
              <span>{Math.max(1, Math.round(place.estimatedMinutes || 15))} min</span>
              <span>•</span>
              <span>{Math.max(0.1, place.distanceKm || 0).toFixed(1)} km</span>
            </div>
            <div className="flex items-center gap-x-1">
              <div className="flex flex-row items-center gap-x-0.5">
                {Array.from({ length: 5 }).map((_, index) => (
                  <Star
                    key={index}
                    className={cn(
                      'size-3',
                      index < Math.floor(place.rating) ? 'text-yellow-400' : 'text-gray-300',
                    )}
                    fill="currentColor"
                  />
                ))}
              </div>
              <span className="text-[12px] font-medium text-gray-700">
                {place.rating.toFixed(1)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
