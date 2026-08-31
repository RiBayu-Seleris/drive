import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Hospital, MapPin, Phone, Star, Truck } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { AppHeader } from '@/components/layout/AppHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/Spinner';
import { EmptyState, ErrorState } from '@/components/feedback/StateViews';
import { DEFAULT_LOCATION } from '@/config/constants';
import { ROUTES } from '@/app/routes';
import { getEmergencyServices } from '@/features/workshop/api';

/**
 * Layanan darurat terdekat — derek dan rumah sakit.
 *
 * Daftarnya diambil dari `/v1/recommender/`, endpoint yang sama dengan halaman
 * rekomendasi bengkel; ia menyaring berdasarkan jarak dari koordinat pengguna.
 *
 * Sebelumnya halaman ini memakai dua array yang ditulis mati di berkas ini —
 * "Derek Cepat 24 Jam 0,8 km" dengan nomor 0812-0000-1111, dan seterusnya.
 * Jaraknya angka tetap padahal tertulis "terdekat dari lokasi Anda", dan
 * nomornya pola isian sementara. Di halaman DARURAT itu berbahaya: orang yang
 * mobilnya mogok menekan tombol telepon lalu menghubungi nomor yang tidak ada,
 * sementara rating 4.8 dan jarak 0,8 km membuatnya terlihat meyakinkan.
 */
export function EmergencyServicePage({ variant }: { variant: 'hospital' | 'towing' }) {
  const navigate = useNavigate();
  const isTowing = variant === 'towing';
  const title = isTowing ? 'Towing Terdekat' : 'Rumah Sakit Darurat';

  const [coords, setCoords] = useState<{ latitude: number; longitude: number }>(DEFAULT_LOCATION);
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setCoords({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => undefined,
      { timeout: 8000 },
    );
  }, []);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['recommendations', variant, coords],
    queryFn: () => getEmergencyServices(isTowing ? 'towing' : 'hospital', coords),
  });

  const places = data ?? [];

  return (
    <PageContainer>
      <AppHeader title={title} />
      <div className="flex flex-1 flex-col px-5 py-6">
        <div className="text-12 flex items-center gap-2 text-neutral-700">
          <MapPin className="size-4" /> Layanan terdekat dari lokasi Anda
        </div>

        {isLoading ? (
          <LoadingState label={isTowing ? 'Mencari derek terdekat…' : 'Mencari rumah sakit…'} />
        ) : isError ? (
          <ErrorState
            title="Gagal memuat layanan"
            description="Periksa koneksi Anda, lalu coba lagi."
            onRetry={() => void refetch()}
          />
        ) : places.length === 0 ? (
          /*
           * Daftar kosong yang jujur, BUKAN daftar karangan.
           *
           * Di halaman darurat, tidak menemukan apa-apa jauh lebih aman
           * daripada memberi nomor yang tidak bisa dihubungi — orangnya bisa
           * langsung mencari bantuan lain alih-alih menunggu telepon diangkat.
           */
          <EmptyState
            icon={isTowing ? <Truck className="size-7" /> : <Hospital className="size-7" />}
            title={isTowing ? 'Belum ada derek terdaftar' : 'Belum ada rumah sakit terdaftar'}
            description={
              isTowing
                ? 'Tidak ada penyedia derek di sekitar lokasi Anda. Pesan towing lewat tombol di bawah, atau hubungi bantuan darurat 112.'
                : 'Tidak ada rumah sakit terdaftar di sekitar lokasi Anda. Untuk keadaan gawat darurat, hubungi 119 atau 112.'
            }
          />
        ) : (
          <div className="mt-4 flex flex-col gap-3">
            {places.map((place) => (
              <Card key={place.id} className="flex items-center gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-14 truncate font-semibold text-neutral-900">{place.name}</p>
                  <div className="text-12 mt-1 flex items-center gap-3 text-neutral-700">
                    {/* Rating hanya ditampilkan bila memang ada ulasannya —
                        bintang untuk nilai 0 terbaca sebagai layanan buruk,
                        bukan layanan yang belum pernah dinilai. */}
                    {place.rating > 0 && (
                      <span className="inline-flex items-center gap-1">
                        <Star className="text-warning size-3.5" /> {place.rating.toFixed(1)}
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="size-3.5" />
                      {Math.max(0.1, place.distanceKm).toFixed(1)} km
                    </span>
                  </div>
                  {place.address && (
                    <p className="text-11 mt-1 line-clamp-1 text-neutral-600">{place.address}</p>
                  )}
                </div>
                {/* Tombol telepon hanya digambar bila nomornya ada. Tombol yang
                    membuka aplikasi telepon dengan nomor kosong lebih buruk
                    daripada tidak ada tombol sama sekali. */}
                {place.phone ? (
                  <a
                    href={`tel:${place.phone}`}
                    aria-label={`Telepon ${place.name}`}
                    className="bg-green-cust/15 text-green-cust flex size-10 shrink-0 items-center justify-center rounded-full"
                  >
                    <Phone className="size-5" />
                  </a>
                ) : (
                  <span className="text-11 shrink-0 text-neutral-500">Tanpa nomor</span>
                )}
              </Card>
            ))}
          </div>
        )}

        {isTowing && (
          <div className="mt-auto pt-8">
            <Button
              size="lg"
              leftIcon={<Truck className="size-5" />}
              onClick={() => navigate(ROUTES.towingOrder)}
            >
              Pesan Towing Sekarang
            </Button>
          </div>
        )}
      </div>
    </PageContainer>
  );
}
