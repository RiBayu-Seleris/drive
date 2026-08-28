import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CarFront } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { ROUTES } from '@/app/routes';
import { useScanStore } from '@/features/vehicle-scan/store/scanStore';
import { VEHICLE_TYPES } from '@/features/vehicle/types';
import { hasCheckupPermissionsGranted } from '../permissions';

const currentYear = new Date().getFullYear();

export function VehicleDataPage() {
  const navigate = useNavigate();
  const vehicleInfo = useScanStore((s) => s.vehicleInfo);
  const selectedVehicle = useScanStore((s) => s.selectedVehicle);
  const setVehicleInfo = useScanStore((s) => s.setVehicleInfo);
  // Kendaraan tersimpan yang dipilih → prefill merk otomatis (tetap bisa diedit).
  const [brandModel, setBrandModel] = useState(selectedVehicle?.name || vehicleInfo.brandModel);
  const [color, setColor] = useState(vehicleInfo.color);
  const [year, setYear] = useState(vehicleInfo.year);
  const [type, setType] = useState(vehicleInfo.type || VEHICLE_TYPES[0]);

  const yearError = useMemo(() => {
    if (!year.trim()) return '';
    const value = Number(year);
    if (!Number.isInteger(value) || value < 1980 || value > currentYear + 1) {
      return `Tahun harus antara 1980-${currentYear + 1}.`;
    }
    return '';
  }, [year]);

  const canContinue = brandModel.trim().length >= 2 && color.trim().length >= 2 && !yearError;

  const handleContinue = () => {
    if (!canContinue) return;
    setVehicleInfo({
      brandModel,
      color,
      year,
      type,
    });
    navigate(hasCheckupPermissionsGranted() ? ROUTES.licensePlate : ROUTES.checkupPermission);
  };

  return (
    <PageContainer className="bg-neutral-200">
      <div className="flex min-h-dvh flex-col px-6 pt-8 pb-8 text-neutral-900">
        <button type="button" onClick={() => navigate(ROUTES.home)} className="mx-auto">
          <Logo className="[&_img]:h-11" />
        </button>

        <div className="mt-10 flex justify-center">
          <span className="bg-deep-blue-50 text-deep-blue-500 flex size-16 items-center justify-center rounded-full">
            <CarFront className="size-8" />
          </span>
        </div>

        <h1 className="mt-6 text-center text-2xl leading-tight font-bold">Data Kendaraan</h1>
        <p className="mt-3 text-center text-sm leading-relaxed text-neutral-700">
          Lengkapi data singkat kendaraan yang akan discan agar hasil pemeriksaan lebih mudah
          dikenali.
        </p>

        <div className="mt-8 flex flex-col gap-5">
          <Input
            label="Nama / Merk Kendaraan"
            requiredMark
            value={brandModel}
            placeholder="Contoh: Toyota Avanza"
            autoCapitalize="words"
            onChange={(event) => setBrandModel(event.currentTarget.value)}
          />
          <div className="text-left">
            <p className="text-14 mb-1.5 font-medium text-neutral-900">Jenis Kendaraan</p>
            <div className="flex flex-wrap gap-2">
              {VEHICLE_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={`text-12 rounded-full border px-4 py-2 font-medium ${
                    type === t
                      ? 'border-deep-blue-500 bg-deep-blue-50 text-deep-blue-600'
                      : 'border-neutral-400 text-neutral-700'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>
          <Input
            label="Warna Kendaraan"
            requiredMark
            value={color}
            placeholder="Contoh: Hitam"
            autoCapitalize="words"
            onChange={(event) => setColor(event.currentTarget.value)}
          />
          <Input
            label="Tahun Kendaraan"
            hint="Opsional"
            value={year}
            inputMode="numeric"
            maxLength={4}
            placeholder="Contoh: 2022"
            error={yearError || undefined}
            onChange={(event) => setYear(event.currentTarget.value.replace(/[^0-9]/g, ''))}
          />
        </div>

        <div className="mt-auto pt-10">
          <Button size="lg" disabled={!canContinue} onClick={handleContinue}>
            Lanjutkan
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
