import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Camera, Check, FileImage, FileText, Hash, Upload } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { toast } from '@/components/feedback/toast';
import { extractErrorMessage } from '@/lib/api/client';
import { ROUTES } from '@/app/routes';
import { CameraCapture } from '@/features/vehicle-scan/components/CameraCapture';
import type { CapturedImage } from '@/features/vehicle-scan/types';
import {
  recognizeClaimChassisNumber,
  recognizeClaimEngineNumber,
  uploadClaimEvidence,
  type ClaimDocumentType,
} from '../api';
import { claimDocumentsList, useClaimDraftStore } from '../store/claimDraftStore';

const DOCUMENTS: Array<{ type: ClaimDocumentType; label: string }> = [
  { type: 'KTP', label: 'KTP' },
  { type: 'SIM', label: 'SIM' },
  { type: 'STNK', label: 'STNK' },
];

type DocumentInputMode = 'camera' | 'file';
type CameraTarget =
  | { kind: 'document'; type: ClaimDocumentType }
  | { kind: 'engine' }
  | { kind: 'chassis' };

interface DocumentPreview {
  url: string;
  kind: 'image' | 'pdf';
  name: string;
}

function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

/** Rasio kartu identitas Indonesia (85,6 x 54 mm) — KTP, SIM, dan STNK. */
const DOCUMENT_FRAME_RATIO = 1.58;

export function ClaimDocumentsPage() {
  const navigate = useNavigate();
  const documents = useClaimDraftStore((state) => state.documents);
  const engineNumber = useClaimDraftStore((state) => state.engineNumber);
  const engineNumberImageUrl = useClaimDraftStore((state) => state.engineNumberImageUrl);
  const engineNumberOcrConfidence = useClaimDraftStore((state) => state.engineNumberOcrConfidence);
  const chassisNumber = useClaimDraftStore((state) => state.chassisNumber);
  const chassisNumberImageUrl = useClaimDraftStore((state) => state.chassisNumberImageUrl);
  const chassisNumberOcrConfidence = useClaimDraftStore(
    (state) => state.chassisNumberOcrConfidence,
  );
  const setDocument = useClaimDraftStore((state) => state.setDocument);
  const setEngineEvidence = useClaimDraftStore((state) => state.setEngineEvidence);
  const setChassisEvidence = useClaimDraftStore((state) => state.setChassisEvidence);
  const [uploading, setUploading] = useState<ClaimDocumentType | null>(null);
  const [engineUploading, setEngineUploading] = useState(false);
  const [chassisUploading, setChassisUploading] = useState(false);
  const [previews, setPreviews] = useState<Partial<Record<ClaimDocumentType, DocumentPreview>>>({});
  const [enginePreview, setEnginePreview] = useState<DocumentPreview | null>(null);
  const [chassisPreview, setChassisPreview] = useState<DocumentPreview | null>(null);
  const [engineDraftValue, setEngineDraftValue] = useState(engineNumber);
  const [engineDraftConfidence, setEngineDraftConfidence] = useState<number | null>(
    engineNumberOcrConfidence,
  );
  const [engineNeedsConfirmation, setEngineNeedsConfirmation] = useState(false);
  const [cameraTarget, setCameraTarget] = useState<CameraTarget | null>(null);
  const [chassisDraftValue, setChassisDraftValue] = useState(chassisNumber);
  const [chassisDraftConfidence, setChassisDraftConfidence] = useState<number | null>(
    chassisNumberOcrConfidence,
  );
  const [chassisNeedsConfirmation, setChassisNeedsConfirmation] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const selectedType = useRef<ClaimDocumentType>('KTP');
  const selectedMode = useRef<DocumentInputMode>('camera');
  const previewUrls = useRef<string[]>([]);
  const documentsComplete = claimDocumentsList(documents).length === 3;
  const engineComplete =
    engineNumber.trim().length >= 5 && Boolean(engineNumberImageUrl) && !engineNeedsConfirmation;
  const chassisComplete =
    chassisNumber.trim().length >= 5 && Boolean(chassisNumberImageUrl) && !chassisNeedsConfirmation;

  useEffect(
    () => () => {
      previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );

  useEffect(() => {
    if (!engineNeedsConfirmation) {
      setEngineDraftValue(engineNumber);
      setEngineDraftConfidence(engineNumberOcrConfidence);
    }
  }, [engineNeedsConfirmation, engineNumber, engineNumberOcrConfidence]);

  useEffect(() => {
    if (!chassisNeedsConfirmation) {
      setChassisDraftValue(chassisNumber);
      setChassisDraftConfidence(chassisNumberOcrConfidence);
    }
  }, [chassisNeedsConfirmation, chassisNumber, chassisNumberOcrConfidence]);

  const choose = (type: ClaimDocumentType, mode: DocumentInputMode) => {
    selectedType.current = type;
    selectedMode.current = mode;
    if (mode === 'camera') {
      setCameraTarget({ kind: 'document', type });
      return;
    }
    fileInputRef.current?.click();
  };

  const upload = async (file?: File) => {
    if (!file) return;
    const type = selectedType.current;
    const mode = selectedMode.current;
    const cameraFileValid = file.type.startsWith('image/');
    const fileValid = file.type.startsWith('image/') || isPdf(file);
    if ((mode === 'camera' && !cameraFileValid) || (mode === 'file' && !fileValid)) {
      toast.warning('Gunakan file gambar atau PDF yang valid.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.warning('Ukuran dokumen maksimal 10 MB.');
      return;
    }
    setUploading(type);
    try {
      const extension = file.name.split('.').pop() || 'jpg';
      const fileUrl = await uploadClaimEvidence(
        file,
        `claim_${type.toLowerCase()}`,
        `${type}.${extension}`,
      );
      setDocument({ documentType: type, fileUrl });
      const previewUrl = URL.createObjectURL(file);
      previewUrls.current.push(previewUrl);
      setPreviews((current) => {
        const previousUrl = current[type]?.url;
        if (previousUrl) URL.revokeObjectURL(previousUrl);
        return {
          ...current,
          [type]: {
            url: previewUrl,
            kind: isPdf(file) ? 'pdf' : 'image',
            name: file.name || `${type}.${extension}`,
          },
        };
      });
      toast.success(`${type} berhasil diunggah.`);
    } catch (error) {
      toast.error(extractErrorMessage(error, `Gagal mengunggah ${type}.`));
    } finally {
      setUploading(null);
    }
  };

  const uploadEngineNumber = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.warning('Gunakan foto nomor mesin yang valid.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.warning('Ukuran foto nomor mesin maksimal 10 MB.');
      return;
    }

    setEngineUploading(true);
    try {
      const extension = file.name.split('.').pop() || 'jpg';
      const filename = `nomor-mesin.${extension}`;
      const fileUrl = await uploadClaimEvidence(file, 'claim_engine_number', filename);
      const previewUrl = URL.createObjectURL(file);
      previewUrls.current.push(previewUrl);
      setEnginePreview((current) => {
        if (current?.url) URL.revokeObjectURL(current.url);
        return { url: previewUrl, kind: 'image', name: file.name || filename };
      });

      try {
        const result = await recognizeClaimEngineNumber(file, filename);
        const recognized = result.engineNumber.toUpperCase().replace(/[^A-Z0-9-]/g, '');
        setEngineDraftValue(recognized);
        setEngineDraftConfidence(recognized ? result.confidence : null);
        setEngineNeedsConfirmation(true);
        setEngineEvidence({
          imageUrl: fileUrl,
          engineNumber: '',
          confidence: null,
        });
        if (recognized) {
          toast.success('Nomor mesin berhasil terbaca. Pastikan hasilnya sebelum lanjut.');
        } else {
          toast.warning('Foto nomor mesin tersimpan. Isi nomor mesin secara manual.');
        }
      } catch (error) {
        setEngineDraftValue('');
        setEngineDraftConfidence(null);
        setEngineNeedsConfirmation(true);
        setEngineEvidence({ imageUrl: fileUrl, engineNumber: '', confidence: null });
        toast.warning(
          extractErrorMessage(error, 'Foto nomor mesin tersimpan. Isi nomor mesin secara manual.'),
        );
      }
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Gagal mengunggah foto nomor mesin.'));
    } finally {
      setEngineUploading(false);
    }
  };

  const uploadChassisNumber = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.warning('Gunakan foto nomor rangka/VIN yang valid.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.warning('Ukuran foto nomor rangka/VIN maksimal 10 MB.');
      return;
    }

    setChassisUploading(true);
    try {
      const extension = file.name.split('.').pop() || 'jpg';
      const filename = `nomor-rangka.${extension}`;
      const fileUrl = await uploadClaimEvidence(file, 'claim_chassis_number', filename);
      const previewUrl = URL.createObjectURL(file);
      previewUrls.current.push(previewUrl);
      setChassisPreview((current) => {
        if (current?.url) URL.revokeObjectURL(current.url);
        return { url: previewUrl, kind: 'image', name: file.name || filename };
      });

      try {
        const result = await recognizeClaimChassisNumber(file, filename);
        const recognized = result.chassisNumber.toUpperCase().replace(/[^A-Z0-9]/g, '');
        setChassisDraftValue(recognized);
        setChassisDraftConfidence(recognized ? result.confidence : null);
        setChassisNeedsConfirmation(true);
        setChassisEvidence({
          imageUrl: fileUrl,
          chassisNumber: '',
          confidence: null,
        });
        if (recognized) {
          toast.success('Nomor rangka/VIN berhasil terbaca. Pastikan hasilnya sebelum lanjut.');
        } else {
          toast.warning('Foto nomor rangka/VIN tersimpan. Isi nomor rangka secara manual.');
        }
      } catch (error) {
        setChassisDraftValue('');
        setChassisDraftConfidence(null);
        setChassisNeedsConfirmation(true);
        setChassisEvidence({ imageUrl: fileUrl, chassisNumber: '', confidence: null });
        toast.warning(
          extractErrorMessage(
            error,
            'Foto nomor rangka/VIN tersimpan. Isi nomor rangka secara manual.',
          ),
        );
      }
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Gagal mengunggah foto nomor rangka/VIN.'));
    } finally {
      setChassisUploading(false);
    }
  };

  const handleEngineDraftChange = (value: string) => {
    const normalized = value.toUpperCase().replace(/[^A-Z0-9-]/g, '');
    setEngineDraftValue(normalized);
    setEngineNeedsConfirmation(true);
    if (engineNumber) {
      setEngineEvidence({ engineNumber: '', confidence: null });
    }
  };

  const confirmEngineNumber = () => {
    const normalized = engineDraftValue.trim();
    if (!engineNumberImageUrl) {
      toast.warning('Ambil foto nomor mesin terlebih dahulu.');
      return;
    }
    if (normalized.length < 5) {
      toast.warning('Nomor mesin belum lengkap.');
      return;
    }
    setEngineEvidence({
      engineNumber: normalized,
      confidence: engineDraftConfidence,
    });
    setEngineNeedsConfirmation(false);
    toast.success('Nomor mesin sudah dikonfirmasi.');
  };

  const handleChassisDraftChange = (value: string) => {
    const normalized = value.toUpperCase().replace(/[^A-Z0-9]/g, '');
    setChassisDraftValue(normalized);
    setChassisNeedsConfirmation(true);
    if (chassisNumber) {
      setChassisEvidence({ chassisNumber: '', confidence: null });
    }
  };

  const confirmChassisNumber = () => {
    const normalized = chassisDraftValue.trim();
    if (!chassisNumberImageUrl) {
      toast.warning('Ambil foto nomor rangka/VIN terlebih dahulu.');
      return;
    }
    if (normalized.length < 5) {
      toast.warning('Nomor rangka/VIN belum lengkap.');
      return;
    }
    setChassisEvidence({
      chassisNumber: normalized,
      confidence: chassisDraftConfidence,
    });
    setChassisNeedsConfirmation(false);
    toast.success('Nomor rangka/VIN sudah dikonfirmasi.');
  };

  const isDocumentCapture = cameraTarget?.kind === 'document';

  const cameraGuideText = (() => {
    if (!cameraTarget) return '';
    if (cameraTarget.kind === 'engine') return 'Foto nomor mesin dengan jelas';
    if (cameraTarget.kind === 'chassis') return 'Foto nomor rangka/VIN dengan jelas';
    return `Foto dokumen ${cameraTarget.type}`;
  })();

  const fileFromCapture = (image: CapturedImage, basename: string): File =>
    new File([image.blob], `${basename}.jpg`, { type: 'image/jpeg' });

  const handleCameraCapture = (image: CapturedImage) => {
    const target = cameraTarget;
    setCameraTarget(null);
    URL.revokeObjectURL(image.url);
    if (!target) return;

    if (target.kind === 'document') {
      selectedType.current = target.type;
      selectedMode.current = 'camera';
      void upload(fileFromCapture(image, target.type.toLowerCase()));
      return;
    }
    if (target.kind === 'engine') {
      void uploadEngineNumber(fileFromCapture(image, 'nomor-mesin'));
      return;
    }
    void uploadChassisNumber(fileFromCapture(image, 'nomor-rangka'));
  };

  return (
    <PageContainer>
      <AppHeader title="Upload Dokumen" />
      <div className="flex flex-1 flex-col px-5 py-5">
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,application/pdf,.pdf"
          className="hidden"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            void upload(file);
          }}
        />
        <div className="grid grid-cols-2 gap-4">
          {DOCUMENTS.map(({ type, label }) => {
            const complete = Boolean(documents[type]);
            const preview = previews[type];
            const isUploading = uploading === type;
            return (
              <section key={type} className="min-w-0">
                <div className="relative flex aspect-[1.58] flex-col items-center justify-center overflow-hidden rounded-lg border border-dashed border-neutral-400 bg-neutral-100 text-neutral-700">
                  {preview?.kind === 'image' ? (
                    <img
                      src={preview.url}
                      alt={label}
                      className="absolute inset-0 size-full object-cover"
                    />
                  ) : preview?.kind === 'pdf' ? (
                    <div className="flex flex-col items-center gap-2 text-center">
                      <FileText className="text-deep-blue-500 size-9" />
                      <span className="text-12 font-semibold text-neutral-800">PDF</span>
                    </div>
                  ) : (
                    <>
                      <FileImage className="mb-2 size-7" />
                      <span className="text-14 font-medium">
                        {isUploading ? 'Mengunggah...' : label}
                      </span>
                    </>
                  )}
                  {complete && (
                    <span className="bg-success absolute top-2 right-2 flex size-7 items-center justify-center rounded-full text-white">
                      <Check className="size-4" />
                    </span>
                  )}
                </div>

                <div className="mt-2 grid grid-cols-2 gap-2">
                  <Button
                    size="sm"
                    variant="secondary"
                    disabled={uploading !== null}
                    isLoading={isUploading && selectedMode.current === 'camera'}
                    leftIcon={<Camera className="size-4" />}
                    className="h-9 px-2 text-[11px]"
                    onClick={() => choose(type, 'camera')}
                  >
                    Foto
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={uploading !== null}
                    isLoading={isUploading && selectedMode.current === 'file'}
                    leftIcon={<Upload className="size-4" />}
                    className="h-9 px-2 text-[11px]"
                    onClick={() => choose(type, 'file')}
                  >
                    File
                  </Button>
                </div>
              </section>
            );
          })}
        </div>

        <section className="mt-5">
          <h2 className="text-16 mb-3 font-semibold text-neutral-900">Identitas Kendaraan</h2>
          <div className="grid grid-cols-[112px_minmax(0,1fr)] gap-3">
            <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-dashed border-neutral-400 bg-neutral-100 text-neutral-700">
              {enginePreview?.url || engineNumberImageUrl ? (
                <img
                  src={enginePreview?.url ?? engineNumberImageUrl}
                  alt="Nomor mesin"
                  className="absolute inset-0 size-full object-cover"
                />
              ) : (
                <FileImage className="size-7" />
              )}
              {engineComplete && (
                <span className="bg-success absolute top-2 right-2 flex size-7 items-center justify-center rounded-full text-white">
                  <Check className="size-4" />
                </span>
              )}
            </div>
            <div className="flex min-w-0 flex-col gap-3">
              <Input
                label="Nomor mesin"
                value={engineDraftValue}
                maxLength={64}
                placeholder="Contoh: L15A1234567"
                leftIcon={<Hash className="size-4" />}
                disabled={engineUploading}
                onChange={(event) => handleEngineDraftChange(event.currentTarget.value)}
                hint={
                  engineDraftConfidence
                    ? `OCR ${(engineDraftConfidence * 100).toFixed(0)}%`
                    : undefined
                }
              />
              {engineNumberImageUrl && (
                <Button
                  size="sm"
                  variant={engineComplete ? 'outline' : 'primary'}
                  disabled={engineUploading || engineDraftValue.trim().length < 5}
                  leftIcon={<Check className="size-4" />}
                  className="h-9 px-2 text-[11px]"
                  onClick={confirmEngineNumber}
                >
                  {engineComplete ? 'Nomor Mesin Sesuai' : 'Konfirmasi Nomor Mesin'}
                </Button>
              )}
              <Button
                size="sm"
                variant="secondary"
                disabled={uploading !== null || engineUploading || chassisUploading}
                isLoading={engineUploading}
                leftIcon={<Camera className="size-4" />}
                className="h-9 px-2 text-[11px]"
                onClick={() => setCameraTarget({ kind: 'engine' })}
              >
                Foto Nomor Mesin
              </Button>
            </div>
          </div>
          <div className="mt-5 grid grid-cols-[112px_minmax(0,1fr)] gap-3">
            <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-lg border border-dashed border-neutral-400 bg-neutral-100 text-neutral-700">
              {chassisPreview?.url || chassisNumberImageUrl ? (
                <img
                  src={chassisPreview?.url ?? chassisNumberImageUrl}
                  alt="Nomor rangka/VIN"
                  className="absolute inset-0 size-full object-cover"
                />
              ) : (
                <FileImage className="size-7" />
              )}
              {chassisComplete && (
                <span className="bg-success absolute top-2 right-2 flex size-7 items-center justify-center rounded-full text-white">
                  <Check className="size-4" />
                </span>
              )}
            </div>
            <div className="flex min-w-0 flex-col gap-3">
              <Input
                label="Nomor rangka / VIN"
                value={chassisDraftValue}
                maxLength={64}
                placeholder="Contoh: MHKM1BA3JLK123456"
                leftIcon={<Hash className="size-4" />}
                disabled={chassisUploading}
                onChange={(event) => handleChassisDraftChange(event.currentTarget.value)}
                hint={
                  chassisDraftConfidence
                    ? `OCR ${(chassisDraftConfidence * 100).toFixed(0)}%`
                    : undefined
                }
              />
              {chassisNumberImageUrl && (
                <Button
                  size="sm"
                  variant={chassisComplete ? 'outline' : 'primary'}
                  disabled={chassisUploading || chassisDraftValue.trim().length < 5}
                  leftIcon={<Check className="size-4" />}
                  className="h-9 px-2 text-[11px]"
                  onClick={confirmChassisNumber}
                >
                  {chassisComplete ? 'Nomor Rangka Sesuai' : 'Konfirmasi Nomor Rangka'}
                </Button>
              )}
              <Button
                size="sm"
                variant="secondary"
                disabled={uploading !== null || engineUploading || chassisUploading}
                isLoading={chassisUploading}
                leftIcon={<Camera className="size-4" />}
                className="h-9 px-2 text-[11px]"
                onClick={() => setCameraTarget({ kind: 'chassis' })}
              >
                Foto Nomor Rangka
              </Button>
            </div>
          </div>
        </section>

        <div className="border-warning/50 bg-warning/5 mt-5 flex items-start gap-3 rounded-lg border p-4">
          <Camera className="text-warning mt-0.5 size-5 shrink-0" />
          <p className="text-12 text-neutral-800">
            Pastikan seluruh dokumen terlihat jelas, tidak terpotong, dan masih berlaku.
          </p>
        </div>

        <div className="mt-auto pt-8">
          <Button
            size="lg"
            disabled={
              !documentsComplete ||
              !engineComplete ||
              !chassisComplete ||
              uploading !== null ||
              engineUploading ||
              chassisUploading
            }
            onClick={() => navigate(ROUTES.claimDetail)}
          >
            Selanjutnya
          </Button>
        </div>
      </div>

      <CameraCapture
        open={Boolean(cameraTarget)}
        facingMode="environment"
        guideText={cameraGuideText}
        confirmBeforeCapture
        confirmLabel="Gunakan Foto"
        retakeLabel="Ambil Ulang"
        /*
         * Dokumen disimpan sebatas bingkainya saja. Tanpa ini, yang tersimpan
         * adalah seluruh bidang kamera — orang membingkai KTP-nya rapi di
         * panduan, lalu yang terkirim ke asuransi justru foto tegak berisi meja
         * dan lantai dengan kartunya kecil di tengah.
         *
         * Hanya untuk dokumen; nomor mesin dan rangka difoto apa adanya karena
         * letaknya bermacam-macam dan sering butuh konteks sekitarnya.
         */
        cropToGuide={isDocumentCapture}
        guideFrameAspectRatio={isDocumentCapture ? DOCUMENT_FRAME_RATIO : undefined}
        onClose={() => setCameraTarget(null)}
        onCapture={handleCameraCapture}
      />
    </PageContainer>
  );
}
