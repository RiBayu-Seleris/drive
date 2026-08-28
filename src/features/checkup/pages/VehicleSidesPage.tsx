import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Clock3, X } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Logo } from '@/components/brand/Logo';
import { ROUTES } from '@/app/routes';
import { getAccuratePosition, type GeoPosition } from '@/lib/geo/geolocation';
import { reverseGeocode } from '@/lib/geo/nominatim';
import { CameraCapture } from '@/features/vehicle-scan/components/CameraCapture';
import { isInsuranceScan, useScanStore } from '@/features/vehicle-scan/store/scanStore';
import type { CapturedImage, VehicleSideId } from '@/features/vehicle-scan/types';

const SIDE_IMAGE: Record<VehicleSideId, string> = {
  front: '/assets/checkup_vehicle/front_damaged_car.png',
  right: '/assets/checkup_vehicle/right_damaged_car.png',
  left: '/assets/checkup_vehicle/left_damaged_car.png',
  rear: '/assets/checkup_vehicle/rear_damaged_car.png',
};

const SIDE_HINT: Record<VehicleSideId, string> = {
  front: 'Pastikan seluruh bagian depan mobil terlihat penuh',
  right: 'Ambil dari jarak 2-3 meter agar sisi kanan mobil utuh terlihat',
  left: 'Ambil dari jarak 2-3 meter agar sisi kiri mobil utuh terlihat',
  rear: 'Pastikan seluruh bagian belakang mobil terlihat penuh',
};

function formatCaptureTime(date: Date): string {
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return `${day}-${month}-${year}, ${hour}.${minute} WIB`;
}

function formatCoordinates(position: GeoPosition | null): string {
  if (!position) return '';
  return `${position.latitude.toFixed(6)}, ${position.longitude.toFixed(6)}`;
}

export function VehicleSidesPage() {
  const navigate = useNavigate();
  const plate = useScanStore((s) => s.plate);
  const vehicleInfo = useScanStore((s) => s.vehicleInfo);
  const sides = useScanStore((s) => s.sides);
  const currentIndex = useScanStore((s) => s.currentSideIndex);
  const scanPurpose = useScanStore((s) => s.scanPurpose);
  const answerSide = useScanStore((s) => s.answerSide);
  const setSidePhoto = useScanStore((s) => s.setSidePhoto);
  const goToNextSide = useScanStore((s) => s.goToNextSide);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [captureTime, setCaptureTime] = useState(() => new Date());
  const [position, setPosition] = useState<GeoPosition | null>(null);
  const [locationLabel, setLocationLabel] = useState('Mendeteksi lokasi...');
  const current = sides[currentIndex];
  // Alur foto 4 sisi berlaku untuk kedua jalur asuransi (beli & darurat).
  const insuranceMode = isInsuranceScan(scanPurpose);
  const vehicleTitle = useMemo(() => {
    const base = vehicleInfo.brandModel.trim() || 'Kendaraan belum teridentifikasi';
    return plate.number ? `${base} (${plate.number})` : base;
  }, [plate.number, vehicleInfo.brandModel]);
  const vehicleMeta = [vehicleInfo.color, vehicleInfo.year].filter(Boolean).join(' · ');

  useEffect(() => {
    const timer = window.setInterval(() => setCaptureTime(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let active = true;
    void (async () => {
      try {
        const currentPosition = await getAccuratePosition({
          desiredAccuracyM: 25,
          timeoutMs: 8_000,
        });
        if (!active) return;
        setPosition(currentPosition);
        const place = await reverseGeocode(currentPosition.latitude, currentPosition.longitude);
        if (!active) return;
        setLocationLabel(place?.displayName || formatCoordinates(currentPosition));
      } catch {
        if (active) setLocationLabel('Lokasi belum tersedia');
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const advance = () => {
    if (currentIndex < sides.length - 1) {
      goToNextSide();
    } else {
      navigate(ROUTES.previewVehicle);
    }
  };

  const handleDamaged = () => {
    answerSide(currentIndex, true);
    setCameraOpen(true);
  };

  const handleNotDamaged = () => {
    answerSide(currentIndex, false);
    advance();
  };

  const handleCapture = (image: CapturedImage) => {
    if (insuranceMode) answerSide(currentIndex, false);
    setSidePhoto(currentIndex, image);
    setCameraOpen(false);
    advance();
  };

  if (!current) return null;

  return (
    <PageContainer>
      <div className="flex min-h-dvh w-full flex-col items-center p-6 text-center text-neutral-800">
        <button type="button" onClick={() => navigate(ROUTES.home)}>
          <Logo className="[&_img]:h-10" />
        </button>
        <h3 className="mt-10 text-2xl leading-tight font-bold text-neutral-900">
          {insuranceMode ? 'Scan Kelayakan Asuransi' : 'Foto Kendaraan Anda'}
        </h3>
        <p className="mt-4 text-sm leading-relaxed font-normal">
          {insuranceMode
            ? 'Ambil foto setiap sisi kendaraan untuk memastikan hasil damage 0%.'
            : 'Untuk analisis kerusakan, ambil gambar dari beberapa sudut kendaraan anda'}
        </p>

        <div className="mt-6 w-full rounded-lg border border-neutral-300 bg-neutral-100 p-4 text-left shadow-sm">
          <p className="text-deep-blue-500 text-center text-sm font-semibold">Pemeriksaan AI</p>
          <div className="mt-4 border-t border-neutral-300 pt-4">
            <p className="text-[10px] font-semibold tracking-wide text-neutral-500 uppercase">
              Vehicle
            </p>
            <p className="mt-1 text-xs font-semibold text-neutral-900">{vehicleTitle}</p>
            {vehicleMeta && <p className="mt-1 text-[11px] text-neutral-600">{vehicleMeta}</p>}
          </div>
          <div className="mt-4">
            <p className="text-[10px] font-semibold tracking-wide text-neutral-500 uppercase">
              Location's Coordinates
            </p>
            <div className="mt-1 flex items-start gap-2">
              <div className="min-w-0">
                <p className="line-clamp-2 text-xs font-medium text-neutral-900">{locationLabel}</p>
                {position && (
                  <p className="mt-1 text-[11px] text-neutral-600">{formatCoordinates(position)}</p>
                )}
              </div>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-[10px] font-semibold tracking-wide text-neutral-500 uppercase">
              Waktu Pengambilan Gambar
            </p>
            <div className="mt-1 flex items-center gap-2 text-xs font-medium text-neutral-900">
              <Clock3 className="text-deep-blue-500 size-4" />
              {formatCaptureTime(captureTime)}
            </div>
          </div>
        </div>

        <h5 className="text-md mt-10 font-[600] text-[#eef4f8]">{current.label}</h5>
        <h5 className="mt-1 text-sm font-[400] text-[#eef4f8]">{SIDE_HINT[current.id]}</h5>
        <img src={SIDE_IMAGE[current.id]} alt={current.label} className="mt-6" />
        <p className="mt-6 text-xs font-semibold">
          {insuranceMode ? 'Ambil foto bagian ini' : 'Apakah Bagian Ini Mengalami Kerusakan?'}
        </p>

        {insuranceMode ? (
          <button
            type="button"
            className="bg-deep-blue-500 mt-10 flex w-full items-center justify-center gap-2 rounded-lg p-3 text-sm text-[#10200a]"
            onClick={() => setCameraOpen(true)}
          >
            Ambil Foto
          </button>
        ) : (
          <div className="mt-10 flex w-full gap-3 text-white">
            <button
              type="button"
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#3adfac] p-3 text-sm"
              onClick={handleDamaged}
            >
              <Check className="size-6" />
              Ya
            </button>
            <button
              type="button"
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#df3a3a] p-3 text-sm"
              onClick={handleNotDamaged}
            >
              <X className="size-6" />
              Tidak
            </button>
          </div>
        )}
      </div>

      <CameraCapture
        open={cameraOpen}
        facingMode="environment"
        guideText={`Foto ${current.label.toLowerCase()}`}
        onClose={() => setCameraOpen(false)}
        onCapture={handleCapture}
      />
    </PageContainer>
  );
}
