import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Camera, Car, ChevronRight, Plus, UserRound } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/feedback/StateViews';
import { ROUTES } from '@/app/routes';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useScanStore } from '@/features/vehicle-scan/store/scanStore';
import { hasCheckupPermissionsGranted } from '@/features/checkup/permissions';
import { getVehicles } from '../api';
import { hasPolis, type SavedVehicle } from '../types';

export function SelectVehiclePage() {
  const navigate = useNavigate();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const reset = useScanStore((s) => s.reset);
  const setSelectedVehicle = useScanStore((s) => s.setSelectedVehicle);
  const setVehicleInfo = useScanStore((s) => s.setVehicleInfo);

  // Mulai bersih & lupakan pilihan kendaraan dari sesi cek sebelumnya.
  useEffect(() => {
    reset();
    setSelectedVehicle(null);
  }, [reset, setSelectedVehicle]);

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['vehicles'],
    queryFn: getVehicles,
    enabled: isAuthenticated,
  });

  /**
   * Kendaraan terdaftar → LANGSUNG ke langkah foto plat, lewati form Data
   * Kendaraan. Seluruh isinya (nama, jenis, warna, tahun) sudah tersimpan saat
   * kendaraan didaftarkan, jadi meminta user mengetik ulang hanya membuatnya
   * mengisi dua kali.
   */
  const selectVehicle = (v: SavedVehicle) => {
    setSelectedVehicle({ plate: v.vehiclePlate, name: v.vehicleName });
    setVehicleInfo({
      brandModel: v.vehicleName,
      color: v.vehicleColor,
      // 0 = tahun belum pernah diisi; jangan tampilkan sebagai "0".
      year: v.vehicleYear ? String(v.vehicleYear) : '',
      type: v.vehicleType,
    });
    navigate(hasCheckupPermissionsGranted() ? ROUTES.licensePlate : ROUTES.checkupPermission);
  };

  /** Kendaraan baru → tetap lewat form karena datanya belum ada di mana pun. */
  const useNewVehicle = () => {
    setSelectedVehicle(null);
    navigate(ROUTES.vehicleData);
  };

  return (
    <PageContainer className="bg-neutral-200">
      <AppHeader title="Pilih Kendaraan" />

      <div className="flex min-h-0 flex-1 flex-col">
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
          {!isAuthenticated ? (
            <GuestNotice />
          ) : isLoading ? (
            <LoadingState />
          ) : isError ? (
            <ErrorState onRetry={() => void refetch()} />
          ) : !data || data.length === 0 ? (
            <EmptyVehicles onManage={() => navigate(ROUTES.myVehicles)} />
          ) : (
            <VehicleList vehicles={data} onSelect={selectVehicle} />
          )}
        </div>

        <div className="bg-[#131c24] px-4 pt-3 pb-[calc(16px+env(safe-area-inset-bottom))]">
          <Button size="lg" leftIcon={<Camera className="size-5" />} onClick={useNewVehicle}>
            Cek Kendaraan Baru
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}

function GuestNotice() {
  return (
    <div className="flex min-h-[calc(100dvh-180px)] flex-col items-center justify-center px-4 text-center">
      <UserRound className="size-20 text-neutral-500" />
      <h2 className="mt-4 text-[14px] font-semibold text-neutral-800">
        Login untuk memilih kendaraan tersimpan
      </h2>
      <p className="mt-2 max-w-[280px] text-[12px] leading-relaxed text-neutral-600">
        Anda tetap bisa melanjutkan sebagai kendaraan baru di bawah.
      </p>
    </div>
  );
}

function EmptyVehicles({ onManage }: { onManage: () => void }) {
  return (
    <div className="flex min-h-[calc(100dvh-220px)] flex-col items-center justify-center px-4 text-center">
      <Car className="size-24 text-neutral-500" />
      <h2 className="mt-4 text-[16px] font-semibold text-neutral-800">
        Belum ada kendaraan tersimpan
      </h2>
      <p className="mt-2 max-w-[320px] text-[12px] leading-relaxed text-neutral-600">
        Daftarkan kendaraan dari menu "Kendaraan Saya" supaya cek kerusakan berikutnya cukup pilih
        tanpa isi ulang.
      </p>
      <Button
        className="mt-4 w-auto"
        variant="outline"
        fullWidth={false}
        leftIcon={<Plus className="size-4" />}
        onClick={onManage}
      >
        Kelola Kendaraan Saya
      </Button>
    </div>
  );
}

function VehicleList({
  vehicles,
  onSelect,
}: {
  vehicles: SavedVehicle[];
  onSelect: (vehicle: SavedVehicle) => void;
}) {
  return (
    <div>
      <h2 className="text-[14px] font-semibold text-neutral-800">Kendaraan Tersimpan</h2>
      <p className="mt-1 text-[12px] leading-relaxed text-neutral-600">
        Pilih kendaraan yang ingin Anda cek. Data otomatis terisi.
      </p>
      <div className="mt-3 flex flex-col gap-3">
        {vehicles.map((vehicle) => (
          <SelectableVehicleTile
            key={vehicle.vehiclePlate}
            vehicle={vehicle}
            onClick={() => onSelect(vehicle)}
          />
        ))}
      </div>
    </div>
  );
}

function SelectableVehicleTile({
  vehicle,
  onClick,
}: {
  vehicle: SavedVehicle;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-visible:ring-deep-blue-300 w-full rounded-xl text-left focus-visible:ring-2 focus-visible:outline-none"
    >
      {/*
        Susunannya disamakan dengan kartu di halaman "Kendaraan Saya" supaya
        satu kendaraan terlihat sama di mana pun ia muncul. Bedanya cuma di
        bagian bawah: di sini tidak ada tombol aksi, melainkan tanda panah —
        seluruh kartunya sendiri yang bisa ditekan.

        Foto plat SENGAJA tidak dipakai lagi sebagai gambar kecil di kiri:
        diambil dari jarak dekat sebagai bukti, dan di ukuran itu cuma terbaca
        sebagai kotak buram.
      */}
      <div className="drive-card relative flex flex-col gap-0 overflow-hidden p-0">
        {hasPolis(vehicle) && (
          <span className="text-10 border-deep-blue-500/40 text-deep-blue-500 absolute top-3 right-3 z-10 inline-flex items-center rounded-full border bg-[#0b1218]/85 px-2.5 py-1 font-medium">
            Berpolis
          </span>
        )}

        {vehicle.vehicleImage ? (
          <div className="relative h-32 w-full">
            <img
              src={vehicle.vehicleImage}
              alt=""
              loading="lazy"
              className="absolute inset-0 size-full object-cover"
            />
            <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,12,17,0.15)_0%,rgba(7,12,17,0.55)_55%,var(--color-neutral-100)_100%)]" />
            <div className="absolute inset-x-0 bottom-0 px-4 pb-3">
              <p className="text-16 truncate font-semibold text-neutral-900">
                {vehicle.vehicleName || '-'}
              </p>
              <p className="hud-readout text-deep-blue-500 mt-0.5 text-[12px] tracking-wide">
                {vehicle.vehiclePlate}
              </p>
            </div>
          </div>
        ) : (
          <div className="flex items-start gap-3 px-4 pt-4">
            <div className="drive-chip flex size-12 shrink-0 items-center justify-center rounded-xl">
              <Car className="text-deep-blue-500 size-6" aria-hidden />
            </div>
            <div className="min-w-0 flex-1 pr-16">
              <p className="text-14 truncate font-semibold text-neutral-900">
                {vehicle.vehicleName || '-'}
              </p>
              <p className="hud-readout text-deep-blue-500 mt-0.5 text-[12px] tracking-wide">
                {vehicle.vehiclePlate}
              </p>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3 px-4 pt-2 pb-4">
          <p className="text-11 min-w-0 flex-1 truncate text-neutral-600">
            {[
              vehicle.vehicleType,
              vehicle.vehicleColor,
              vehicle.vehicleYear > 0 ? vehicle.vehicleYear : null,
            ]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <ChevronRight className="text-deep-blue-500 size-5 shrink-0" aria-hidden />
        </div>
      </div>
    </button>
  );
}
