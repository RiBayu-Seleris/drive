import { useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ExternalLink, LocateFixed, QrCode, X } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/feedback/StateViews';
import { MapView, type MapMarker, type MapPoint } from '@/components/map/MapView';
import { DEFAULT_LOCATION } from '@/config/constants';
import { ROUTES } from '@/app/routes';
import { cn } from '@/lib/utils/cn';
import { useLiveLocation } from '@/lib/geo/useLiveLocation';
import { getDrivingRoute } from '@/lib/geo/osrm';
import type { GeoPoint } from '@/lib/geo/distance';
import { getRecommendations, type RecommendationPlace, type WorkshopVisitRequest } from '../api';

/** Koordinat dianggap valid bila bukan (0,0) dan berhingga. */
function hasCoord(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);
}

/**
 * Kunci cache rute dibulatkan ke ±100 m. Tanpa ini setiap langkah kaki memicu
 * permintaan baru ke server routing — boros dan tidak mengubah rutenya.
 */
function routeKeyOf(point: GeoPoint | null): string {
  return point ? `${point.lat.toFixed(3)},${point.lng.toFixed(3)}` : '';
}

export function WorkshopRoutePage() {
  const navigate = useNavigate();
  const routeState = useLocation().state as
    | RecommendationPlace
    | { place?: RecommendationPlace; visit?: WorkshopVisitRequest }
    | null;
  const statePlace =
    routeState && 'place' in routeState
      ? (routeState.place ?? null)
      : (routeState as RecommendationPlace | null);
  /*
   * Kode kunjungan dari "Antar Mandiri".
   *
   * Sebelumnya objek ini dititipkan ke halaman ini lalu diabaikan — kodenya
   * tidak pernah muncul di layar mana pun, jadi tidak ada yang bisa ditunjukkan
   * ke bengkel saat tiba. Halaman inilah tempatnya: user membuka rute sambil
   * berkendara, dan begitu sampai, kode ini yang dipindai bengkel.
   */
  const visit = routeState && 'visit' in routeState ? (routeState.visit ?? null) : null;
  const workshopId = Number(useParams().id) || 0;
  const live = useLiveLocation();
  const userPoint = live.point;
  // Ikuti posisi seperti gmaps, tapi berhenti mengikuti begitu pengguna
  // menggeser peta sendiri — kalau tidak, petanya melawan tangan pengguna.
  const [following, setFollowing] = useState(true);

  // URL rute sudah membawa id bengkel, tapi datanya selama ini hanya dititipkan
  // lewat router state. Begitu halaman dibuka langsung (tab baru, tautan
  // dibagikan, riwayat yang kehilangan state) rutenya mati padahal id-nya ada.
  // Ambil ulang dari rekomendasi berdasarkan id tersebut.
  const coords = userPoint
    ? { latitude: userPoint.lat, longitude: userPoint.lng }
    : DEFAULT_LOCATION;
  const fallbackQuery = useQuery({
    queryKey: ['recommendations', 'workshop', coords],
    queryFn: () => getRecommendations('workshop', coords),
    enabled: !statePlace && workshopId > 0,
  });
  const place =
    statePlace ?? fallbackQuery.data?.find((candidate) => candidate.id === workshopId) ?? null;

  const workshop: MapPoint | null =
    place && hasCoord(place.latitude, place.longitude)
      ? { lat: place.latitude, lng: place.longitude }
      : null;

  // Rute yang mengikuti jalan. Kuncinya memakai koordinat yang dibulatkan, jadi
  // rute dihitung ulang hanya saat pengguna benar-benar berpindah ~100 m.
  const routeQuery = useQuery({
    queryKey: ['driving-route', routeKeyOf(userPoint), routeKeyOf(workshop)],
    queryFn: ({ signal }) =>
      userPoint && workshop ? getDrivingRoute(userPoint, workshop, signal) : null,
    enabled: Boolean(userPoint && workshop),
    staleTime: 60_000,
  });
  const route = routeQuery.data ?? null;

  if (!place && fallbackQuery.isLoading) {
    return (
      <PageContainer>
        <AppHeader title="Rute Bengkel" />
        <LoadingState label="Memuat rute…" />
      </PageContainer>
    );
  }

  if (!place) {
    return (
      <PageContainer>
        <AppHeader title="Rute Bengkel" />
        <EmptyState
          title="Rute tidak tersedia"
          description="Pilih bengkel terlebih dahulu."
          action={
            <Button fullWidth={false} onClick={() => navigate(ROUTES.workshopList)}>
              Lihat Daftar Bengkel
            </Button>
          }
        />
      </PageContainer>
    );
  }

  const markers: MapMarker[] = [];
  if (workshop) markers.push({ ...workshop, label: place.name, variant: 'destination' });
  if (userPoint) markers.push({ ...userPoint, label: 'Lokasi Anda', variant: 'origin' });

  // Garis rute sungguhan bila server routing menjawab; kalau tidak, garis lurus
  // supaya peta tetap memberi arah kasar alih-alih kosong.
  const routeLine = route?.path ?? (userPoint && workshop ? [userPoint, workshop] : undefined);
  const isStraightLine = !route && Boolean(userPoint && workshop);

  // Angka dari rute jalan lebih dipercaya daripada estimasi rekomendasi, yang
  // dihitung dari jarak garis lurus.
  const minutes = route ? route.durationMinutes : place.estimatedMinutes;
  const km = route ? route.distanceKm : place.distanceKm;

  const mapsUrl =
    place.gmapsUrl ||
    (workshop
      ? `https://www.google.com/maps/dir/?api=1&destination=${place.latitude},${place.longitude}`
      : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}`);

  return (
    <PageContainer className="bg-neutral-200">
      <AppHeader showLogo />

      {/* Peta dominan. `min-h` wajib: tinggi persentase (`h-full`) di dalam
          flex-1 tidak selalu bisa dihitung browser, dan peta jadi 0px. */}
      <div className="relative min-h-[45dvh] flex-1">
        {workshop ? (
          <>
            <MapView
              center={workshop}
              markers={markers}
              polyline={routeLine}
              fitToMarkers={markers.length > 1}
              follow={following ? userPoint : null}
              accuracyMeters={live.accuracyMeters}
              onUserDrag={() => setFollowing(false)}
              className="absolute inset-0 h-full w-full rounded-none"
            />

            <button
              type="button"
              onClick={() => setFollowing(true)}
              disabled={!userPoint || following}
              aria-label="Ikuti posisi saya"
              className={cn(
                'absolute right-4 bottom-4 z-1001 grid size-11 place-items-center rounded-full shadow-md transition',
                following
                  ? 'bg-deep-blue-500 text-[#10200a]'
                  : 'text-deep-blue-600 bg-neutral-100 hover:bg-neutral-200',
                !userPoint && 'opacity-50',
              )}
            >
              <LocateFixed className="size-5" />
            </button>
          </>
        ) : (
          <div className="bg-deep-blue-50 flex h-full items-center justify-center">
            <p className="text-12 px-6 text-center text-neutral-600">
              Koordinat bengkel belum tersedia. Gunakan tautan di bawah untuk membuka peta.
            </p>
          </div>
        )}
      </div>

      {/* Kartu rute + Berhenti */}
      <div className="pb-safe border-t border-neutral-300 bg-neutral-100 px-5 pt-4">
        {visit && (
          <div className="drive-card mb-4 flex items-center gap-3 p-4">
            <span className="drive-chip grid size-11 shrink-0 place-items-center rounded-xl">
              <QrCode className="text-deep-blue-500 size-5" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <span className="drive-eyebrow">Tunjukkan saat tiba</span>
              <p className="hud-readout text-deep-blue-500 mt-1 text-[15px] font-bold">
                {visit.visitCode}
              </p>
              <p className="text-11 mt-0.5 text-neutral-600">
                Bengkel memindai kode ini untuk mencatat kendaraan Anda sudah sampai.
              </p>
            </div>
          </div>
        )}
        <p className="text-16 text-center font-semibold text-neutral-900">
          {minutes > 0 ? `${Math.max(1, Math.round(minutes))} Menit` : 'Rute'}
          {km > 0 && ` · ${km.toFixed(1)} km`}
        </p>
        <p className="text-12 mt-0.5 text-center text-neutral-600">Menuju {place.name}</p>
        {(live.error || isStraightLine) && (
          <p className="text-11 mt-1 text-center text-neutral-600">
            {live.error || 'Rute jalan tidak tersedia — garis lurus ditampilkan sebagai perkiraan.'}
          </p>
        )}

        <a
          href={mapsUrl}
          target="_blank"
          rel="noreferrer"
          className="text-deep-blue-600 text-12 mt-3 inline-flex w-full items-center justify-center gap-1.5 font-medium"
        >
          <ExternalLink className="size-4" /> Buka navigasi di peta
        </a>

        <Button
          variant="danger"
          className="mt-3"
          leftIcon={<X className="size-5" />}
          onClick={() => navigate(-1)}
        >
          Berhenti
        </Button>
      </div>
    </PageContainer>
  );
}
