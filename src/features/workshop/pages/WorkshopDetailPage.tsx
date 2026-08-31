import { useState, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQuery } from '@tanstack/react-query';
import {
  Star,
  MapPin,
  Phone,
  CheckCircle2,
  Truck,
  Navigation,
  PenSquare,
  ImageOff,
  Search,
  LocateFixed,
  Wrench,
} from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { Input } from '@/components/ui/Input';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/feedback/StateViews';
import { toast } from '@/components/feedback/toast';
import { extractErrorMessage } from '@/lib/api/client';
import { STORAGE_KEYS, DEFAULT_LOCATION } from '@/config/constants';
import { storage } from '@/lib/storage/storage';
import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/format';
import { buildPath, ROUTES } from '@/app/routes';
import { useScanStore } from '@/features/vehicle-scan/store/scanStore';
import { createTowingOrder } from '@/features/towing/api/towingApi';
import { createRepairJob } from '@/features/claim/api';
import { reverseGeocode } from '@/lib/geo/nominatim';
import { getAccuratePosition } from '@/lib/geo/geolocation';
import { createWorkshopVisitRequest, getWorkshopReviews, type RecommendationPlace } from '../api';

type DetailTab = 'overview' | 'ulasan' | 'galeri';
type WorkshopDetailState =
  | RecommendationPlace
  | { place?: RecommendationPlace; claimNumber?: string }
  | null;

const TABS: { id: DetailTab; label: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'ulasan', label: 'Ulasan' },
  { id: 'galeri', label: 'Galeri' },
];

// Spesialisasi belum disediakan API recommender → tampilkan default agar
// tampilan sesuai desain. Ganti dengan data asli saat field tersedia.
const DEFAULT_SPECIALTIES = ['Premium Car', 'Body Repair', 'Detailing'];

const PRICE_TERMS = [
  'Harga final & mengikat setelah konfirmasi',
  'Tol & parkir ditanggung terpisah dalam perjalanan',
  'Pembayaran otomatis diproses setelah selesai',
];

function resolveWorkshopDetailState(state: WorkshopDetailState): {
  place: RecommendationPlace | null;
  claimNumber: string;
} {
  if (!state) return { place: null, claimNumber: '' };
  if ('place' in state || 'claimNumber' in state) {
    return {
      place: state.place ?? null,
      // Di-trim: nomor berisi spasi saja tetap "truthy" dan akan memunculkan
      // tombol perbaikan yang pasti ditolak backend.
      claimNumber: (state.claimNumber ?? '').trim(),
    };
  }
  if ('id' in state) return { place: state, claimNumber: '' };
  return { place: null, claimNumber: '' };
}

export function WorkshopDetailPage() {
  const navigate = useNavigate();
  const { place, claimNumber } = resolveWorkshopDetailState(
    useLocation().state as WorkshopDetailState,
  );
  const plateNumber = useScanStore((s) => s.plate.number);
  const [tab, setTab] = useState<DetailTab>('overview');
  const [towingSheetOpen, setTowingSheetOpen] = useState(false);
  const [pickupAddress, setPickupAddress] = useState('');
  // Koordinat presisi dari tombol "lokasi saya"; null bila alamat diketik manual.
  const [pickupCoords, setPickupCoords] = useState<{ latitude: number; longitude: number } | null>(
    null,
  );
  const [locating, setLocating] = useState(false);

  const visitMutation = useMutation({
    mutationFn: () => {
      if (!place) throw new Error('Bengkel tidak ditemukan.');
      return createWorkshopVisitRequest({
        targetWorkshopId: place.id,
        inferenceTicket: storage.getString(STORAGE_KEYS.guestInferenceTicket) ?? '',
        claimNumber,
        vehiclePlate: plateNumber ?? '',
      });
    },
    onSuccess: (visit) => {
      if (!place) return;
      toast.success('Rencana kunjungan bengkel dibuat.');
      navigate(buildPath.workshopRoute(String(place.id)), { state: { place, visit } });
    },
    onError: (error) =>
      toast.error(extractErrorMessage(error, 'Gagal membuat rencana kunjungan bengkel.')),
  });

  // Mendaftarkan bengkel tujuan perbaikan. Hanya mungkin untuk klaim yang sudah
  // disetujui — di sinilah izin perbaikan terbit di tiket klaim user.
  const repairMutation = useMutation({
    mutationFn: () => {
      if (!place) throw new Error('Bengkel tidak ditemukan.');
      return createRepairJob(claimNumber, place.id);
    },
    // Nominalnya sudah ditampilkan di layar estimasi & status klaim; jangan
    // diulang di sini supaya tidak ada dua angka yang harus dipercaya user.
    onSuccess: ({ covered }) => {
      toast.success(
        covered
          ? 'Bengkel perbaikan terdaftar. Tunjukkan kode klaim Anda saat tiba.'
          : 'Bengkel terdaftar. Bengkel ini di luar rekanan, jadi biaya perbaikan menjadi tanggungan Anda.',
        covered ? undefined : { duration: 6000 },
      );
      navigate(ROUTES.claims);
    },
    onError: (error) =>
      toast.error(extractErrorMessage(error, 'Gagal mendaftarkan bengkel perbaikan.')),
  });

  const towingMutation = useMutation({
    mutationFn: async () => {
      if (!place) throw new Error('Bengkel tidak ditemukan.');
      const coords = pickupCoords ?? (await currentCoords());
      return createTowingOrder({
        inferenceTicket: storage.getString(STORAGE_KEYS.guestInferenceTicket) ?? '',
        claimNumber,
        pickupAddress: pickupAddress.trim() || 'Lokasi saya saat ini',
        pickupLatitude: coords.latitude,
        pickupLongitude: coords.longitude,
        dropoffType: 'WORKSHOP',
        dropoffAddress: place.address,
        dropoffLatitude: place.latitude,
        dropoffLongitude: place.longitude,
        targetWorkshopId: place.id,
      });
    },
    onSuccess: (order) => {
      setTowingSheetOpen(false);
      toast.success('Permintaan towing dikirim.');
      navigate(buildPath.towingStatus(order.orderCode), { state: { order, workshop: place } });
    },
    onError: (error) => toast.error(extractErrorMessage(error, 'Gagal memesan towing.')),
  });

  // Ambil GPS perangkat → ubah ke alamat terbaca (Nominatim/OSM) → isi field.
  const handleUseCurrentLocation = async () => {
    setLocating(true);
    try {
      const position = await getAccuratePosition({ desiredAccuracyM: 20, timeoutMs: 12_000 });
      setPickupCoords({ latitude: position.latitude, longitude: position.longitude });
      const found = await reverseGeocode(position.latitude, position.longitude);
      setPickupAddress(found?.displayName ?? 'Lokasi saya saat ini');
      toast.success(`Lokasi terkunci (akurasi ±${Math.round(position.accuracy)} m).`);
    } catch {
      toast.error('Gagal mengambil lokasi. Pastikan izin lokasi aktif & sinyal GPS bagus.');
    } finally {
      setLocating(false);
    }
  };

  if (!place) {
    return (
      <PageContainer>
        <AppHeader title="Detail Bengkel" />
        <EmptyState
          title="Bengkel tidak ditemukan"
          description="Silakan pilih dari daftar rekomendasi."
          action={
            <Button fullWidth={false} onClick={() => navigate(ROUTES.workshopList)}>
              Lihat Daftar Bengkel
            </Button>
          }
        />
      </PageContainer>
    );
  }

  const isOpen = place.openStatus.toUpperCase() !== 'CLOSED' && place.openStatus !== 'Tutup';

  return (
    <PageContainer className="bg-neutral-200 pb-0">
      {/* Hero */}
      <div className="relative h-44 w-full shrink-0 bg-neutral-300">
        {place.imageUrl ? (
          <img src={place.imageUrl} alt={place.name} className="size-full object-cover" />
        ) : (
          <div className="bg-deep-blue-50 text-deep-blue-300 flex size-full items-center justify-center">
            <Truck className="size-12" />
          </div>
        )}
        <div className="absolute inset-x-0 top-0">
          <AppHeader transparent />
        </div>
      </div>

      {/* Ringkasan */}
      <div className="px-5 pt-4">
        <div className="flex items-start justify-between gap-3">
          <h1 className="text-deep-blue-600 text-18 font-semibold">{place.name}</h1>
          {/*
            Bintang ini dulu selalu emas penuh (`fill-current` tanpa syarat),
            jadi bengkel tanpa ulasan tampil "bintang penuh 0.0" — terbaca
            seperti tampilan rusak. Bengkel baru memang sengaja ikut tampil di
            rekomendasi dengan rating 0, jadi kasus ini normal, bukan langka.
          */}
          {place.rating > 0 ? (
            <span className="text-warning text-14 inline-flex shrink-0 items-center gap-1 font-semibold">
              <Star className="size-4 fill-current" /> {place.rating.toFixed(1)}
            </span>
          ) : (
            <span className="text-12 shrink-0 text-neutral-600">Belum ada ulasan</span>
          )}
        </div>
        <p className="text-12 mt-1">
          <span className={isOpen ? 'text-success font-medium' : 'text-danger font-medium'}>
            {isOpen ? 'Buka' : 'Tutup'}
          </span>
          {place.openHours && <span className="text-neutral-600"> · {place.openHours}</span>}
        </p>
        <p className="text-12 mt-1 inline-flex items-center gap-1 text-neutral-700">
          <MapPin className="size-3.5" /> {place.address || '-'}
        </p>
      </div>

      {/* Tab */}
      <div className="mt-4 px-5">
        <div className="flex rounded-xl bg-neutral-300 p-1">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'flex-1 rounded-lg py-2 text-[12px] font-medium transition',
                tab === t.id
                  ? 'bg-deep-blue-500 text-[12px] text-[#10200a] shadow-sm'
                  : 'text-[12px] text-neutral-700',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Konten tab */}
      <div className="text-12 flex-1 px-5 py-5">
        {tab === 'overview' && <OverviewTab place={place} isOpen={isOpen} />}
        {tab === 'ulasan' && (
          <ReviewsTab
            workshopId={place.id}
            onWrite={() => navigate(ROUTES.workshopReview, { state: place })}
          />
        )}
        {tab === 'galeri' && <GalleryTab gallery={place.gallery} fallback={place.imageUrl} />}
      </div>

      {/* Footer aksi */}
      <div className="pb-safe sticky bottom-0 border-t border-neutral-300 bg-neutral-100 px-5">
        <div className="h-auto w-full py-3">
          {tab === 'overview' ? (
            <div className="flex flex-col gap-3">
              {/* Klaim yang sudah disetujui: pilih bengkel ini sebagai tempat perbaikan. */}
              {claimNumber && (
                <Button
                  leftIcon={<Wrench className="size-4.5" />}
                  isLoading={repairMutation.isPending}
                  onClick={() => repairMutation.mutate()}
                >
                  <span className="text-[14px]">Perbaiki di Bengkel Ini</span>
                </Button>
              )}
              <div className="flex gap-3">
                <Button
                  variant={claimNumber ? 'outline' : 'primary'}
                  leftIcon={<Truck className="size-5" />}
                  onClick={() => setTowingSheetOpen(true)}
                >
                  Pesan Towing
                </Button>
                <Button
                  variant="outline"
                  leftIcon={<Navigation className="size-5" />}
                  isLoading={visitMutation.isPending}
                  onClick={() => visitMutation.mutate()}
                >
                  Antar Mandiri
                </Button>
              </div>
            </div>
          ) : (
            <Button leftIcon={<Navigation className="size-5" />} onClick={() => setTab('overview')}>
              Mulai
            </Button>
          )}
        </div>
      </div>

      {/* Sheet: Set Lokasi Penjemputan (6.2.1) / Towing tidak tersedia (6.2.2) */}
      <Modal
        open={towingSheetOpen}
        onClose={() => setTowingSheetOpen(false)}
        title="Set Lokasi Penjemputan"
        variant="sheet"
        footer={
          place.towingAvailable ? (
            <Button
              leftIcon={<Truck className="size-5" />}
              isLoading={towingMutation.isPending}
              onClick={() => towingMutation.mutate()}
            >
              Pesan Towing
            </Button>
          ) : (
            <Button
              leftIcon={<Search className="size-5" />}
              onClick={() =>
                navigate(ROUTES.towingOrder, { state: { workshop: place, claimNumber } })
              }
            >
              Cari Towing
            </Button>
          )
        }
      >
        <div className="flex flex-col gap-4">
          <div>
            <Input
              label="Alamat penjemputan"
              placeholder="Mis. Jl. Sudirman No. 1"
              leftIcon={<MapPin className="size-5" />}
              value={pickupAddress}
              onChange={(e) => {
                setPickupAddress(e.target.value);
                setPickupCoords(null); // diketik manual → koordinat presisi GPS tak berlaku
              }}
            />
            <button
              type="button"
              onClick={handleUseCurrentLocation}
              disabled={locating}
              className="text-deep-blue-600 text-12 mt-2 inline-flex items-center gap-1.5 font-medium disabled:opacity-60"
            >
              {locating ? <Spinner className="size-4" /> : <LocateFixed className="size-4" />}
              {locating ? 'Mengambil lokasi…' : 'Gunakan lokasi saya saat ini'}
            </button>
          </div>
          {/*
            Angka biaya sengaja tidak ditampilkan di sini.
            Sebelumnya layar ini menulis "Rp 400.000" dari konstanta tetap di
            frontend — tidak terhubung ke apa pun. Tarif sebenarnya dihitung
            backend (`CalculateTowingPrice`: base_fare + kelebihan km * per_km_fare
            + biaya malam) dari tarif penyedia yang DITUGASKAN, dan penyedia baru
            ditentukan setelah order masuk. Jadi pada titik ini memang belum ada
            harga yang bisa dipertanggungjawabkan — lebih baik diam daripada
            menyebut angka yang meleset.
          */}
          <div className="flex items-center justify-between rounded-xl border border-neutral-400 px-4 py-3">
            <span className="text-success text-14 inline-flex items-center gap-2 font-medium">
              <Truck className="size-5" /> Towing
            </span>
            <span className="text-12 text-neutral-600">Dihitung setelah penyedia ditugaskan</span>
          </div>
          {place.towingAvailable ? (
            <p className="text-[12px] text-neutral-600">
              Biayanya muncul di rincian order, sebelum Anda membayar.
            </p>
          ) : (
            <p className="text-12 text-orange">
              Saat ini layanan towing bengkel belum tersedia. Silakan menggunakan layanan towing
              dari mitra lain.
            </p>
          )}
        </div>
      </Modal>
    </PageContainer>
  );
}

async function currentCoords(): Promise<{ latitude: number; longitude: number }> {
  try {
    const pos = await getAccuratePosition({ desiredAccuracyM: 30, timeoutMs: 10_000 });
    return { latitude: pos.latitude, longitude: pos.longitude };
  } catch {
    return DEFAULT_LOCATION; // izin/jaringan tidak tersedia → fallback lokasi default
  }
}

function OverviewTab({ place, isOpen }: { place: RecommendationPlace; isOpen: boolean }) {
  const tags = [
    'Towing',
    place.acceptingOrders ? 'Menerima Order' : 'Order Penuh',
    'Rekanan DRIVE',
  ];
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2">
        {tags.map((t, i) => (
          <span
            key={t}
            className={cn(
              'rounded-full px-3 py-1 text-[12px] font-medium',
              i === 0 && 'bg-orange/15 text-orange text-[12px]',
              i === 1 && 'bg-deep-blue-50 text-deep-blue-600 text-[12px]',
              i === 2 && 'bg-neutral-300 text-[12px] text-neutral-800',
            )}
          >
            {t}
          </span>
        ))}
      </div>

      {place.acceptingOrders && isOpen && (
        <div className="bg-green-cust/10 flex items-start gap-3 rounded-xl p-4">
          <CheckCircle2 className="text-green-cust mt-0.5 size-5 shrink-0" />
          <div>
            <p className="text-14 font-semibold text-neutral-900">Siap Menerima Kendaraan</p>
            <p className="text-12 text-neutral-700">
              Bengkel buka dan menerima order baru. Pesan sekarang untuk mendapatkan slot lebih
              cepat.
            </p>
          </div>
        </div>
      )}

      <Section title="Spesialisasi">
        <div className="flex flex-wrap gap-2">
          {DEFAULT_SPECIALTIES.map((s) => (
            <span
              key={s}
              className="bg-deep-blue-50 text-deep-blue-600 text-12 rounded-lg px-3 py-1.5"
            >
              {s}
            </span>
          ))}
        </div>
      </Section>

      {place.phone && (
        <Section title="Kontak">
          <a
            href={`tel:${place.phone}`}
            className="text-deep-blue-600 text-14 inline-flex items-center gap-2 font-medium"
          >
            <Phone className="size-5" /> {place.phone}
          </a>
        </Section>
      )}

      <Section title="Ketentuan Harga">
        <ul className="flex flex-col gap-2">
          {PRICE_TERMS.map((term) => (
            <li key={term} className="text-12 flex items-start gap-2 text-neutral-700">
              <CheckCircle2 className="text-green-cust mt-0.5 size-4 shrink-0" /> {term}
            </li>
          ))}
        </ul>
      </Section>
    </div>
  );
}

function ReviewsTab({ workshopId, onWrite }: { workshopId: number; onWrite: () => void }) {
  const { data, isLoading } = useQuery({
    queryKey: ['workshop-reviews', workshopId],
    queryFn: () => getWorkshopReviews(workshopId),
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-10">
        <Spinner />
      </div>
    );
  }

  const summary = data ?? { average: 0, count: 0, reviews: [], distribution: {} };
  const maxCount = Math.max(1, ...Object.values(summary.distribution));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-5">
        <div className="text-center">
          <p className="text-20 font-bold text-neutral-900">
            {summary.count > 0 ? `${summary.average.toFixed(1)}/5` : '—'}
          </p>
          <div className="mt-1 flex justify-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={cn(
                  'size-3.5',
                  i < Math.floor(summary.average)
                    ? 'text-warning fill-current'
                    : 'text-neutral-500',
                )}
              />
            ))}
          </div>
          <p className="mt-1 text-[12px] text-neutral-600">
            {summary.count > 0 ? `${summary.count} ulasan` : 'Belum dinilai'}
          </p>
        </div>
        <div className="flex-1">
          {[5, 4, 3, 2, 1].map((star) => {
            const count = summary.distribution[star] ?? 0;
            return (
              <div key={star} className="flex items-center gap-2">
                <span className="w-3 text-[12px] text-neutral-600">{star}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-neutral-300">
                  <div
                    className="bg-warning h-full rounded-full"
                    style={{ width: `${(count / maxCount) * 100}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <p className="text-12 text-neutral-700">
        Tulis ulasan Anda untuk membantu pengguna lain menemukan bengkel terpercaya.
      </p>
      <Button variant="outline" leftIcon={<PenSquare className="size-5" />} onClick={onWrite}>
        Tulis Ulasan Anda
      </Button>

      {summary.reviews.length === 0 ? (
        <p className="text-12 py-4 text-center text-neutral-600">Belum ada ulasan.</p>
      ) : (
        <div className="flex flex-col gap-4">
          {summary.reviews.map((r) => (
            <div key={r.id} className="border-t border-neutral-300 pt-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="bg-deep-blue-100 text-deep-blue-600 text-12 flex size-9 items-center justify-center rounded-full font-semibold">
                    U
                  </div>
                  <div>
                    <p className="text-12 font-semibold text-neutral-900">Pengguna DRIVE</p>
                    <p className="text-[12px] text-neutral-600">{formatDate(r.createdAt)}</p>
                  </div>
                </div>
                <div className="flex gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star
                      key={i}
                      className={cn(
                        'size-3',
                        i < r.score ? 'text-warning fill-current' : 'text-neutral-500',
                      )}
                    />
                  ))}
                </div>
              </div>
              {r.comment && <p className="text-12 mt-2 text-neutral-700">{r.comment}</p>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function GalleryTab({ gallery, fallback }: { gallery: string[]; fallback: string }) {
  const images = gallery.length > 0 ? gallery : fallback ? [fallback] : [];
  if (images.length === 0) {
    return <EmptyState icon={<ImageOff className="size-7" />} title="Belum ada galeri" />;
  }
  return (
    <div className="grid grid-cols-2 gap-3">
      {images.map((src, i) => (
        <img
          key={`${src}-${i}`}
          src={src}
          alt={`Galeri ${i + 1}`}
          className="aspect-square w-full rounded-xl object-cover"
        />
      ))}
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h2 className="text-14 mb-2 font-semibold text-neutral-900">{title}</h2>
      {children}
    </div>
  );
}
