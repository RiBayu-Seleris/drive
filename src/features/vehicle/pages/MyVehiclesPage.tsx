import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRightLeft, Car, Plus, Pencil, Trash2 } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { AppHeader } from '@/components/layout/AppHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/Spinner';
import { ErrorState, EmptyState } from '@/components/feedback/StateViews';
import { confirm } from '@/components/feedback/confirm';
import { toast } from '@/components/feedback/toast';
import { extractErrorMessage } from '@/lib/api/client';
import { ROUTES } from '@/app/routes';
import { getVehicles, deleteVehicle } from '../api';
import { hasPolis, type SavedVehicle } from '../types';

export function MyVehiclesPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['vehicles'],
    queryFn: getVehicles,
  });

  const remove = useMutation({
    mutationFn: (plate: string) => deleteVehicle(plate),
    onSuccess: () => {
      toast.success('Kendaraan dihapus.');
      void queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
    onError: (error) => toast.error(extractErrorMessage(error, 'Gagal menghapus kendaraan.')),
  });

  /*
   * "Sudah terjual" melepas plat dari garasi ini supaya pemilik BARU bisa
   * mendaftarkannya. Plat unik secara global di database, jadi selama baris ini
   * ada, akun mana pun yang mencoba plat sama akan ditolak — dan pemilik baru
   * tidak punya cara menghapus data dari akun orang lain.
   *
   * Sengaja tersedia JUGA saat kendaraan masih berpolis, karena justru itu
   * keadaan yang paling sering: mobil dijual di tengah masa polis. Polisnya
   * sendiri tidak tersentuh — ia menyimpan salinan data kendaraannya sendiri,
   * dan alur klaim tidak pernah membaca tabel garasi.
   */
  const sold = useMutation({
    mutationFn: (plate: string) => deleteVehicle(plate),
    onSuccess: () => {
      toast.success('Kendaraan dilepas. Pemilik barunya sudah bisa mendaftarkannya.');
      void queryClient.invalidateQueries({ queryKey: ['vehicles'] });
    },
    onError: (error) => toast.error(extractErrorMessage(error, 'Gagal melepas kendaraan.')),
  });

  const handleSold = async (v: SavedVehicle) => {
    const insured = hasPolis(v);
    const ok = await confirm({
      title: 'Tandai sudah terjual',
      message: insured
        ? `${v.vehicleName} (${v.vehiclePlate}) akan dilepas dari daftar Anda, sehingga pemilik barunya bisa mendaftarkannya. Kalau ada yang pernah meminta plat ini, dia akan dikabari lewat email.\n\nPolis Anda tetap berjalan sampai ${formatVehicleDate(v.polisEnd)}. Menandai terjual tidak membatalkan polis, dan premi yang sudah dibayar tidak dikembalikan.`
        : `${v.vehicleName} (${v.vehiclePlate}) akan dilepas dari daftar Anda, sehingga pemilik barunya bisa mendaftarkannya. Kalau ada yang pernah meminta plat ini, dia akan dikabari lewat email.`,
      confirmText: 'Ya, sudah terjual',
    });
    if (ok) sold.mutate(v.vehiclePlate);
  };

  const handleDelete = async (v: SavedVehicle) => {
    const insured = hasPolis(v);
    const ok = await confirm({
      title: 'Hapus kendaraan',
      message: insured
        ? `Hapus ${v.vehicleName} (${v.vehiclePlate}) dari daftar Anda?\n\nPolis ${v.polisNumber} tetap berjalan sampai ${formatVehicleDate(v.polisEnd)} dan tidak ikut terhapus.`
        : `Hapus ${v.vehicleName} (${v.vehiclePlate})?`,
      confirmText: 'Hapus',
      tone: 'danger',
    });
    if (ok) remove.mutate(v.vehiclePlate);
  };

  return (
    <PageContainer>
      <AppHeader title="Kendaraan Saya" />
      <div className="flex flex-1 flex-col px-5 py-5">
        {isLoading ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon={<Car className="size-7" />}
            title="Belum ada kendaraan"
            description="Tambahkan kendaraan untuk mempercepat proses klaim."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {data.map((v) => (
              <Card
                key={v.vehiclePlate}
                className="relative flex flex-col gap-0 overflow-hidden p-0"
              >
                {/* Lencana di pojok, bukan di tengah tumpukan teks. */}
                {/*
                  Lencana pakai latar PEKAT, bukan Badge transparan bawaan.
                  Di atas foto, `bg-green-cust/15` nyaris hilang begitu bagian
                  itu kebetulan terang — langit siang, mobil putih, dinding
                  cerah. Latar pekat + garis tepi tipis terbaca di atas apa pun.
                */}
                {hasPolis(v) && (
                  <span className="text-10 border-deep-blue-500/40 text-deep-blue-500 absolute top-3 right-3 z-10 inline-flex items-center rounded-full border bg-[#0b1218]/85 px-2.5 py-1 font-medium">
                    Berpolis
                  </span>
                )}

                {v.vehicleImage ? (
                  /*
                    Foto kendaraan jadi latar, dengan peluruhan gelap dari
                    bawah supaya tulisannya tetap terbaca berapa pun terang
                    fotonya. Tanpa peluruhan itu, mobil putih di siang hari
                    membuat nama kendaraannya hilang.
                  */
                  <div className="relative h-36 w-full">
                    <img
                      src={v.vehicleImage}
                      alt=""
                      loading="lazy"
                      className="absolute inset-0 size-full object-cover"
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,12,17,0.15)_0%,rgba(7,12,17,0.55)_55%,var(--color-neutral-100)_100%)]" />
                    <div className="absolute inset-x-0 bottom-0 px-4 pb-3">
                      <p className="text-16 truncate font-semibold text-neutral-900">
                        {v.vehicleName}
                      </p>
                      <p className="hud-readout text-deep-blue-500 mt-0.5 text-[12px] tracking-wide">
                        {v.vehiclePlate}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-start gap-3 px-4 pt-4">
                    {/*
                      Ikon, bukan foto plat. Foto plat diambil dari jarak dekat
                      sebagai bukti; di ukuran kecil ia cuma terbaca sebagai
                      kotak buram.
                    */}
                    <div className="drive-chip flex size-12 shrink-0 items-center justify-center rounded-xl">
                      <Car className="text-deep-blue-500 size-6" aria-hidden />
                    </div>
                    <div className="min-w-0 flex-1 pr-16">
                      <p className="text-14 truncate font-semibold text-neutral-900">
                        {v.vehicleName}
                      </p>
                      <p className="hud-readout text-deep-blue-500 mt-0.5 text-[12px] tracking-wide">
                        {v.vehiclePlate}
                      </p>
                    </div>
                  </div>
                )}

                <div className="flex flex-col gap-3 px-4 pt-2 pb-4">
                  <p className="text-11 truncate text-neutral-600">
                    {[v.vehicleType, v.vehicleColor, v.vehicleYear > 0 ? v.vehicleYear : null]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>

                  {hasPolis(v) && (
                    <div className="rounded-lg bg-neutral-200 px-3 py-2">
                      <p className="text-[10.5px] tracking-wide text-neutral-600 uppercase">
                        Nomor polis
                      </p>
                      <p className="text-12 mt-0.5 text-neutral-800">
                        {v.polisNumber}
                        <span className="text-neutral-600">
                          {' '}
                          · berlaku sampai {formatVehicleDate(v.polisEnd)}
                        </span>
                      </p>
                    </div>
                  )}

                  {/*
                    Ketiganya tersedia untuk SEMUA kendaraan, termasuk yang
                    berpolis — dulu semuanya disembunyikan saat berpolis,
                    sehingga pemilik yang menjual mobil di tengah masa polis
                    tidak punya tombol apa pun.
                  */}
                  <div className="grid grid-cols-3 gap-2 border-t border-[#223039] pt-3">
                    <button
                      type="button"
                      onClick={() => handleSold(v)}
                      className="text-12 flex items-center justify-center gap-1.5 rounded-lg py-2 font-medium text-neutral-700 hover:bg-neutral-200"
                    >
                      <ArrowRightLeft className="size-4 shrink-0" aria-hidden />
                      Terjual
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate(ROUTES.vehicleForm, { state: v })}
                      className="text-12 flex items-center justify-center gap-1.5 rounded-lg py-2 font-medium text-neutral-700 hover:bg-neutral-200"
                    >
                      <Pencil className="size-4 shrink-0" aria-hidden />
                      Ubah
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(v)}
                      className="text-12 text-danger hover:bg-danger/10 flex items-center justify-center gap-1.5 rounded-lg py-2 font-medium"
                    >
                      <Trash2 className="size-4 shrink-0" aria-hidden />
                      Hapus
                    </button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <div className="mt-auto pt-6">
          <Button
            size="lg"
            leftIcon={<Plus className="size-5" />}
            onClick={() => navigate(ROUTES.vehicleForm)}
          >
            Tambah Kendaraan
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}

function formatVehicleDate(value: string): string {
  if (!value || value === '-') return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
