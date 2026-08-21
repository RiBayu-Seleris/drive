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
import { cn } from '@/lib/utils/cn';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useScanStore } from '@/features/vehicle-scan/store/scanStore';
import { hasCheckupPermissionsGranted } from '@/features/checkup/permissions';
import { getVehicles } from '../api';
import type { SavedVehicle } from '../types';

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
    <PageContainer className="bg-[#F9FAFB]">
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

        <div className="bg-[#F9FAFB] px-4 pt-3 pb-[calc(16px+env(safe-area-inset-bottom))]">
          <Button size="lg" leftIcon={<Camera className="size-5" />} onClick={useNewVehicle}>
            Cek Kendaraan Baru
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}

function hasCachedPlateImage(vehicle: SavedVehicle): boolean {
  return vehicle.plateImage.trim().length > 0;
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
  const hasPlateImage = hasCachedPlateImage(vehicle);

  return (
    <button
      type="button"
      onClick={onClick}
      className="focus-visible:ring-deep-blue-300 w-full rounded-xl text-left focus-visible:ring-2 focus-visible:outline-none"
    >
      <div className="flex items-center gap-3 rounded-xl border border-neutral-300 bg-white p-3">
        <div className="relative size-14 shrink-0 overflow-hidden rounded-lg bg-neutral-300">
          <VehiclePlaceholder />
          {hasPlateImage && (
            <img
              src={vehicle.plateImage}
              alt=""
              className="absolute inset-0 size-full object-cover"
              onError={(event) => {
                event.currentTarget.style.display = 'none';
              }}
            />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-semibold text-neutral-900">
            {vehicle.vehicleName || '-'}
          </p>
          <p className="text-deep-blue-500 mt-1 text-[12px] font-semibold">
            {vehicle.vehiclePlate}
          </p>
        </div>

        <ChevronRight className="size-5 shrink-0 text-neutral-600" />
      </div>
    </button>
  );
}

function VehiclePlaceholder({ className }: { className?: string }) {
  return (
    <div className={cn('flex size-full items-center justify-center bg-neutral-300', className)}>
      <Car className="size-7 text-neutral-600" />
    </div>
  );
}
