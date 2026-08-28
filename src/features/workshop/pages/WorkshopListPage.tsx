import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { AlertTriangle, Search, ShieldCheck, Star, Wrench } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { AppHeader } from '@/components/layout/AppHeader';
import { LoadingState } from '@/components/ui/Spinner';
import { ErrorState, EmptyState } from '@/components/feedback/StateViews';
import { DEFAULT_LOCATION } from '@/config/constants';
import { buildPath } from '@/app/routes';
import { cn } from '@/lib/utils/cn';
import { confirm } from '@/components/feedback/confirm';
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

  /**
   * Saat datang dari klaim, daftar dipecah dua bertajuk — bukan sekadar diberi
   * chip kecil. Salah pilih di sini selisihnya jutaan rupiah, jadi batas antara
   * "ditanggung" dan "bayar sendiri" harus terlihat sebelum user menggulir,
   * bukan setelah dia membaca detail kartu.
   */
  const [partnerPlaces, otherPlaces] = useMemo(() => {
    if (!claimNumber) return [filteredData, [] as RecommendationPlace[]];
    return [
      filteredData.filter((place) => place.isInsurerPartner),
      filteredData.filter((place) => !place.isInsurerPartner),
    ];
  }, [filteredData, claimNumber]);

  /** Memilih bengkel di luar rekanan wajib melewati konfirmasi biaya. */
  const handleSelect = async (place: RecommendationPlace) => {
    if (claimNumber && !place.isInsurerPartner) {
      const lanjut = await confirm({
        title: 'Biaya jadi tanggungan Anda',
        message:
          `${place.name} bukan rekanan asuransi Anda. Klaim tidak berlaku di bengkel ini, ` +
          'sehingga seluruh biaya perbaikan Anda bayar sendiri. Lanjutkan ke bengkel ini?',
        confirmText: 'Ya, saya bayar sendiri',
        cancelText: 'Pilih bengkel rekanan',
        tone: 'danger',
      });
      if (!lanjut) return;
    }
    navigate(buildPath.workshopDetail(String(place.id)), {
      state: { place, claimNumber },
    });
  };

  return (
    <PageContainer>
      <AppHeader showLogo />
      <div className="min-h-screen bg-neutral-200 p-6">
        <div className="mx-auto mb-8 max-w-2xl text-center">
          <h1 className="mb-4 text-[20px] leading-tight font-bold text-neutral-900">
            Rekomendasi Bengkel untuk Kendaraan Anda
          </h1>
          <p className="text-[14px] leading-relaxed text-neutral-600">
            {claimNumber
              ? 'Biaya perbaikan hanya ditanggung di bengkel rekanan asuransi Anda. Bengkel lain tetap bisa dipilih, tapi biayanya Anda bayar sendiri.'
              : 'Berikut adalah rekomendasi bengkel terdekat dan terpercaya untuk memperbaiki kerusakan mobil Anda.'}
          </p>
        </div>

        <div className="mx-auto mb-6 flex max-w-2xl items-center gap-2">
          <div className="relative flex-1">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
              <Search className="size-4 text-neutral-500" />
            </div>
            <input
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              type="text"
              placeholder="Search"
              className="h-10 w-full rounded-lg border border-neutral-300 pr-3 pl-9 text-sm focus:border-transparent focus:ring-2 focus:ring-deep-blue-500 focus:outline-none"
            />
          </div>
          <button
            type="button"
            className="flex size-10 shrink-0 items-center justify-center rounded-lg border border-neutral-300 transition-colors hover:bg-neutral-200"
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
            {claimNumber && partnerPlaces.length > 0 && (
              <div className="flex items-center gap-2 rounded-lg bg-success/15 px-3 py-2">
                <ShieldCheck className="size-4 shrink-0 text-success" />
                <p className="text-[12px] font-semibold text-success">
                  Rekanan asuransi Anda — biaya ditanggung klaim
                </p>
              </div>
            )}
            {partnerPlaces.map((place) => (
              <WorkshopCard key={place.id} place={place} onClick={() => void handleSelect(place)} />
            ))}

            {claimNumber && otherPlaces.length > 0 && (
              <div className="mt-2 rounded-lg border border-warning bg-warning/15 px-3 py-2.5">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="size-4 shrink-0 text-warning" />
                  <p className="text-[12px] font-bold text-warning">
                    Di luar rekanan — Anda bayar sendiri
                  </p>
                </div>
                <p className="mt-1 text-[11px] leading-4 text-warning">
                  Klaim asuransi tidak berlaku di bengkel-bengkel berikut.
                </p>
              </div>
            )}
            {otherPlaces.map((place) => (
              <div key={place.id} className="rounded-xl border-l-4 border-warning pl-1">
                <WorkshopCard place={place} onClick={() => void handleSelect(place)} />
              </div>
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
      className="drive-card w-full cursor-pointer overflow-hidden rounded-xl text-left transition-shadow hover:shadow-md"
    >
      <div className="flex flex-row gap-x-3 p-3">
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
        <div className="flex min-w-0 flex-1 flex-col justify-between gap-y-2">
          <div className="mb-2 flex flex-row justify-between">
            <div>
              <h3 className="hover:text-deep-blue-700 cursor-pointer text-[12px] font-semibold text-[#c2f347]">
                {place.name}
              </h3>
              {place.isInsurerPartner && (
                <span className="mt-1 inline-flex rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
                  Rekanan Asuransi
                </span>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <span
                className={cn(
                  'rounded text-[12px] font-medium',
                  isOpen ? 'text-success' : 'text-danger',
                )}
              >
                {isOpen ? 'Buka' : 'Tutup'}
              </span>
              <span className="text-[10px] text-neutral-600">{closeText}</span>
            </div>
          </div>
          <p className="mb-3 line-clamp-2 text-[13px] text-neutral-600">{place.address}</p>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4 text-[10px] text-neutral-600">
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
                      index < Math.floor(place.rating) ? 'text-warning' : 'text-neutral-300',
                    )}
                    fill="currentColor"
                  />
                ))}
              </div>
              <span className="text-[12px] font-medium text-neutral-700">
                {place.rating.toFixed(1)}
              </span>
            </div>
          </div>
        </div>
      </div>
    </button>
  );
}
