import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertTriangle,
  Camera,
  CheckCircle2,
  ImagePlus,
  Loader2,
  ShieldCheck,
  ShieldX,
  X,
} from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { AppHeader } from '@/components/layout/AppHeader';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Spinner } from '@/components/ui/Spinner';
import { toast } from '@/components/feedback/toast';
import { extractErrorMessage } from '@/lib/api/client';
import { ROUTES } from '@/app/routes';
import { CameraCapture } from '@/features/vehicle-scan/components/CameraCapture';
import { useScanServices } from '@/features/vehicle-scan/services/scanServicesContext';
import { MAX_PLATE_ATTEMPTS, type InsuranceCoverage } from '@/features/vehicle-scan/services/types';
import type { CapturedImage } from '@/features/vehicle-scan/types';
import { normalizePlate, isValidPlate } from '@/features/vehicle-scan/utils/plate';
import { createVehicle, updateVehicle } from '../api';
import { VEHICLE_TYPES, hasPolis, type SavedVehicle, type VehicleFormInput } from '../types';

const currentYear = new Date().getFullYear();

type PlateScanStatus = 'idle' | 'reading' | 'success' | 'failed';
type InsuranceStatus = 'idle' | 'checking' | 'insured' | 'uninsured' | 'error';

export function VehicleFormPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const services = useScanServices();
  const initial = useLocation().state as SavedVehicle | null;
  const isEdit = Boolean(initial);

  const [plate, setPlate] = useState(initial?.vehiclePlate ?? '');
  const [name, setName] = useState(initial?.vehicleName ?? '');
  const [type, setType] = useState(initial?.vehicleType ?? VEHICLE_TYPES[0]);
  const [color, setColor] = useState(initial?.vehicleColor ?? '');
  // 0 dari backend berarti tahun belum pernah diisi → tampilkan kosong.
  const [year, setYear] = useState(initial?.vehicleYear ? String(initial.vehicleYear) : '');
  const [proofPhoto, setProofPhoto] = useState<CapturedImage | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [plateError, setPlateError] = useState<string | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [plateScanStatus, setPlateScanStatus] = useState<PlateScanStatus>('idle');
  const [recognizedPlate, setRecognizedPlate] = useState(initial?.vehiclePlate ?? '');
  const [confirmedPlateValue, setConfirmedPlateValue] = useState(initial?.vehiclePlate ?? '');
  const [manualValue, setManualValue] = useState('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [attempts, setAttempts] = useState(0);
  const [showManualInput, setShowManualInput] = useState(false);
  const [coveragePlate, setCoveragePlate] = useState(
    initial ? normalizePlate(initial.vehiclePlate) : '',
  );
  const [insuranceStatus, setInsuranceStatus] = useState<InsuranceStatus>(
    initial && hasPolis(initial) ? 'insured' : 'idle',
  );
  const [coverage, setCoverage] = useState<InsuranceCoverage | null>(
    initial && hasPolis(initial)
      ? {
          insured: true,
          policyNumber: initial.polisNumber,
          validUntil: initial.polisEnd,
        }
      : null,
  );

  const mutation = useMutation({
    mutationFn: (input: VehicleFormInput) => (isEdit ? updateVehicle(input) : createVehicle(input)),
    onSuccess: () => {
      toast.success(isEdit ? 'Kendaraan diperbarui.' : 'Kendaraan ditambahkan.');
      void queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      navigate(ROUTES.myVehicles, { replace: true });
    },
  });

  useEffect(() => {
    return () => {
      if (proofPhoto) URL.revokeObjectURL(proofPhoto.url);
    };
  }, [proofPhoto]);

  const checkInsuranceCoverage = async (
    rawPlate: string,
    options?: { silent?: boolean },
  ): Promise<InsuranceCoverage | null> => {
    const normalized = normalizePlate(rawPlate);
    if (!isValidPlate(normalized)) {
      setPlateError('Format plat tidak valid. Contoh: B 1234 ABC');
      setCoverage(null);
      setCoveragePlate('');
      setInsuranceStatus('idle');
      return null;
    }

    setPlateError(null);
    setInsuranceStatus('checking');
    try {
      const result = await services.insuranceCheck.checkByPlate(normalized);
      setCoverage(result);
      setCoveragePlate(normalized);
      setInsuranceStatus(result.insured ? 'insured' : 'uninsured');
      if (!options?.silent) {
        toast[result.insured ? 'success' : 'info'](
          result.insured
            ? 'Plat terdeteksi memiliki asuransi aktif.'
            : 'Plat belum terdeteksi memiliki asuransi aktif.',
        );
      }
      return result;
    } catch (error) {
      setCoverage(null);
      setCoveragePlate('');
      setInsuranceStatus('error');
      if (!options?.silent) {
        toast.error(extractErrorMessage(error, 'Gagal mengecek asuransi plat.'));
      }
      return null;
    }
  };

  const handleCaptureProof = async (image: CapturedImage) => {
    setCameraOpen(false);
    setPhotoError(null);
    setProofPhoto((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return image;
    });

    if (isEdit) return;

    setPlateScanStatus('reading');
    setPlate('');
    setRecognizedPlate('');
    setConfirmedPlateValue('');
    setManualError(null);
    setCoverage(null);
    setCoveragePlate('');
    setInsuranceStatus('idle');
    try {
      const result = await services.plateRecognition.recognize(image.blob);
      if (result.detected && result.plateNumber) {
        const normalized = normalizePlate(result.plateNumber);
        setRecognizedPlate(normalized);
        setConfirmedPlateValue(normalized);
        setPlateScanStatus('success');
        setAttempts(0);
        setShowManualInput(false);
        await checkInsuranceCoverage(normalized);
      } else {
        setRecognizedPlate('');
        setPlateScanStatus('failed');
        setAttempts((current) => {
          const next = current + 1;
          if (next >= MAX_PLATE_ATTEMPTS) setShowManualInput(true);
          return next;
        });
        toast.info('Plat belum terbaca jelas. Silakan isi nomor plat manual.');
      }
    } catch (error) {
      setRecognizedPlate('');
      setPlateScanStatus('failed');
      setAttempts((current) => {
        const next = current + 1;
        if (next >= MAX_PLATE_ATTEMPTS) setShowManualInput(true);
        return next;
      });
      toast.error(extractErrorMessage(error, 'Gagal membaca plat kendaraan.'));
    }
  };

  const clearProofPhoto = () => {
    setProofPhoto((current) => {
      if (current) URL.revokeObjectURL(current.url);
      return null;
    });
    if (!isEdit) {
      setPlate('');
      setPlateError(null);
      setRecognizedPlate('');
      setCoverage(null);
      setCoveragePlate('');
      setInsuranceStatus('idle');
      setPlateScanStatus('idle');
      setConfirmedPlateValue('');
      setManualValue('');
      setManualError(null);
      setAttempts(0);
      setShowManualInput(false);
    }
  };

  const confirmPlateValue = async (value: string): Promise<boolean> => {
    const normalized = normalizePlate(value);
    if (!isValidPlate(normalized)) {
      setManualError('Format plat tidak valid. Contoh: B 1234 ABC');
      return false;
    }

    setManualError(null);
    setPlateError(null);
    setPlate(normalized);
    setRecognizedPlate(normalized);
    setConfirmedPlateValue(normalized);
    setPlateScanStatus('success');
    setShowManualInput(false);
    await checkInsuranceCoverage(normalized);
    return true;
  };

  const handleConfirmedPlateSubmit = () => {
    void confirmPlateValue(confirmedPlateValue);
  };

  const handleManualSubmit = async () => {
    if (await confirmPlateValue(manualValue)) setManualValue('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalized = normalizePlate(plate);
    if (!isEdit && !isValidPlate(normalized)) {
      setPlateError('Format plat tidak valid. Contoh: B 1234 ABC');
      return;
    }
    if (!isEdit && !proofPhoto) {
      setPhotoError('Foto plat kendaraan wajib diambil.');
      return;
    }
    setPlateError(null);
    setPhotoError(null);
    setIsUploading(true);

    try {
      const vehiclePlate = isEdit ? (initial?.vehiclePlate ?? normalized) : normalized;
      const canUseDetectedCoverage =
        coveragePlate === vehiclePlate && coverage !== null && insuranceStatus !== 'error';
      let resolvedCoverage = isEdit
        ? coverage
        : canUseDetectedCoverage
          ? coverage
          : await checkInsuranceCoverage(vehiclePlate, { silent: true });
      if (!isEdit && !resolvedCoverage) {
        resolvedCoverage = { insured: false };
        setInsuranceStatus('uninsured');
        toast.warning('Cek asuransi belum berhasil. Kendaraan disimpan tanpa data polis dulu.');
      }

      let uploadedProof = initial?.plateImage ?? '';
      if (proofPhoto) {
        try {
          uploadedProof = await services.upload.upload(
            proofPhoto.blob,
            `vehicle_plate_${vehiclePlate}`,
          );
        } catch (error) {
          toast.warning(
            extractErrorMessage(
              error,
              'Foto plat belum bisa diunggah. Kendaraan tetap disimpan tanpa foto.',
            ),
          );
        }
      }

      await mutation.mutateAsync({
        vehiclePlate,
        vehicleName: name.trim(),
        vehicleType: type,
        vehicleColor: color.trim(),
        vehicleYear: year,
        vehicleRole: initial?.vehicleRole ?? 'private',
        polisNumber: resolvedCoverage?.insured ? resolvedCoverage.policyNumber : '-',
        polisEnd: resolvedCoverage?.insured ? resolvedCoverage.validUntil : '-',
        plateImage: uploadedProof,
      });
    } catch (error) {
      setIsUploading(false);
      toast.error(extractErrorMessage(error, 'Gagal menyimpan kendaraan.'));
    }
  };

  const handlePlateChange = (value: string) => {
    setPlate(value.toUpperCase());
    if (!isEdit) {
      setPlateScanStatus('idle');
      setRecognizedPlate('');
      setConfirmedPlateValue('');
      setCoverage(null);
      setCoveragePlate('');
      setInsuranceStatus('idle');
      setManualError(null);
    }
  };

  // Tahun opsional: hanya divalidasi kalau diisi.
  const yearError = useMemo(() => {
    if (!year.trim()) return '';
    const value = Number(year);
    if (!Number.isInteger(value) || value < 1980 || value > currentYear + 1) {
      return `Tahun harus antara 1980-${currentYear + 1}.`;
    }
    return '';
  }, [year]);

  const canSubmit =
    name.trim().length > 0 &&
    color.trim().length > 0 &&
    !yearError &&
    (isEdit || (plate.trim().length > 0 && Boolean(proofPhoto)));
  const isSaving =
    isUploading ||
    mutation.isPending ||
    plateScanStatus === 'reading' ||
    insuranceStatus === 'checking';
  const cachedProofUrl = initial?.plateImage ?? '';

  return (
    <PageContainer>
      <AppHeader title={isEdit ? 'Ubah Kendaraan' : 'Tambah Kendaraan'} />
      <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 px-5 py-5">
        {isEdit ? (
          <Input
            label="Plat Nomor"
            placeholder="B 1234 ABC"
            value={plate}
            disabled
            onChange={(e) => handlePlateChange(e.target.value)}
            error={plateError ?? undefined}
          />
        ) : (
          <>
            <VehicleProofPhotoField
              required
              photo={proofPhoto}
              cachedUrl={cachedProofUrl}
              error={photoError}
              onOpenCamera={() => setCameraOpen(true)}
              onClear={proofPhoto ? clearProofPhoto : undefined}
            />

            <VehiclePlateScanFeedback
              hasPhoto={Boolean(proofPhoto)}
              plateScanStatus={plateScanStatus}
              attempts={attempts}
              maxAttempts={MAX_PLATE_ATTEMPTS}
            />

            {recognizedPlate && plateScanStatus !== 'reading' ? (
              <VehiclePlateReviewCard
                value={confirmedPlateValue}
                error={manualError}
                isChecking={insuranceStatus === 'checking'}
                onChange={setConfirmedPlateValue}
                onConfirm={handleConfirmedPlateSubmit}
              />
            ) : null}

            {showManualInput && !recognizedPlate ? (
              <VehicleManualPlateCard
                value={manualValue}
                error={manualError}
                isChecking={insuranceStatus === 'checking'}
                onChange={setManualValue}
                onConfirm={handleManualSubmit}
              />
            ) : null}

            {plateError ? <p className="text-danger text-xs">{plateError}</p> : null}

            <InsuranceDetectionPanel
              plate={plate}
              coverage={coverage}
              recognizedPlate={recognizedPlate}
              coveragePlate={coveragePlate}
              plateScanStatus={plateScanStatus}
              insuranceStatus={insuranceStatus}
              onCheck={() => void checkInsuranceCoverage(plate)}
            />
          </>
        )}

        <Input
          label="Nama / Merk Kendaraan"
          requiredMark
          placeholder="Mis. Toyota Avanza"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <div>
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
          placeholder="Mis. Hitam"
          value={color}
          onChange={(e) => setColor(e.target.value)}
        />
        <Input
          label="Tahun Kendaraan"
          hint="Opsional"
          inputMode="numeric"
          maxLength={4}
          placeholder={`Mis. ${currentYear}`}
          value={year}
          onChange={(e) => setYear(e.target.value.replace(/\D/g, '').slice(0, 4))}
          error={yearError || undefined}
        />

        {isEdit ? (
          <VehicleProofPhotoField
            required={false}
            photo={proofPhoto}
            cachedUrl={cachedProofUrl}
            error={photoError}
            onOpenCamera={() => setCameraOpen(true)}
            onClear={proofPhoto ? clearProofPhoto : undefined}
          />
        ) : null}

        <div className="mt-auto pt-6">
          <Button type="submit" size="lg" disabled={!canSubmit || isSaving} isLoading={isSaving}>
            {isEdit ? 'Simpan Perubahan' : 'Tambah Kendaraan'}
          </Button>
        </div>
      </form>

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
        onCapture={handleCaptureProof}
      />
    </PageContainer>
  );
}

function InsuranceDetectionPanel({
  plate,
  coverage,
  recognizedPlate,
  coveragePlate,
  plateScanStatus,
  insuranceStatus,
  onCheck,
}: {
  plate: string;
  coverage: InsuranceCoverage | null;
  recognizedPlate: string;
  coveragePlate: string;
  plateScanStatus: PlateScanStatus;
  insuranceStatus: InsuranceStatus;
  onCheck: () => void;
}) {
  const checking = plateScanStatus === 'reading' || insuranceStatus === 'checking';
  const normalizedPlate = normalizePlate(plate);
  const canCheck = isValidPlate(normalizedPlate) && !checking && coveragePlate !== normalizedPlate;

  let icon = <ShieldX className="size-5 text-neutral-500" />;
  let title = 'Status Asuransi Plat';
  let description = 'Ambil foto plat untuk membaca nomor kendaraan dan status asuransi.';
  let toneClass = 'border-neutral-300 bg-white';

  if (plateScanStatus === 'reading') {
    icon = <Loader2 className="text-deep-blue-500 size-5 animate-spin" />;
    title = 'Membaca plat kendaraan';
    description = 'Pastikan foto plat terlihat jelas agar hasil OCR akurat.';
    toneClass = 'border-deep-blue-100 bg-deep-blue-50';
  } else if (insuranceStatus === 'checking') {
    icon = <Loader2 className="text-deep-blue-500 size-5 animate-spin" />;
    title = 'Mengecek asuransi';
    description = recognizedPlate
      ? `Output OCR: ${recognizedPlate}. Sistem sedang mencocokkan data polis aktif.`
      : 'Sistem sedang mencocokkan plat dengan data polis aktif.';
    toneClass = 'border-deep-blue-100 bg-deep-blue-50';
  } else if (insuranceStatus === 'insured') {
    icon = <ShieldCheck className="size-5 text-emerald-600" />;
    title = 'Asuransi Terdeteksi';
    description = `${recognizedPlate ? `Output OCR: ${recognizedPlate}. ` : ''}${coverage?.policyNumber ?? 'Polis aktif'}${
      coverage?.validUntil ? ` · Berlaku sampai ${formatVehicleDate(coverage.validUntil)}` : ''
    }`;
    toneClass = 'border-emerald-100 bg-emerald-50';
  } else if (insuranceStatus === 'uninsured') {
    icon = <ShieldX className="size-5 text-orange-500" />;
    title = 'Belum Ada Asuransi Aktif';
    description = `${recognizedPlate ? `Output OCR: ${recognizedPlate}. ` : ''}Kendaraan tetap dapat disimpan tanpa data polis.`;
    toneClass = 'border-orange-100 bg-orange-50';
  } else if (insuranceStatus === 'error') {
    icon = <ShieldX className="text-danger size-5" />;
    title = 'Cek Asuransi Gagal';
    description = 'Coba cek ulang setelah memastikan plat sudah benar.';
    toneClass = 'border-danger/20 bg-danger/5';
  } else if (plateScanStatus === 'success') {
    icon = <CheckCircle2 className="size-5 text-emerald-600" />;
    title = 'Plat Berhasil Dibaca';
    description = recognizedPlate
      ? `Output OCR: ${recognizedPlate}. Anda masih bisa mengoreksi sebelum menyimpan.`
      : 'Plat sudah terisi otomatis. Anda masih bisa mengoreksi sebelum menyimpan.';
    toneClass = 'border-emerald-100 bg-emerald-50';
  } else if (plateScanStatus === 'failed') {
    title = 'Plat Belum Terbaca';
    description = 'Isi nomor plat manual, lalu cek asuransi.';
    toneClass = 'border-orange-100 bg-orange-50';
  }

  return (
    <div className={`rounded-xl border p-3 ${toneClass}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">{icon}</div>
        <div className="min-w-0 flex-1">
          <p className="text-13 font-semibold text-neutral-900">{title}</p>
          <p className="mt-1 text-[11px] leading-relaxed text-neutral-700">{description}</p>
        </div>
        {canCheck ? (
          <button
            type="button"
            onClick={onCheck}
            className="text-deep-blue-500 shrink-0 text-[11px] font-semibold"
          >
            Cek
          </button>
        ) : null}
      </div>
    </div>
  );
}

function VehiclePlateScanFeedback({
  hasPhoto,
  plateScanStatus,
  attempts,
  maxAttempts,
}: {
  hasPhoto: boolean;
  plateScanStatus: PlateScanStatus;
  attempts: number;
  maxAttempts: number;
}) {
  if (hasPhoto && plateScanStatus === 'reading') {
    return (
      <div className="text-12 text-deep-blue-600 flex items-center justify-center gap-2">
        <Spinner className="size-5" /> Menganalisis plat nomor…
      </div>
    );
  }

  if (hasPhoto && plateScanStatus === 'failed' && attempts > 0) {
    return (
      <div className="bg-warning/10 text-12 flex items-start gap-2 rounded-lg p-3 text-neutral-800">
        <AlertTriangle className="text-warning mt-0.5 size-5 shrink-0" />
        <p>
          Plat belum terbaca jelas. Percobaan{' '}
          <span className="font-semibold">
            {attempts}/{maxAttempts}
          </span>
          . {attempts < maxAttempts ? 'Coba ambil ulang foto.' : 'Silakan ketik plat manual.'}
        </p>
      </div>
    );
  }

  return null;
}

function VehiclePlateReviewCard({
  value,
  error,
  isChecking,
  onChange,
  onConfirm,
}: {
  value: string;
  error: string | null;
  isChecking: boolean;
  onChange: (value: string) => void;
  onConfirm: () => void;
}) {
  return (
    <Card className="text-left">
      <p className="text-sm font-semibold text-neutral-900">Cek nomor plat</p>
      <p className="mt-1 text-xs leading-relaxed text-neutral-600">
        Pastikan nomor plat sudah sesuai sebelum menyimpan kendaraan.
      </p>
      <Input
        containerClassName="mt-3"
        label="Nomor plat kendaraan"
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        error={error ?? undefined}
        autoCapitalize="characters"
      />
      <Button
        type="button"
        className="mt-3"
        onClick={onConfirm}
        disabled={!value.trim()}
        isLoading={isChecking}
      >
        Gunakan Plat Ini
      </Button>
    </Card>
  );
}

function VehicleManualPlateCard({
  value,
  error,
  isChecking,
  onChange,
  onConfirm,
}: {
  value: string;
  error: string | null;
  isChecking: boolean;
  onChange: (value: string) => void;
  onConfirm: () => void;
}) {
  return (
    <Card className="text-left">
      <p className="mb-2 text-xs font-semibold text-neutral-900">Ketik Plat Manual</p>
      <Input
        placeholder="Contoh: B 1234 ABC"
        value={value}
        onChange={(e) => onChange(e.target.value.toUpperCase())}
        error={error ?? undefined}
        autoCapitalize="characters"
      />
      <Button
        type="button"
        className="mt-3"
        onClick={onConfirm}
        disabled={!value.trim()}
        isLoading={isChecking}
      >
        Gunakan Plat Ini
      </Button>
    </Card>
  );
}

function VehicleProofPhotoField({
  required,
  photo,
  cachedUrl,
  error,
  onOpenCamera,
  onClear,
}: {
  required: boolean;
  photo: CapturedImage | null;
  cachedUrl: string;
  error: string | null;
  onOpenCamera: () => void;
  onClear?: () => void;
}) {
  const hasPhoto = Boolean(photo || cachedUrl);

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-3">
        <p className="text-14 font-medium text-neutral-900">
          Foto Plat Kendaraan {required ? <span className="text-danger">*</span> : null}
        </p>
        <button
          type="button"
          onClick={onOpenCamera}
          className="text-deep-blue-500 flex items-center gap-1.5 text-[12px] font-semibold"
        >
          <Camera className="size-4" />
          {hasPhoto ? 'Ganti Foto' : 'Ambil Foto'}
        </button>
      </div>
      <p className="mb-2 text-[11px] leading-relaxed text-neutral-600">
        Ambil foto plat kendaraan dengan posisi lurus dan nomor terbaca jelas.
      </p>

      <div className="relative aspect-video overflow-hidden rounded-xl border border-neutral-400 bg-neutral-300">
        {photo ? (
          <img src={photo.url} alt="Foto plat kendaraan" className="size-full object-cover" />
        ) : cachedUrl ? (
          <img
            src={cachedUrl}
            alt="Foto plat kendaraan"
            className="size-full object-cover"
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <div className="flex size-full flex-col items-center justify-center text-neutral-600">
            <ImagePlus className="size-8" />
            <p className="mt-2 text-[12px]">Belum ada foto plat</p>
          </div>
        )}

        <div className="absolute right-2 bottom-2 flex items-center gap-2">
          {onClear ? (
            <button
              type="button"
              aria-label="Hapus foto"
              onClick={onClear}
              className="text-danger flex size-9 items-center justify-center rounded-full bg-white shadow"
            >
              <X className="size-5" />
            </button>
          ) : null}
          <button
            type="button"
            aria-label={hasPhoto ? 'Ganti foto' : 'Ambil foto'}
            onClick={onOpenCamera}
            className="bg-deep-blue-500 flex size-9 items-center justify-center rounded-full text-white shadow"
          >
            <Camera className="size-5" />
          </button>
        </div>
      </div>

      {error ? <p className="text-danger mt-1 text-xs">{error}</p> : null}
    </div>
  );
}

function formatVehicleDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}
