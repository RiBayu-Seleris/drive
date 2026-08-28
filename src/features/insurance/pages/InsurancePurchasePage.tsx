import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { AxiosError } from 'axios';
import {
  CarFront,
  Camera,
  CheckCircle2,
  Check,
  Clock,
  CreditCard,
  FileImage,
  FileText,
  Landmark,
  QrCode,
  Sparkles,
  Upload,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { AppHeader } from '@/components/layout/AppHeader';
import { Input } from '@/components/ui/Input';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { Select } from '@/components/ui/Select';
import { TextArea } from '@/components/ui/TextArea';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/feedback/StateViews';
import { toast } from '@/components/feedback/toast';
import { extractErrorMessage } from '@/lib/api/client';
import { uploadDocument } from '@/lib/upload/publicUpload';
import {
  normalizeVehicleIdentityNumber,
  recognizeChassisNumber,
  recognizeEngineNumber,
} from '@/lib/ocr/vehicleIdentity';
import { cn } from '@/lib/utils/cn';
import { formatCurrency, severityFromPercent, SEVERITY_COLOR } from '@/lib/utils/format';
import { normalizePlate, isValidPlate } from '@/features/vehicle-scan/utils/plate';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useDamageStore } from '@/features/damage/store/damageStore';
import { useScanStore } from '@/features/vehicle-scan/store/scanStore';
import { CameraCapture } from '@/features/vehicle-scan/components/CameraCapture';
import type { CapturedImage } from '@/features/vehicle-scan/types';
import { ROUTES, buildPath } from '@/app/routes';
import {
  purchaseInsurance,
  DEFAULT_MAX_PURCHASE_DAMAGE_PCT,
  PURCHASE_SCAN_VALIDITY_MINUTES,
  PURCHASE_SCAN_VALIDITY_MS,
  type InsurancePolicyDocumentInput,
  type InsurancePolicyDocumentType,
  type InsuranceProduct,
} from '../api';
import { useLiveInsuranceProduct } from '../useInsuranceProducts';
import { coverageLabel } from '../productUi';

const PERIODS = [
  { months: 12, label: '12 bulan' },
  { months: 24, label: '24 bulan' },
  { months: 36, label: '36 bulan' },
];

const PAYMENT_METHODS: { value: string; label: string; icon: LucideIcon }[] = [
  { value: 'BANK_TRANSFER', label: 'Transfer Bank', icon: Landmark },
  { value: 'CREDIT_CARD', label: 'Kartu Kredit', icon: CreditCard },
  { value: 'EWALLET', label: 'E-Wallet', icon: Wallet },
  { value: 'QRIS', label: 'QRIS', icon: QrCode },
];

const POLICY_DOCUMENTS: Array<{ type: InsurancePolicyDocumentType; label: string }> = [
  { type: 'KTP', label: 'KTP' },
  { type: 'STNK', label: 'STNK' },
];

/** Nomor identitas kendaraan yang wajib difoto (bukti) lalu dibaca OCR. */
type IdentityField = 'chassis' | 'engine';

const IDENTITY_FIELDS: Record<IdentityField, { label: string; category: string }> = {
  chassis: { label: 'Nomor Rangka', category: 'policy_chassis_number' },
  engine: { label: 'Nomor Mesin', category: 'policy_engine_number' },
};

/** Di bawah ambang ini hasil OCR ditandai "perlu diperiksa", tapi tidak ditolak. */
const OCR_LOW_CONFIDENCE = 0.7;

type CaptureTarget =
  | { kind: 'document'; type: InsurancePolicyDocumentType }
  | { kind: 'identity'; field: IdentityField };

type DocumentInputMode = 'camera' | 'file';

interface DocumentPreview {
  url: string;
  kind: 'image' | 'pdf';
  name: string;
}

function isPdf(file: File): boolean {
  return file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
}

/** Panduan di dalam bingkai kamera, sesuai objek yang sedang difoto. */
function captureGuideText(target: CaptureTarget | null): string {
  if (!target) return 'Posisikan dokumen di dalam bingkai';
  if (target.kind === 'document') return `Posisikan ${target.type} di dalam bingkai`;
  return `Posisikan ${IDENTITY_FIELDS[target.field].label.toLowerCase()} di dalam bingkai`;
}

/** "43:07" — sisa masa berlaku hasil scan. */
function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Nomor pesanan tertunda yang dikirim gateway saat pembelian ditolak (409). */
function unpaidPolicyNumber(error: unknown): string {
  if (!(error instanceof AxiosError)) return '';
  const data = error.response?.data as { data?: { unpaid_policy_number?: unknown } } | undefined;
  const value = data?.data?.unpaid_policy_number;
  return typeof value === 'string' ? value : '';
}

/**
 * Kapan polis mulai menanggung. Bukan pilihan pembeli: tanggalnya diturunkan
 * dari masa tunggu produk, dihitung sejak pembayaran lunas.
 */
function CoverageStartNotice({ waitingPeriodDays }: { waitingPeriodDays: number }) {
  const startsAt = new Date();
  if (waitingPeriodDays > 0) startsAt.setDate(startsAt.getDate() + waitingPeriodDays);
  const tanggal = startsAt.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="rounded-lg border border-neutral-400 bg-neutral-100 px-3 py-2.5">
      <p className="text-12 text-neutral-700">Mulai berlaku</p>
      <p className="text-14 font-semibold text-neutral-900">
        {waitingPeriodDays > 0 ? tanggal : 'Segera setelah pembayaran'}
      </p>
      {waitingPeriodDays > 0 && (
        <p className="text-12 mt-1 text-neutral-700">
          Produk ini punya masa tunggu {waitingPeriodDays} hari sejak pembayaran. Masa berlakunya
          tidak terpotong — periode yang Anda bayar dihitung penuh dari tanggal tersebut.
        </p>
      )}
    </div>
  );
}

function calculatePremium(product: InsuranceProduct, periodMonths: number) {
  const annualPremium = product.annualPremium ?? 0;
  const monthlyPremium = product.monthlyPremium ?? 0;
  if (annualPremium > 0 && periodMonths >= 12) {
    const years = Math.floor(periodMonths / 12);
    const remainingMonths = periodMonths % 12;
    return years * annualPremium + remainingMonths * monthlyPremium;
  }
  return monthlyPremium * periodMonths;
}

/** Pisah "Toyota Fortuner" hasil scan menjadi merek + model untuk prefill form. */
function splitBrandModel(brandModel: string): { brand: string; model: string } {
  const trimmed = brandModel.trim();
  if (!trimmed) return { brand: '', model: '' };
  const spaceIndex = trimmed.indexOf(' ');
  if (spaceIndex < 0) return { brand: trimmed, model: '' };
  return { brand: trimmed.slice(0, spaceIndex), model: trimmed.slice(spaceIndex + 1) };
}

type InsuranceRouteState =
  | InsuranceProduct
  | { product?: InsuranceProduct; requiresDamageFreeScan?: boolean }
  | null;

function isInsuranceRouteWrapper(
  state: Exclude<InsuranceRouteState, null>,
): state is { product?: InsuranceProduct; requiresDamageFreeScan?: boolean } {
  return 'product' in state || 'requiresDamageFreeScan' in state;
}

function routeProduct(state: InsuranceRouteState): InsuranceProduct | null {
  if (!state) return null;
  if (isInsuranceRouteWrapper(state)) return state.product ?? null;
  return state;
}

export function InsurancePurchasePage() {
  const navigate = useNavigate();
  const locationState = useLocation().state as InsuranceRouteState;
  const product = useLiveInsuranceProduct(routeProduct(locationState));
  const user = useAuthStore((s) => s.user);
  const damageResult = useDamageStore((s) => s.result);
  const scanPlate = useScanStore((s) => s.plate);
  const scanVehicleInfo = useScanStore((s) => s.vehicleInfo);
  const scanSides = useScanStore((s) => s.sides);
  const inferenceTicket = damageResult?.ticket ?? '';
  // Batas kerusakan diambil dari produk yang dipilih, bukan angka mati. Backend
  // menegakkan angka yang sama saat polis dibuat; kalau di sini masih 0%, produk
  // dengan toleransi lebih longgar (mis. TLO) jadi mustahil dibeli.
  const maxDamagePct = product?.maxPurchaseDamagePct ?? DEFAULT_MAX_PURCHASE_DAMAGE_PCT;
  const damageWithinLimit = Boolean(
    damageResult && damageResult.repair.percentage <= maxDamagePct && damageResult.ticket,
  );
  const scannedVehicle = splitBrandModel(scanVehicleInfo.brandModel);
  const vehiclePhoto = scanSides.find((side) => side.id === 'front')?.photo?.dataUrl ?? '';

  // Hasil scan punya masa berlaku di server (PurchaseScanMaxAge). Detak per
  // detik ini dipakai untuk menghitung sisa waktunya di layar, memakai
  // created_at dari backend — sumber yang sama dengan yang dipakai server —
  // supaya user tidak pernah kaget ditolak saat menekan tombol beli.
  const [nowTs, setNowTs] = useState(() => Date.now());
  const scanCreatedAt = damageResult?.createdAt;
  useEffect(() => {
    if (!scanCreatedAt) return;
    const id = window.setInterval(() => setNowTs(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [scanCreatedAt]);

  const scanExpiresAt = scanCreatedAt
    ? new Date(scanCreatedAt).getTime() + PURCHASE_SCAN_VALIDITY_MS
    : 0;
  const scanMsLeft = scanExpiresAt > 0 ? scanExpiresAt - nowTs : 0;
  const scanExpired = scanExpiresAt > 0 && scanMsLeft <= 0;
  const damageFreeOk = damageWithinLimit && !scanExpired;

  const [plate, setPlate] = useState(scanPlate.number ?? '');
  const [holderName, setHolderName] = useState(user?.fullname ?? '');
  const [holderNik, setHolderNik] = useState('');
  const [holderPhone, setHolderPhone] = useState(user?.phone ?? '');
  const [holderEmail, setHolderEmail] = useState(user?.email ?? '');
  const [holderAddress, setHolderAddress] = useState('');
  const [holderCity, setHolderCity] = useState('');
  const [holderPostalCode, setHolderPostalCode] = useState('');
  const [holderBirthDate, setHolderBirthDate] = useState('');
  const [vehicleBrand, setVehicleBrand] = useState(scannedVehicle.brand);
  const [vehicleModel, setVehicleModel] = useState(scannedVehicle.model);
  const [vehicleYear, setVehicleYear] = useState(scanVehicleInfo.year);
  const [vehicleChassisNumber, setVehicleChassisNumber] = useState('');
  const [vehicleEngineNumber, setVehicleEngineNumber] = useState('');
  const [vehicleColor, setVehicleColor] = useState(scanVehicleInfo.color);
  const [vehicleUsage, setVehicleUsage] = useState('PRIVATE');
  const [registrationArea, setRegistrationArea] = useState('');
  const [estimatedVehicleValue, setEstimatedVehicleValue] = useState('');
  const [period, setPeriod] = useState(12);

  /*
   * Isi data kendaraan dari hasil pemindaian begitu tersedia.
   *
   * Nilai awal `useState` hanya dibaca SEKALI saat halaman pertama dibuka.
   * Padahal urutan lazimnya justru terbalik: user membuka formulir pembelian
   * dulu, baru dikirim memindai. Saat formulir dibuka pertama kali, data
   * pemindaian memang belum ada — dan tanpa penyelarasan ini, kolomnya tetap
   * kosong walau kemudian datanya masuk.
   *
   * Hanya kolom yang MASIH KOSONG yang diisi. Apa pun yang sudah diketik user
   * tidak pernah ditimpa — hasil pemindaian adalah bantuan, bukan atasan.
   */
  useEffect(() => {
    const { brand, model } = splitBrandModel(scanVehicleInfo.brandModel);
    if (brand) setVehicleBrand((current) => current || brand);
    if (model) setVehicleModel((current) => current || model);
    if (scanVehicleInfo.year) setVehicleYear((current) => current || scanVehicleInfo.year);
    if (scanVehicleInfo.color) setVehicleColor((current) => current || scanVehicleInfo.color);
    if (scanPlate.number) {
      const scanned = scanPlate.number;
      setPlate((current) => current || scanned);
    }
  }, [scanVehicleInfo.brandModel, scanVehicleInfo.year, scanVehicleInfo.color, scanPlate.number]);
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const [plateError, setPlateError] = useState<string | null>(null);
  const [documents, setDocuments] = useState<
    Partial<Record<InsurancePolicyDocumentType, InsurancePolicyDocumentInput>>
  >({});
  const [documentPreviews, setDocumentPreviews] = useState<
    Partial<Record<InsurancePolicyDocumentType, DocumentPreview>>
  >({});
  const [uploadingDocument, setUploadingDocument] = useState<InsurancePolicyDocumentType | null>(
    null,
  );
  const [cameraTarget, setCameraTarget] = useState<CaptureTarget | null>(null);
  const [identityImageUrls, setIdentityImageUrls] = useState<
    Partial<Record<IdentityField, string>>
  >({});
  const [identityPreviews, setIdentityPreviews] = useState<
    Partial<Record<IdentityField, DocumentPreview>>
  >({});
  const [identityConfidence, setIdentityConfidence] = useState<
    Partial<Record<IdentityField, number | null>>
  >({});
  const [uploadingIdentity, setUploadingIdentity] = useState<IdentityField | null>(null);
  const pendingCapture = useRef<CaptureTarget>({ kind: 'document', type: 'KTP' });
  const selectedDocumentMode = useRef<DocumentInputMode>('camera');
  const documentFileInputRef = useRef<HTMLInputElement>(null);
  const previewUrls = useRef<string[]>([]);

  const basePremium = product ? calculatePremium(product, period) : 0;
  const adminFee = product?.adminFee ?? 0;
  const stampDutyFee = product?.stampDutyFee ?? 0;
  const totalAmount = basePremium + adminFee + stampDutyFee;
  const documentsComplete = POLICY_DOCUMENTS.every((document) => Boolean(documents[document.type]));
  // Nomor identitas kendaraan wajib lengkap DENGAN fotonya: nomor inilah yang
  // dicocokkan server saat auto-approval klaim, jadi ia harus berasal dari
  // kendaraan fisik — bukan sekadar diketik.
  const identityComplete =
    Boolean(vehicleChassisNumber.trim()) &&
    Boolean(identityImageUrls.chassis) &&
    Boolean(vehicleEngineNumber.trim()) &&
    Boolean(identityImageUrls.engine);

  useEffect(
    () => () => {
      previewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    },
    [],
  );

  const mutation = useMutation({
    mutationFn: () =>
      purchaseInsurance({
        productCode: product!.code,
        vehiclePlate: normalizePlate(plate),
        holderName: holderName.trim(),
        holderNik: holderNik.trim(),
        holderPhone: holderPhone.trim(),
        holderEmail: holderEmail.trim(),
        holderAddress: holderAddress.trim(),
        holderCity: holderCity.trim(),
        holderPostalCode: holderPostalCode.trim(),
        holderBirthDate,
        vehicleBrand: vehicleBrand.trim(),
        vehicleModel: vehicleModel.trim(),
        vehicleYear: Number(vehicleYear),
        vehicleChassisNumber: vehicleChassisNumber.trim(),
        vehicleChassisNumberImageUrl: identityImageUrls.chassis ?? '',
        vehicleEngineNumber: vehicleEngineNumber.trim(),
        vehicleEngineNumberImageUrl: identityImageUrls.engine ?? '',
        vehicleColor: vehicleColor.trim(),
        vehicleUsage,
        registrationArea: registrationArea.trim(),
        estimatedVehicleValue: Number(estimatedVehicleValue),
        periodMonths: period,
        paymentMethod,
        termsAccepted,
        declarationAccepted,
        inferenceTicket,
        documents: POLICY_DOCUMENTS.map((document) => documents[document.type]).filter(
          (document): document is InsurancePolicyDocumentInput => Boolean(document),
        ),
      }),
    onSuccess: (policy) => {
      navigate(ROUTES.payment, {
        replace: true,
        state: {
          payment_type: 'POLICY_PREMIUM',
          policy_number: policy.policyNumber,
          amount: policy.totalAmount,
          item_name: `Premi ${policy.productName}`,
          redirect_route: ROUTES.insurancePolicies,
        },
      });
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error, 'Pembelian polis gagal.'));
      // Pesanan yang belum dibayar tidak boleh berakhir di jalan buntu:
      // langsung antar ke pesanan itu, tempat user bisa membayarnya atau
      // membatalkannya kalau ternyata salah pilih produk.
      const unpaid = unpaidPolicyNumber(error);
      if (unpaid) navigate(buildPath.insurancePolicyDetail(unpaid));
    },
  });

  if (!product) {
    return (
      <PageContainer>
        <AppHeader title="Beli Asuransi" />
        <EmptyState
          title="Produk tidak ditemukan"
          action={
            <Button fullWidth={false} onClick={() => navigate(ROUTES.insuranceSearch)}>
              Lihat Produk
            </Button>
          }
        />
      </PageContainer>
    );
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const normalizedPlate = normalizePlate(plate);
    if (!isValidPlate(normalizedPlate)) {
      setPlateError('Format plat tidak valid. Contoh: B 1234 ABC');
      return;
    }
    setPlateError(null);
    if (!/^\d{16}$/.test(holderNik.trim())) {
      toast.error('NIK harus 16 digit.');
      return;
    }
    if (!holderPhone.trim() || !holderAddress.trim() || !holderCity.trim()) {
      toast.error('Lengkapi data pemegang polis.');
      return;
    }
    if (!vehicleBrand.trim() || !vehicleModel.trim() || !Number(vehicleYear)) {
      toast.error('Lengkapi data kendaraan.');
      return;
    }
    if (Number(estimatedVehicleValue) <= 0) {
      toast.error('Estimasi nilai kendaraan wajib diisi.');
      return;
    }
    if (!termsAccepted || !declarationAccepted) {
      toast.error('Persetujuan polis wajib dicentang.');
      return;
    }
    if (!damageFreeOk) {
      toast.error(
        scanExpired
          ? 'Hasil scan sudah kedaluwarsa. Silakan scan ulang kendaraan Anda.'
          : `Pembelian asuransi memerlukan hasil scan dengan kerusakan maksimal ${maxDamagePct.toFixed(0)}%. Scan kendaraan Anda terlebih dahulu.`,
      );
      return;
    }
    if (!documentsComplete) {
      toast.error('Unggah KTP dan STNK terlebih dahulu.');
      return;
    }
    if (!identityComplete) {
      toast.error('Nomor rangka dan nomor mesin wajib diisi beserta fotonya.');
      return;
    }
    mutation.mutate();
  };

  const chooseCapture = (target: CaptureTarget, mode: DocumentInputMode) => {
    pendingCapture.current = target;
    selectedDocumentMode.current = mode;
    if (mode === 'camera') {
      setCameraTarget(target);
      return;
    }
    documentFileInputRef.current?.click();
  };

  const chooseDocument = (type: InsurancePolicyDocumentType, mode: DocumentInputMode) =>
    chooseCapture({ kind: 'document', type }, mode);

  const chooseIdentity = (field: IdentityField, mode: DocumentInputMode) =>
    chooseCapture({ kind: 'identity', field }, mode);

  const uploadPolicyDocument = async (file: File, type: InsurancePolicyDocumentType) => {
    const mode = selectedDocumentMode.current;
    const fileValid =
      mode === 'camera'
        ? file.type.startsWith('image/')
        : file.type.startsWith('image/') || isPdf(file);
    if (!fileValid) {
      toast.warning('Gunakan file gambar atau PDF yang valid.');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.warning('Ukuran dokumen maksimal 10 MB.');
      return;
    }
    setUploadingDocument(type);
    try {
      const extension = file.name.split('.').pop() || 'jpg';
      const fileUrl = await uploadDocument(
        file,
        `policy_${type.toLowerCase()}`,
        `${type}.${extension}`,
      );
      setDocuments((current) => ({
        ...current,
        [type]: { documentType: type, fileUrl },
      }));
      const previewUrl = URL.createObjectURL(file);
      previewUrls.current.push(previewUrl);
      setDocumentPreviews((current) => {
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
      setUploadingDocument(null);
    }
  };

  /**
   * Unggah foto nomor rangka/mesin lalu baca dengan OCR.
   *
   * Fotonya diunggah LEBIH DULU dan tetap dipertahankan walau OCR gagal —
   * bukti fisik itu yang wajib, angkanya boleh diketik manual. OCR di nomor
   * rangka/mesin memang kerap meleset (permukaan berkarat, kotor, sudut sulit).
   */
  const uploadIdentityPhoto = async (file: File, field: IdentityField) => {
    const { label, category } = IDENTITY_FIELDS[field];
    if (!file.type.startsWith('image/')) {
      toast.warning(`${label} harus berupa foto.`);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.warning('Ukuran foto maksimal 10 MB.');
      return;
    }
    setUploadingIdentity(field);
    try {
      const extension = file.name.split('.').pop() || 'jpg';
      const fileUrl = await uploadDocument(file, category, `${field}.${extension}`);
      setIdentityImageUrls((current) => ({ ...current, [field]: fileUrl }));
      const previewUrl = URL.createObjectURL(file);
      previewUrls.current.push(previewUrl);
      setIdentityPreviews((current) => {
        const previousUrl = current[field]?.url;
        if (previousUrl) URL.revokeObjectURL(previousUrl);
        return {
          ...current,
          [field]: { url: previewUrl, kind: 'image', name: file.name || `${field}.${extension}` },
        };
      });

      try {
        const result =
          field === 'chassis'
            ? await recognizeChassisNumber(file, `${field}.${extension}`)
            : await recognizeEngineNumber(file, `${field}.${extension}`);
        const recognized = normalizeVehicleIdentityNumber(result.value);
        if (recognized) {
          if (field === 'chassis') setVehicleChassisNumber(recognized);
          else setVehicleEngineNumber(recognized);
          setIdentityConfidence((current) => ({ ...current, [field]: result.confidence }));
          toast.success(`${label} terbaca. Periksa kembali sebelum lanjut.`);
        } else {
          setIdentityConfidence((current) => ({ ...current, [field]: null }));
          toast.warning(`Foto ${label} tersimpan. Isi ${label} secara manual.`);
        }
      } catch {
        // OCR gagal bukan alasan membuang fotonya — user tinggal mengetik.
        setIdentityConfidence((current) => ({ ...current, [field]: null }));
        toast.warning(`Foto ${label} tersimpan. Isi ${label} secara manual.`);
      }
    } catch (error) {
      toast.error(extractErrorMessage(error, `Gagal mengunggah foto ${label}.`));
    } finally {
      setUploadingIdentity(null);
    }
  };

  const handleSelectedFile = (file?: File) => {
    if (!file) return;
    const target = pendingCapture.current;
    if (target.kind === 'document') void uploadPolicyDocument(file, target.type);
    else void uploadIdentityPhoto(file, target.field);
  };

  const fileFromCapture = (image: CapturedImage, basename: string): File =>
    new File([image.blob], `${basename}.jpg`, { type: 'image/jpeg' });

  const handleCameraCapture = (image: CapturedImage) => {
    const target = cameraTarget;
    setCameraTarget(null);
    URL.revokeObjectURL(image.url);
    if (!target) return;
    pendingCapture.current = target;
    selectedDocumentMode.current = 'camera';
    if (target.kind === 'document') {
      void uploadPolicyDocument(fileFromCapture(image, target.type.toLowerCase()), target.type);
    } else {
      void uploadIdentityPhoto(fileFromCapture(image, target.field), target.field);
    }
  };

  // Arahkan ke alur scan untuk memperoleh hasil 0% sebelum membeli polis.
  const goScan = () => {
    useScanStore.getState().reset();
    useScanStore.getState().setScanPurpose('insurance_purchase');
    // Produk yang sedang dibeli diingat, supaya setelah memindai user bisa
    // kembali ke formulir ini alih-alih harus mencari & memilih produknya lagi
    // dari daftar. Tanpa ini pilihannya hilang bersama state router.
    useScanStore.getState().setPendingProductCode(product?.code ?? null);
    useDamageStore.getState().reset();
    navigate(ROUTES.checkCondition);
  };

  return (
    <PageContainer className="bg-neutral-200">
      <AppHeader showLogo />
      <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 px-4 pt-4">
        <input
          ref={documentFileInputRef}
          type="file"
          accept="image/*,application/pdf,.pdf"
          className="hidden"
          onChange={(event) => {
            const file = event.currentTarget.files?.[0];
            event.currentTarget.value = '';
            handleSelectedFile(file);
          }}
        />
        <VehicleCard
          photo={vehiclePhoto}
          title={scanVehicleInfo.brandModel.trim() || 'Kendaraan Anda'}
          plate={scanPlate.number ?? ''}
          verified={scanPlate.source === 'ocr'}
          meta={[scanVehicleInfo.year, scanVehicleInfo.color].filter(Boolean).join(' · ')}
        />

        {damageResult && <ScanResultCard percentage={damageResult.repair.percentage} />}

        {damageResult && scanMsLeft > 0 && (
          <div
            className={cn(
              'flex items-center gap-2 rounded-xl border px-3 py-2',
              scanMsLeft <= 10 * 60 * 1000
                ? 'border-warning/40 bg-warning/10'
                : 'border-neutral-200 bg-neutral-50',
            )}
          >
            <Clock
              className={cn(
                'h-4 w-4 shrink-0',
                scanMsLeft <= 10 * 60 * 1000 ? 'text-warning' : 'text-neutral-500',
              )}
            />
            <p className="text-12 text-neutral-700">
              Hasil scan berlaku{' '}
              <span className="font-semibold tabular-nums">{formatCountdown(scanMsLeft)}</span>{' '}
              lagi.
              {scanMsLeft <= 10 * 60 * 1000 && ' Selesaikan pembelian sebelum waktunya habis.'}
            </p>
          </div>
        )}

        {!damageFreeOk && (
          <div className="border-warning/40 bg-warning/10 rounded-xl border p-4">
            <p className="text-14 font-semibold text-neutral-900">
              {scanExpired
                ? 'Hasil scan sudah kedaluwarsa'
                : `Scan kendaraan dulu (maksimal ${maxDamagePct.toFixed(0)}% kerusakan)`}
            </p>
            <p className="text-12 mt-1 text-neutral-700">
              {scanExpired
                ? `Hasil scan hanya berlaku ${PURCHASE_SCAN_VALIDITY_MINUTES} menit agar kondisi kendaraan yang dinilai benar-benar terbaru. Silakan scan ulang, lalu isi kembali formulirnya.`
                : !damageResult
                  ? 'Setiap pembelian polis wajib didahului scan kendaraan. Hasilnya juga berlaku terbatas, jadi lakukan scan saat akan membeli.'
                  : damageResult.repair.percentage > maxDamagePct
                    ? `Hasil scan terakhir ${damageResult.repair.percentage.toFixed(0)}% kerusakan, melebihi batas ${maxDamagePct.toFixed(0)}% untuk produk ini.`
                    : 'Scan kendaraan Anda dalam mode asuransi agar foto keempat sisi terekam untuk pengajuan polis.'}
            </p>
            <Button
              type="button"
              variant="outline"
              fullWidth={false}
              className="mt-3"
              onClick={goScan}
            >
              Scan Kendaraan
            </Button>
          </div>
        )}

        {/* Ringkasan paket yang dibeli — aksen oranye seperti desain. */}
        <div className="drive-card overflow-hidden rounded-xl shadow-[0_2px_12px_rgb(32_41_68_/_0.06)]">
          <div className="flex gap-3.5 border-l-4 border-[#dd632c] p-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-16 font-semibold text-[#c2f347]">{product.name}</h2>
              <p className="text-12 mt-1 leading-relaxed text-[#eef4f8]">
                {product.description || `${product.provider} · ${coverageLabel(product)}`}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-16 font-bold text-[#c2f347]">
                {formatCurrency(product.monthlyPremium)}
              </p>
              <p className="text-11 text-[#eef4f8]">per bulan</p>
            </div>
          </div>
          {product.benefits.length > 0 && (
            <div className="px-4 pb-4">
              <p className="text-13 flex items-center gap-2.5 rounded-lg bg-[#131c24] px-3.5 py-2.5 font-medium text-[#c2f347]">
                <CheckCircle2 className="size-5 shrink-0" />
                {product.benefits[0]}
              </p>
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 border-t border-neutral-400 px-4 py-3">
            <SummaryLine label="Limit" value={formatCurrency(product.claimLimit ?? 0)} />
            <SummaryLine
              label="Risiko sendiri"
              value={formatCurrency(product.deductibleAmount ?? 0)}
            />
          </div>
        </div>

        <Section title="Pemegang Polis">
          <Input
            label="Nama Lengkap"
            requiredMark
            placeholder="Nama sesuai KTP"
            value={holderName}
            onChange={(e) => setHolderName(e.target.value)}
          />
          <Input
            label="NIK"
            requiredMark
            inputMode="numeric"
            maxLength={16}
            placeholder="16 digit NIK"
            value={holderNik}
            onChange={(e) => setHolderNik(e.target.value.replace(/\D/g, '').slice(0, 16))}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Nomor HP"
              requiredMark
              type="tel"
              placeholder="08xxxxxxxxxx"
              value={holderPhone}
              onChange={(e) => setHolderPhone(e.target.value)}
            />
            <Input
              label="Email"
              requiredMark
              type="email"
              placeholder="nama@email.com"
              value={holderEmail}
              onChange={(e) => setHolderEmail(e.target.value)}
            />
          </div>
          <Input
            label="Tanggal Lahir"
            type="date"
            value={holderBirthDate}
            onChange={(e) => setHolderBirthDate(e.target.value)}
          />
          <TextArea
            label="Alamat Domisili"
            requiredMark
            rows={3}
            placeholder="Alamat lengkap"
            value={holderAddress}
            onChange={(e) => setHolderAddress(e.target.value)}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Kota"
              requiredMark
              placeholder="Jakarta Selatan"
              value={holderCity}
              onChange={(e) => setHolderCity(e.target.value)}
            />
            <Input
              label="Kode Pos"
              inputMode="numeric"
              placeholder="12345"
              value={holderPostalCode}
              onChange={(e) => setHolderPostalCode(e.target.value.replace(/\D/g, '').slice(0, 16))}
            />
          </div>
        </Section>

        <Section title="Kendaraan">
          <Input
            label="Plat Nomor"
            requiredMark
            placeholder="B 1234 ABC"
            value={plate}
            onChange={(e) => setPlate(e.target.value.toUpperCase())}
            error={plateError ?? undefined}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Merek"
              requiredMark
              placeholder="Toyota"
              value={vehicleBrand}
              onChange={(e) => setVehicleBrand(e.target.value)}
            />
            <Input
              label="Model/Tipe"
              requiredMark
              placeholder="Avanza 1.5 G"
              value={vehicleModel}
              onChange={(e) => setVehicleModel(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Tahun"
              requiredMark
              type="number"
              inputMode="numeric"
              placeholder="2022"
              value={vehicleYear}
              onChange={(e) => setVehicleYear(e.target.value)}
            />
            <Select
              label="Penggunaan"
              value={vehicleUsage}
              onChange={setVehicleUsage}
              options={[
                { value: 'PRIVATE', label: 'Pribadi' },
                { value: 'COMMERCIAL', label: 'Komersial' },
              ]}
            />
          </div>
          <CurrencyInput
            label="Estimasi Nilai Kendaraan"
            requiredMark
            placeholder="150.000.000"
            value={estimatedVehicleValue}
            onChange={setEstimatedVehicleValue}
          />
          <IdentityNumberField
            field="chassis"
            value={vehicleChassisNumber}
            onChange={setVehicleChassisNumber}
            preview={identityPreviews.chassis}
            hasPhoto={Boolean(identityImageUrls.chassis)}
            confidence={identityConfidence.chassis ?? null}
            uploading={uploadingIdentity === 'chassis'}
            disabled={uploadingIdentity !== null}
            onChoose={chooseIdentity}
          />
          <IdentityNumberField
            field="engine"
            value={vehicleEngineNumber}
            onChange={setVehicleEngineNumber}
            preview={identityPreviews.engine}
            hasPhoto={Boolean(identityImageUrls.engine)}
            confidence={identityConfidence.engine ?? null}
            uploading={uploadingIdentity === 'engine'}
            disabled={uploadingIdentity !== null}
            onChoose={chooseIdentity}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Warna"
              placeholder="Hitam"
              value={vehicleColor}
              onChange={(e) => setVehicleColor(e.target.value)}
            />
            <Input
              label="Wilayah Registrasi"
              placeholder="B"
              value={registrationArea}
              onChange={(e) => setRegistrationArea(e.target.value.toUpperCase())}
            />
          </div>
        </Section>

        <Section title="Berkas Polis">
          <div className="grid grid-cols-2 gap-4">
            {POLICY_DOCUMENTS.map(({ type, label }) => (
              <PolicyDocumentSlot
                key={type}
                type={type}
                label={label}
                preview={documentPreviews[type]}
                complete={Boolean(documents[type])}
                uploading={uploadingDocument === type}
                disabled={uploadingDocument !== null}
                selectedMode={selectedDocumentMode.current}
                onChoose={chooseDocument}
              />
            ))}
          </div>
        </Section>

        <Section title="Perlindungan">
          <CoverageStartNotice waitingPeriodDays={product?.waitingPeriodDays ?? 0} />
          <div>
            <p className="text-14 mb-1.5 font-medium text-neutral-900">Periode</p>
            <div className="grid grid-cols-3 gap-2">
              {PERIODS.map((p) => (
                <button
                  key={p.months}
                  type="button"
                  onClick={() => setPeriod(p.months)}
                  className={`text-12 rounded-lg border py-2.5 font-medium ${
                    period === p.months
                      ? 'border-deep-blue-500 bg-deep-blue-50 text-deep-blue-600'
                      : 'border-neutral-400 text-neutral-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
        </Section>

        <div>
          <h2 className="text-18 mb-3 font-semibold text-[#c2f347]">Metode Pembayaran</h2>
          <div className="flex flex-col gap-3">
            {PAYMENT_METHODS.map((method) => {
              const active = paymentMethod === method.value;
              const Icon = method.icon;
              return (
                <button
                  key={method.value}
                  type="button"
                  onClick={() => setPaymentMethod(method.value)}
                  aria-pressed={active}
                  className={cn(
                    'drive-card flex items-center gap-3.5 rounded-xl border p-3.5 text-left transition',
                    active
                      ? 'border-deep-blue-500 shadow-[0_2px_12px_rgb(75_97_161_/_0.14)]'
                      : 'border-neutral-400',
                  )}
                >
                  <span
                    className={cn(
                      'flex size-11 shrink-0 items-center justify-center rounded-full',
                      active
                        ? 'bg-deep-blue-50 text-deep-blue-600'
                        : 'bg-[#131c24] text-neutral-700',
                    )}
                  >
                    <Icon className="size-5" />
                  </span>
                  <span
                    className={cn(
                      'text-14 min-w-0 flex-1 font-semibold',
                      active ? 'text-[#c2f347]' : 'text-[#eef4f8]',
                    )}
                  >
                    {method.label}
                  </span>
                  <span
                    className={cn(
                      'flex size-5 shrink-0 items-center justify-center rounded-full border-2',
                      active ? 'border-deep-blue-500' : 'border-neutral-500',
                    )}
                  >
                    {active && <span className="bg-deep-blue-500 size-2.5 rounded-full" />}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="rounded-xl bg-[#131c24] p-4">
          <PriceRow label="Premi Dasar" value={basePremium} />
          <div className="mt-2">
            <PriceRow label="Biaya Admin" value={adminFee} />
          </div>
          <div className="mt-2">
            <PriceRow label="Meterai" value={stampDutyFee} />
          </div>
          <div className="mt-3 border-t border-neutral-500 pt-3">
            <PriceRow label="Total Bayar" value={totalAmount} strong />
          </div>
        </div>

        <div className="drive-card space-y-3 rounded-xl border border-neutral-400 p-4">
          <CheckRow
            checked={declarationAccepted}
            onChange={setDeclarationAccepted}
            requiredMark
            label="Saya menyatakan data kendaraan dan pemegang polis benar."
          />
          <CheckRow
            checked={termsAccepted}
            onChange={setTermsAccepted}
            requiredMark
            label="Saya menyetujui syarat polis dan ketentuan pengecualian."
          />
        </div>

        {/* Bilah aksi menempel di bawah viewport; margin negatif membatalkan
            padding form agar tetap selebar layar seperti desain. */}
        <div className="pb-safe sticky bottom-0 -mx-4 mt-auto border-t border-neutral-300 bg-neutral-100 px-4">
          <div className="flex h-full w-full py-3">
            <Button
              type="submit"
              size="lg"
              isLoading={mutation.isPending}
              disabled={
                mutation.isPending ||
                !damageFreeOk ||
                !documentsComplete ||
                !identityComplete ||
                !holderName.trim() ||
                !holderNik.trim() ||
                !holderPhone.trim() ||
                !holderEmail.trim() ||
                !plate.trim() ||
                !vehicleBrand.trim() ||
                !vehicleModel.trim() ||
                // Dua pernyataan persetujuan. Sebelumnya tombolnya tetap bisa
                // ditekan lalu ditolak toast "Persetujuan polis wajib dicentang"
                // — user harus gagal dulu untuk tahu ada yang terlewat, padahal
                // kotaknya berada jauh di atas tombol dan mudah terlewat saat
                // menggulir. Tombol mati lebih jujur: syaratnya terlihat sebelum
                // dicoba, bukan sesudah.
                !declarationAccepted ||
                !termsAccepted
              }
            >
              Bayar Sekarang
            </Button>
          </div>
        </div>
      </form>
      <CameraCapture
        open={cameraTarget !== null}
        facingMode="environment"
        guideText={captureGuideText(cameraTarget)}
        confirmBeforeCapture
        confirmLabel="Gunakan Foto"
        retakeLabel="Ambil Ulang"
        onClose={() => setCameraTarget(null)}
        onCapture={handleCameraCapture}
      />
    </PageContainer>
  );
}

/**
 * Field nomor rangka/mesin: wajib difoto, angkanya diisi OCR tapi tetap boleh
 * dikoreksi. Foto adalah buktinya; angka hasil OCR hanya alat bantu ketik.
 */
function IdentityNumberField({
  field,
  value,
  onChange,
  preview,
  hasPhoto,
  confidence,
  uploading,
  disabled,
  onChoose,
}: {
  field: IdentityField;
  value: string;
  onChange: (value: string) => void;
  preview?: DocumentPreview;
  hasPhoto: boolean;
  confidence: number | null;
  uploading: boolean;
  disabled: boolean;
  onChoose: (field: IdentityField, mode: DocumentInputMode) => void;
}) {
  const { label } = IDENTITY_FIELDS[field];
  const lowConfidence = confidence !== null && confidence < OCR_LOW_CONFIDENCE;

  return (
    <div>
      {/* Urutan sengaja: foto dulu (sumber kebenarannya), nomornya menyusul di
          bawah karena diisi dari hasil OCR foto tersebut. */}
      <span className="mb-2 block text-sm font-medium text-neutral-800">
        {label}
        <span className="text-danger ml-0.5" aria-hidden="true">
          *
        </span>
      </span>

      <div className="flex items-center gap-2">
        {preview ? (
          <img
            src={preview.url}
            alt={label}
            className="size-14 shrink-0 rounded-lg border border-neutral-400 object-cover"
          />
        ) : (
          <span className="flex size-14 shrink-0 items-center justify-center rounded-lg border border-dashed border-neutral-400 bg-neutral-100 text-neutral-700">
            <FileImage className="size-5" />
          </span>
        )}
        <Button
          type="button"
          size="sm"
          variant="secondary"
          disabled={disabled}
          isLoading={uploading}
          leftIcon={<Camera className="size-4" />}
          fullWidth={false}
          className="h-9 flex-1 px-2 text-[11px]"
          onClick={() => onChoose(field, 'camera')}
        >
          {hasPhoto ? 'Foto Ulang' : 'Ambil Foto'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          fullWidth={false}
          leftIcon={<Upload className="size-4" />}
          className="h-9 flex-1 px-2 text-[11px]"
          onClick={() => onChoose(field, 'file')}
        >
          File
        </Button>
      </div>

      <div className="mt-2">
        <Input
          aria-label={label}
          requiredMark
          placeholder="Terisi otomatis dari foto"
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          hint={
            hasPhoto
              ? lowConfidence
                ? `Hasil pembacaan ${label.toLowerCase()} kurang yakin — periksa dan perbaiki bila perlu.`
                : 'Foto tersimpan. Periksa nomornya sebelum lanjut.'
              : 'Ambil foto sebagai bukti, nomornya akan terisi otomatis.'
          }
        />
      </div>
    </div>
  );
}

function PolicyDocumentSlot({
  type,
  label,
  preview,
  complete,
  uploading,
  disabled,
  selectedMode,
  onChoose,
}: {
  type: InsurancePolicyDocumentType;
  label: string;
  preview?: DocumentPreview;
  complete: boolean;
  uploading: boolean;
  disabled: boolean;
  selectedMode: DocumentInputMode;
  onChoose: (type: InsurancePolicyDocumentType, mode: DocumentInputMode) => void;
}) {
  return (
    <section className="min-w-0">
      <p className="text-14 mb-1.5 font-medium text-neutral-900">
        {label}
        <span className="text-danger ml-0.5" aria-hidden="true">
          *
        </span>
      </p>
      <div className="relative flex aspect-square flex-col items-center justify-center overflow-hidden rounded-lg border border-dashed border-neutral-400 bg-neutral-100 text-neutral-700">
        {preview?.kind === 'image' ? (
          <img src={preview.url} alt={label} className="absolute inset-0 size-full object-cover" />
        ) : preview?.kind === 'pdf' ? (
          <div className="flex flex-col items-center gap-2 text-center">
            <FileText className="text-deep-blue-500 size-9" />
            <span className="text-12 font-semibold text-neutral-800">PDF</span>
          </div>
        ) : (
          <>
            <FileImage className="mb-2 size-7" />
            <span className="text-14 font-medium">{uploading ? 'Mengunggah...' : label}</span>
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
          type="button"
          size="sm"
          variant="secondary"
          disabled={disabled}
          isLoading={uploading && selectedMode === 'camera'}
          leftIcon={<Camera className="size-4" />}
          className="h-9 px-2 text-[11px]"
          onClick={() => onChoose(type, 'camera')}
        >
          Foto
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={disabled}
          isLoading={uploading && selectedMode === 'file'}
          leftIcon={<Upload className="size-4" />}
          className="h-9 px-2 text-[11px]"
          onClick={() => onChoose(type, 'file')}
        >
          File
        </Button>
      </div>
    </section>
  );
}

function VehicleCard({
  photo,
  title,
  plate,
  meta,
  verified,
}: {
  photo: string;
  title: string;
  plate: string;
  meta: string;
  verified: boolean;
}) {
  return (
    <div className="drive-card overflow-hidden rounded-xl shadow-[0_2px_12px_rgb(32_41_68_/_0.06)]">
      <div className="relative flex h-[190px] items-center justify-center bg-gradient-to-br from-[#aded1f] to-[#aded1f]">
        {photo ? (
          <img src={photo} alt={title} className="h-full w-full object-cover" />
        ) : (
          <CarFront className="size-16 text-white/70" />
        )}
        {verified && (
          <span className="text-12 absolute top-3 right-3 rounded-lg bg-[#aded1f] px-3 py-1.5 font-semibold text-white">
            Terverifikasi
          </span>
        )}
      </div>
      <div className="flex items-center justify-between gap-3 p-4">
        <div className="min-w-0">
          <h2 className="text-18 truncate font-bold text-[#c2f347]">{title}</h2>
          {meta && <p className="text-13 mt-0.5 text-[#eef4f8]">{meta}</p>}
        </div>
        {plate && (
          <span className="text-14 shrink-0 rounded-lg bg-[#131c24] px-3.5 py-2 font-semibold text-[#c2f347]">
            {plate}
          </span>
        )}
      </div>
    </div>
  );
}

function ScanResultCard({ percentage }: { percentage: number }) {
  // Skor kesehatan = kebalikan dari persentase kerusakan hasil analisis AI.
  const health = Math.max(0, Math.min(100, 100 - percentage));
  const barColor = percentage <= 0 ? '#3adf6e' : SEVERITY_COLOR[severityFromPercent(percentage)];

  return (
    <div className="drive-card rounded-xl p-4 shadow-[0_2px_12px_rgb(32_41_68_/_0.06)]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-16 flex items-center gap-2 font-bold text-[#c2f347]">
          <Sparkles className="size-5 text-[#e7906a]" />
          Hasil Scan AI
        </h2>
        <span className="text-11 flex items-center gap-1.5 rounded-xl bg-[#aded1f]/20 px-2.5 py-1 font-semibold text-[#c2f347]">
          <span className="size-1.5 rounded-full bg-[#aded1f]" />
          SELESAI
        </span>
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-14 text-[#eef4f8]">Skor Kesehatan Kendaraan</p>
        <p className="text-16 font-bold text-[#c2f347]">{health.toFixed(0)}%</p>
      </div>
      <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#0f1720]">
        <div
          className="h-full rounded-full transition-[width]"
          style={{ width: `${health}%`, backgroundColor: barColor }}
        />
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="drive-card space-y-3 rounded-xl p-4 shadow-[0_2px_12px_rgb(32_41_68_/_0.06)]">
      <h2 className="text-16 font-semibold text-[#eef4f8]">{title}</h2>
      {children}
    </div>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-10 font-medium text-[#eef4f8] uppercase">{label}</p>
      <p className="text-13 font-semibold text-[#eef4f8]">{value}</p>
    </div>
  );
}

function PriceRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className={strong ? 'text-16 font-bold text-[#c2f347]' : 'text-14 text-[#eef4f8]'}>
        {label}
      </span>
      <span className={strong ? 'text-20 font-bold text-[#c2f347]' : 'text-14 text-[#eef4f8]'}>
        {formatCurrency(value)}
      </span>
    </div>
  );
}

function CheckRow({
  checked,
  onChange,
  label,
  requiredMark = false,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  /** Tandai wajib dicentang — lihat catatan pada `InputProps.requiredMark`. */
  requiredMark?: boolean;
}) {
  return (
    <label className="text-12 flex items-start gap-3 font-medium text-neutral-800">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        aria-required={requiredMark || undefined}
        className="text-deep-blue-600 focus:ring-deep-blue-200 mt-0.5 h-4 w-4 rounded border-neutral-400"
      />
      <span>
        {label}
        {requiredMark && (
          <span className="text-danger ml-0.5" aria-hidden="true">
            *
          </span>
        )}
      </span>
    </label>
  );
}
