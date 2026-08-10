import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Clock, Info, Navigation, Phone, QrCode, Star, Truck, Wrench } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { AppHeader } from '@/components/layout/AppHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/Spinner';
import { EmptyState, ErrorState } from '@/components/feedback/StateViews';
import { MapView } from '@/components/map/MapView';
import { DEFAULT_LOCATION } from '@/config/constants';
import { buildPath, ROUTES } from '@/app/routes';
import { getRecommendations, type RecommendationPlace } from '@/features/workshop/api';
import { getTowingOrders } from '@/features/towing/api/towingApi';
import { isTowingActive, isTowingSearching, type TowingOrder } from '@/features/towing/types';
import { getClaimRepairJob, isClaimTicketUsed, type Claim, type ClaimRepairJob } from '../api';
import { useClaimDraftStore } from '../store/claimDraftStore';
import { ClaimTicket, type ClaimTicketState } from '../components/ClaimTicket';

/** Nominal yang ditanggung asuransi; pekerjaan bengkel mengunci angka final. */
function approvedAmountOf(claim: Claim, job: ClaimRepairJob | null): number {
  if (job) return job.insuranceCoverage;
  return Math.max(0, (claim.estimatedRepairCost ?? 0) - claim.settlementPass.customerPayable);
}

function ticketStateOf(job: ClaimRepairJob | null, used: boolean): ClaimTicketState {
  if (used) return 'expired';
  return job ? 'processing' : 'unregistered';
}

function scanHintOf(used: boolean): string {
  return used
    ? 'Kode ini sudah tidak dapat digunakan karena telah diklaim sebelumnya.'
    : 'Silakan pindai kode ini di bengkel yang sudah Anda pilih.';
}

export function ClaimTicketPage() {
  const navigate = useNavigate();
  const locationClaim = useLocation().state as Claim | null;
  const submittedClaim = useClaimDraftStore((state) => state.submittedClaim);
  const claim = locationClaim ?? submittedClaim;
  // Di-trim: nomor klaim ikut jadi segmen URL saat mendaftarkan bengkel, dan
  // nomor berisi spasi saja ditolak backend dengan "claim_number wajib diisi".
  const claimNumber = (claim?.claimNumber ?? '').trim();
  const isApproved = claim?.status === 'APPROVED' || claim?.status === 'COMPLETED';

  const [coords, setCoords] = useState<{ latitude: number; longitude: number }>(DEFAULT_LOCATION);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => undefined,
      { timeout: 8000 },
    );
  }, []);

  const jobQuery = useQuery({
    queryKey: ['claim-repair-job', claimNumber],
    queryFn: () => getClaimRepairJob(claimNumber),
    enabled: Boolean(claimNumber) && isApproved,
  });

  const job = jobQuery.data ?? null;
  const stationId = job?.repairStationId ?? 0;

  // Detail bengkel (rating/jam buka/telepon) hanya ada di endpoint rekomendasi;
  // pekerjaan perbaikan cuma menyimpan id & namanya.
  const placeQuery = useQuery({
    queryKey: ['recommendations', 'workshop', coords, claimNumber],
    queryFn: () => getRecommendations('workshop', coords, claimNumber),
    enabled: stationId > 0,
  });
  const workshop = placeQuery.data?.find((place) => place.id === stationId) ?? null;

  // Derek terpisah dari hasil klaim: tawarannya tetap ada setelah klaim
  // disetujui. Kalau order-nya sudah berjalan, tombolnya berubah jadi pantauan
  // status supaya user tidak memesan dua kali.
  const towingQuery = useQuery({
    queryKey: ['towing-orders'],
    queryFn: getTowingOrders,
    enabled: Boolean(claimNumber) && isApproved,
  });
  const towingOrder =
    towingQuery.data?.find(
      (order) =>
        order.claimNumber === claimNumber &&
        (isTowingSearching(order.status) || isTowingActive(order.status)),
    ) ?? null;

  if (!claim || !isApproved) {
    return (
      <PageContainer>
        <AppHeader title="Tiket Klaim" />
        <EmptyState
          title={claim ? 'Tiket belum tersedia' : 'Klaim tidak ditemukan'}
          description={
            claim ? 'Tiket klaim terbit setelah klaim Anda disetujui asuransi.' : undefined
          }
          action={
            <Button fullWidth={false} onClick={() => navigate(ROUTES.claims)}>
              Lihat Klaim
            </Button>
          }
        />
      </PageContainer>
    );
  }

  const used = isClaimTicketUsed(job);

  return (
    <PageContainer>
      <AppHeader showLogo />
      <div className="flex flex-1 flex-col gap-4 px-5 py-5">
        <div>
          <h1 className="text-18 text-deep-blue-600 font-semibold">Klaim Telah Disetujui!</h1>
          <p className="text-13 mt-1 text-neutral-800">
            Silakan tunjukkan tiket ini ke bengkel mitra kami.
          </p>
        </div>

        {jobQuery.isLoading ? (
          <LoadingState label="Menyiapkan tiket…" />
        ) : jobQuery.isError ? (
          <ErrorState onRetry={() => void jobQuery.refetch()} />
        ) : (
          <>
            <ClaimTicket
              claimNumber={claim.claimNumber}
              claimType={claim.claimType}
              incidentDate={claim.incidentDate}
              approvedAmount={approvedAmountOf(claim, job)}
              code={job?.jobCode || claim.claimNumber}
              state={ticketStateOf(job, used)}
            />

            {/* Tiket tanpa bengkel belum bisa dipindai: ajakan memilih bengkel
                menggantikan petunjuk pindai, supaya pesannya tidak dobel. */}
            {job ? (
              <div className="bg-deep-blue-50 border-deep-blue-100 flex items-start gap-3 rounded-xl border p-4">
                <QrCode className="text-deep-blue-600 mt-0.5 size-5 shrink-0" />
                <p className="text-13 text-deep-blue-700">{scanHintOf(used)}</p>
              </div>
            ) : (
              <Card className="border-warning/40 bg-warning/5 flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <span className="bg-warning/15 text-warning grid size-10 shrink-0 place-items-center rounded-full">
                    <Wrench className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-14 font-semibold text-neutral-900">Bengkel belum dipilih</p>
                    <p className="text-12 mt-1 text-neutral-700">
                      {claimNumber
                        ? 'Tiket ini baru bisa dipindai setelah Anda mendaftarkan bengkel perbaikan.'
                        : 'Nomor klaim tidak terbaca, jadi bengkel perbaikan belum bisa didaftarkan. Buka ulang klaim ini dari daftar Klaim Saya.'}
                    </p>
                  </div>
                </div>
                <Button
                  variant="outline"
                  disabled={!claimNumber}
                  onClick={() => navigate(ROUTES.workshopList, { state: { claimNumber } })}
                >
                  Pilih Bengkel
                </Button>
              </Card>
            )}

            {workshop ? (
              <WorkshopCard
                place={workshop}
                towingOrder={towingOrder}
                onRoute={() =>
                  navigate(buildPath.workshopRoute(String(workshop.id)), {
                    state: { place: workshop },
                  })
                }
                onTowing={() => navigate(ROUTES.towingOrder, { state: { workshop, claimNumber } })}
                onTowingStatus={() =>
                  towingOrder && navigate(buildPath.towingStatus(towingOrder.orderCode))
                }
              />
            ) : (
              job && (
                <Card>
                  <p className="text-16 text-deep-blue-600 font-semibold">
                    {job.repairStationName}
                  </p>
                  <p className="text-12 mt-1 text-neutral-700">
                    Bengkel tujuan perbaikan untuk klaim ini.
                  </p>
                </Card>
              )
            )}

            <div className="flex items-start gap-3 rounded-xl border border-neutral-300 bg-neutral-200 p-4">
              <span className="bg-deep-blue-50 text-deep-blue-600 grid size-10 shrink-0 place-items-center rounded-full">
                <Info className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-16 text-deep-blue-600 font-semibold">Petunjuk Penggunaan</p>
                <p className="text-13 mt-1 text-neutral-800">
                  Tunjukkan kode atau barcode ini ke petugas bengkel rekanan untuk memulai
                  perbaikan. Pastikan status tiket dalam kondisi DISETUJUI sebelum pengerjaan
                  dimulai.
                </p>
              </div>
            </div>

            {workshop && (workshop.latitude !== 0 || workshop.longitude !== 0) && (
              <div className="relative isolate overflow-hidden rounded-xl">
                <MapView
                  center={{ lat: workshop.latitude, lng: workshop.longitude }}
                  markers={[
                    {
                      lat: workshop.latitude,
                      lng: workshop.longitude,
                      label: workshop.name,
                      variant: 'destination',
                    },
                  ]}
                  className="h-44 rounded-xl"
                />
                {/* Overlay di atas pane Leaflet (z-index tertinggi Leaflet = 1000).
                    Aksinya sengaja tidak diulang di sini — sudah ada di kartu bengkel. */}
                <div className="pointer-events-none absolute inset-x-0 bottom-0 z-1001 bg-linear-to-t from-black/70 to-transparent px-4 pt-10 pb-3">
                  <p className="text-10 font-medium tracking-wide text-white/80 uppercase">
                    Bengkel tujuan perbaikan
                  </p>
                  <p className="text-16 truncate font-semibold text-white">{workshop.name}</p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </PageContainer>
  );
}

function WorkshopCard({
  place,
  towingOrder,
  onRoute,
  onTowing,
  onTowingStatus,
}: {
  place: RecommendationPlace;
  /** Order derek yang masih berjalan untuk klaim ini, bila ada. */
  towingOrder: TowingOrder | null;
  onRoute: () => void;
  onTowing: () => void;
  onTowingStatus: () => void;
}) {
  return (
    <Card>
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-16 text-deep-blue-600 font-semibold">{place.name}</p>
          <p className="text-12 mt-1 flex items-center gap-1 text-neutral-800">
            <Star className="text-warning size-4 fill-current" />
            <strong className="text-13 font-semibold">{place.rating.toFixed(1)}</strong>
            {place.distanceKm > 0 && (
              <span className="text-neutral-700">· {place.distanceKm.toFixed(1)} km</span>
            )}
          </p>
          <p className="text-12 mt-1 text-neutral-800">{place.address || '-'}</p>
        </div>
        <span className="bg-deep-blue-50 text-deep-blue-600 grid size-10 shrink-0 place-items-center rounded-full">
          <Wrench className="size-5" />
        </span>
      </div>

      <div className="text-12 mt-3 flex flex-col gap-2 border-t border-neutral-300 pt-3 text-neutral-800">
        <span className="flex items-center gap-2">
          <Clock className="size-4 text-neutral-700" />
          {place.openHours || 'Jam operasional tidak tersedia'}
        </span>
        {place.phone && (
          <a href={`tel:${place.phone}`} className="flex items-center gap-2">
            <Phone className="size-4 text-neutral-700" />
            {place.phone}
          </a>
        )}
      </div>

      {/* Dua cara mobil sampai ke bengkel, berdampingan di titik keputusannya.
          Mendaftarkan bengkel perbaikan tidak menentukan salah satunya — itu
          catatan terpisah (workshop_visits vs towing_orders). */}
      <div className="mt-3 flex gap-2 border-t border-neutral-300 pt-3">
        <Button
          variant="outline"
          size="sm"
          leftIcon={<Navigation className="size-4" />}
          onClick={onRoute}
        >
          Lihat Rute
        </Button>
        {towingOrder ? (
          <Button size="sm" leftIcon={<Truck className="size-4" />} onClick={onTowingStatus}>
            Status Derek
          </Button>
        ) : (
          <Button size="sm" leftIcon={<Truck className="size-4" />} onClick={onTowing}>
            Pesan Derek
          </Button>
        )}
      </div>
    </Card>
  );
}
