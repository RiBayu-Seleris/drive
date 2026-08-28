import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, Camera, Lightbulb, ShieldCheck } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { ROUTES } from '@/app/routes';
import { APP_FEATURES } from '@/config/constants';
import { CameraCapture } from '@/features/vehicle-scan/components/CameraCapture';
import { usePlateScan } from '@/features/vehicle-scan/hooks/usePlateScan';
import { useScanStore } from '@/features/vehicle-scan/store/scanStore';
import { normalizePlate } from '@/features/vehicle-scan/utils/plate';
import { useDamageStore } from '@/features/damage/store/damageStore';
import type { CapturedImage } from '@/features/vehicle-scan/types';
import { PlateCaptureArt } from '@/components/brand/PlateCaptureArt';

const PLATE_TIPS = [
  'Pastikan plat nomor terlihat jelas dan tidak terpotong',
  'Pastikan pencahayaan cukup, hindari bayangan',
  'Posisikan plat di dalam bingkai kamera',
];

interface LicensePlateState {
  /** Saat true (diarahkan ulang karena plat hilang), kamera langsung dibuka. */
  autoOpenCamera?: boolean;
}

export function LicensePlatePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const routeState = location.state as LicensePlateState | null;
  // Kendaraan yang dipilih di awal alur (dari store, bukan route state) → verifikasi plat.
  const selectedVehicle = useScanStore((s) => s.selectedVehicle);
  const expectedPlate =
    APP_FEATURES.savedVehicles && selectedVehicle?.plate
      ? normalizePlate(selectedVehicle.plate)
      : null;
  const selectedVehicleName = APP_FEATURES.savedVehicles ? (selectedVehicle?.name ?? null) : null;
  const reset = useScanStore((s) => s.reset);
  const resetDamage = useDamageStore((s) => s.reset);
  const plate = useScanStore((s) => s.plate);

  const {
    attempts,
    maxAttempts,
    isRecognizing,
    showManualInput,
    manualError,
    recognizeFromImage,
    confirmManualPlate,
  } = usePlateScan();

  const [cameraOpen, setCameraOpen] = useState(false);
  const [manualValue, setManualValue] = useState('');
  const [confirmedPlateValue, setConfirmedPlateValue] = useState('');
  const [verificationError, setVerificationError] = useState<string | null>(null);

  // Mulai alur dari kondisi bersih setiap masuk halaman plat.
  useEffect(() => {
    reset();
    resetDamage();
  }, [reset, resetDamage]);

  useEffect(() => {
    if (plate.number) setConfirmedPlateValue(plate.number);
  }, [plate.number]);

  // Diarahkan ulang dari Pratinjau karena plat hilang (refresh) → buka kamera.
  useEffect(() => {
    if (routeState?.autoOpenCamera) setCameraOpen(true);
  }, [routeState?.autoOpenCamera]);

  const verifySelectedVehicle = (detectedPlate: string | null): boolean => {
    if (!expectedPlate) return true;
    const normalized = detectedPlate ? normalizePlate(detectedPlate) : '';
    if (normalized === expectedPlate) {
      setVerificationError(null);
      return true;
    }

    setVerificationError(
      normalized
        ? `Plat terdeteksi ${normalized}, tidak sesuai dengan kendaraan yang dipilih (${expectedPlate}).`
        : `Plat tidak sesuai dengan kendaraan yang dipilih (${expectedPlate}).`,
    );
    return false;
  };

  const handleCapture = async (image: CapturedImage) => {
    setCameraOpen(false);
    setConfirmedPlateValue('');
    setVerificationError(null);
    const recognized = await recognizeFromImage(image);
    if (!recognized) return;
    const detectedPlate = useScanStore.getState().plate.number;
    if (!verifySelectedVehicle(detectedPlate)) return;
  };

  const submitPlate = (value: string): boolean => {
    if (!confirmManualPlate(value)) return false;
    const normalized = normalizePlate(value);
    if (!verifySelectedVehicle(normalized)) return false;
    navigate(ROUTES.vehicleSides);
    return true;
  };

  const handleManualSubmit = () => {
    if (submitPlate(manualValue)) setManualValue('');
  };

  const handleConfirmedPlateSubmit = () => {
    submitPlate(confirmedPlateValue);
  };

  return (
    <PageContainer>
      <div className="flex flex-1 flex-col p-6 text-center">
        <button type="button" onClick={() => navigate(ROUTES.home)}>
          <Logo className="mx-auto [&_img]:h-10" />
        </button>

        <p className="mt-10 text-xl leading-tight font-bold text-neutral-900">
          {expectedPlate ? 'Verifikasi Plat Kendaraan' : 'Foto Plat Nomor Kendaraan'}
        </p>
        <p className="mt-4 mb-[42px] text-sm leading-relaxed font-normal text-neutral-800">
          {expectedPlate
            ? 'Ambil foto plat kendaraan saat ini. Plat harus cocok dengan kendaraan yang dipilih.'
            : 'Ambil foto dengan jelas untuk mengurangi risiko fraud dan memastikan laporan kerusakan lebih akurat'}
        </p>

        {expectedPlate && (
          <div className="border-deep-blue-200 bg-deep-blue-50 text-deep-blue-700 mb-5 flex items-start gap-3 rounded-xl border p-3 text-left">
            <ShieldCheck className="mt-0.5 size-5 shrink-0" />
            <div>
              <p className="text-[12px] font-semibold">Kendaraan dipilih</p>
              <p className="mt-1 text-[12px]">
                {selectedVehicleName ? `${selectedVehicleName} · ` : ''}
                {expectedPlate}
              </p>
            </div>
          </div>
        )}

        <div className="flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-neutral-200">
          {plate.image ? (
            <img src={plate.image.url} alt="Foto plat" className="size-full object-cover" />
          ) : (
            <PlateCaptureArt className="size-full" />
          )}
        </div>

        {plate.image && isRecognizing && (
          <div className="text-12 text-deep-blue-600 mt-4 flex items-center justify-center gap-2">
            <Spinner className="size-5" /> Menganalisis plat nomor…
          </div>
        )}

        {plate.image && !plate.number && !isRecognizing && attempts > 0 && (
          <div className="bg-warning/10 text-12 mt-4 flex items-start gap-2 rounded-lg p-3 text-neutral-800">
            <AlertTriangle className="text-warning mt-0.5 size-5 shrink-0" />
            <p>
              Plat belum terbaca jelas. Percobaan{' '}
              <span className="font-semibold">
                {attempts}/{maxAttempts}
              </span>
              . {attempts < maxAttempts ? 'Coba ambil ulang foto.' : 'Silakan ketik plat manual.'}
            </p>
          </div>
        )}

        {plate.number && !isRecognizing && (
          <Card className="mt-4 text-left">
            <p className="text-sm font-semibold text-neutral-900">Cek nomor plat</p>
            <p className="mt-1 text-xs leading-relaxed text-neutral-600">
              Pastikan nomor plat sudah sesuai sebelum lanjut memotret kondisi kendaraan.
            </p>
            <Input
              containerClassName="mt-3"
              label="Nomor plat kendaraan"
              value={confirmedPlateValue}
              onChange={(e) => setConfirmedPlateValue(e.target.value.toUpperCase())}
              error={manualError ?? undefined}
              autoCapitalize="characters"
            />
            <Button
              className="mt-3"
              onClick={handleConfirmedPlateSubmit}
              disabled={!confirmedPlateValue.trim()}
            >
              Lanjutkan
            </Button>
          </Card>
        )}

        {verificationError && (
          <div className="bg-danger/10 text-12 mt-4 flex items-start gap-2 rounded-lg p-3 text-left text-neutral-800">
            <AlertTriangle className="text-danger mt-0.5 size-5 shrink-0" />
            <div>
              <p>{verificationError}</p>
              {APP_FEATURES.savedVehicles && (
                <button
                  type="button"
                  onClick={() => navigate(ROUTES.selectVehicle, { replace: true })}
                  className="text-deep-blue-500 mt-2 font-semibold"
                >
                  Pilih kendaraan lain
                </button>
              )}
            </div>
          </div>
        )}

        <div className="mt-6 flex items-center justify-center gap-1.5">
          <Lightbulb className="text-deep-blue-500 size-4" aria-hidden />
          <p className="text-sm">Tips foto plat kendaraan</p>
        </div>
        <ul className="mt-4 list-inside list-decimal space-y-2 text-start text-sm text-neutral-700">
          {(plate.image
            ? PLATE_TIPS
            : [
                'Ikuti contoh di atas agar hasil deteksi optimal',
                'Pastikan plat nomor terlihat jelas',
                'Pastikan cahaya cukup',
              ]
          ).map((tip) => (
            <li key={tip}>{tip}</li>
          ))}
        </ul>

        <div className="mt-auto flex flex-col gap-3 pt-16">
          {showManualInput && !plate.number && (
            <Card className="text-left">
              <p className="mb-2 text-xs font-semibold text-neutral-900">Ketik Plat Manual</p>
              <Input
                placeholder="Contoh: B 1234 ABC"
                value={manualValue}
                onChange={(e) => setManualValue(e.target.value.toUpperCase())}
                error={manualError ?? undefined}
                autoCapitalize="characters"
              />
              <Button className="mt-3" onClick={handleManualSubmit} disabled={!manualValue.trim()}>
                Gunakan Plat Ini
              </Button>
            </Card>
          )}
          <Button
            size="lg"
            leftIcon={<Camera className="size-5" />}
            onClick={() => setCameraOpen(true)}
            isLoading={isRecognizing}
          >
            {plate.image ? 'Ambil Ulang Foto Plat' : 'Ambil Foto Plat Kendaraan'}
          </Button>
        </div>
      </div>

      <CameraCapture
        open={cameraOpen}
        facingMode="environment"
        guideText="Posisikan plat nomor di dalam bingkai"
        cropToGuide
        guideFrameAspectRatio={3.2}
        confirmBeforeCapture
        confirmLabel="Gunakan Foto"
        retakeLabel="Ambil Ulang"
        onClose={() => setCameraOpen(false)}
        onCapture={handleCapture}
      />
    </PageContainer>
  );
}
