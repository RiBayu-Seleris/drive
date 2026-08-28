import { useState } from 'react';
import { useForm, type FieldPath } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Clock, Lock, Mail } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { AppHeader } from '@/components/layout/AppHeader';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/feedback/toast';
import { extractErrorMessage } from '@/lib/api/client';
import { ROUTES } from '@/app/routes';
import {
  loginTargetForRole,
  probeAdminLogin,
  uploadPartnerOnboardingImage,
} from '@/features/auth/api/authApi';
import { env } from '@/config/env';
import type { AdminLoginOutcome } from '@/features/auth/types';
import { partnerProfileSchema, type PartnerProfileValues } from '../schemas';
import { partnerTypeLabel, licenseLabelFor } from '../constants';
import { StepCompany, StepDots, StepLegal, StepPic } from '../components/ProfileSteps';
import {
  PARTNER_MAX_REJECTIONS,
  getPartnerProfilePrefill,
  isPartnerRole,
  partnerTypeFromRole,
  resubmitPartnerProfile,
  type PartnerProfilePrefill,
} from '../api/resubmitApi';

const RESUBMIT_STEP_FIELDS: FieldPath<PartnerProfileValues>[][] = [
  ['companyName', 'nib', 'officeAddress', 'companyEmail'],
  ['picName', 'picKtpNumber', 'picPhone'],
  [],
];
const RESUBMIT_LAST_STEP = 2;

/**
 * Mitra asuransi memperbaiki datanya di sini, tapi MASUKNYA lewat Backoffice —
 * portal mitra webapp-v2 hanya untuk towing & bengkel. Mengarahkannya ke
 * /login/mitra setelah selesai berujung "akun ini bukan mitra bengkel atau
 * towing", yaitu penolakan tepat setelah dia berhasil mengirim perbaikan.
 */
function goToLoginAfterResubmit(
  role: string,
  navigate: (path: string, opts?: { replace: boolean }) => void,
) {
  if (loginTargetForRole(role) === 'backoffice' && env.backofficeUrl) {
    window.location.href = `${env.backofficeUrl}/login`;
    return;
  }
  navigate(ROUTES.loginMitra, { replace: true });
}

interface ResubmitSession {
  token: string;
  /** admin_role mitra — penentu halaman masuk mana yang dituju setelah selesai. */
  role: string;
  partnerType: string;
  rejectionReason: string;
  prefill: PartnerProfilePrefill;
}

/**
 * Alur perbaikan data mitra setelah ditolak admin. Mitra masuk ringan (email +
 * kata sandi) HANYA untuk memuat & memperbaiki data yang ditolak — bukan
 * dashboard backoffice. Maksimal {@link PARTNER_MAX_REJECTIONS} kali.
 */
export function MitraResubmitPage() {
  const [searchParams] = useSearchParams();
  const [session, setSession] = useState<ResubmitSession | null>(null);
  const [info, setInfo] = useState<{
    icon: 'check' | 'clock' | 'lock' | 'warn';
    message: string;
  } | null>(null);

  if (session) {
    return <ResubmitForm session={session} />;
  }
  if (info) {
    return <ResubmitInfo icon={info.icon} message={info.message} />;
  }
  return (
    <ResubmitSignIn
      defaultEmail={searchParams.get('email') ?? ''}
      onResolved={setSession}
      onInfo={setInfo}
    />
  );
}

function ResubmitSignIn({
  defaultEmail,
  onResolved,
  onInfo,
}: {
  defaultEmail: string;
  onResolved: (session: ResubmitSession) => void;
  onInfo: (info: { icon: 'check' | 'clock' | 'lock' | 'warn'; message: string }) => void;
}) {
  const [email, setEmail] = useState(defaultEmail);
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const resolveOutcome = async (outcome: AdminLoginOutcome) => {
    if (!isPartnerRole(outcome.role)) {
      onInfo({ icon: 'warn', message: 'Akun ini bukan akun mitra.' });
      return;
    }
    const status = outcome.accountStatus.toUpperCase();
    if (status === 'ACTIVE') {
      onInfo({
        icon: 'check',
        message: 'Akun mitra Anda sudah aktif. Tidak ada data yang perlu diperbaiki.',
      });
      return;
    }
    if (status !== 'REJECTED') {
      onInfo({ icon: 'clock', message: 'Pendaftaran Anda sedang ditinjau admin. Mohon tunggu.' });
      return;
    }
    if (outcome.rejectionCount >= PARTNER_MAX_REJECTIONS) {
      onInfo({
        icon: 'lock',
        message: 'Anda telah mencapai batas pengajuan ulang. Silakan hubungi CS DRIVE.',
      });
      return;
    }
    try {
      const prefill = await getPartnerProfilePrefill(outcome.token);
      onResolved({
        token: outcome.token,
        role: outcome.role,
        partnerType: partnerTypeFromRole(outcome.role),
        rejectionReason: outcome.rejectionReason,
        prefill,
      });
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Gagal memuat data mitra.'));
    }
  };

  const handleSubmit = async () => {
    if (!email.trim() || !password) {
      toast.error('Lengkapi email dan kata sandi.');
      return;
    }
    setIsLoading(true);
    try {
      const { outcome, errorMessage } = await probeAdminLogin(email.trim(), password);
      if (!outcome) {
        toast.error(errorMessage || 'Email atau kata sandi salah, atau bukan akun mitra.');
        return;
      }
      await resolveOutcome(outcome);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <PageContainer className="bg-neutral-200">
      <AppHeader title="Perbaiki Data Mitra" showLogo />
      <div className="flex flex-1 flex-col px-6 py-8">
        <h1 className="text-deep-blue-500 text-2xl font-bold">Masuk untuk Perbaiki Data</h1>
        <p className="mt-2 text-sm leading-relaxed text-neutral-700">
          Masukkan email dan kata sandi mitra Anda untuk memperbaiki data pendaftaran yang ditolak.
        </p>

        <form
          className="mt-7 flex flex-col gap-4"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <Input
            label="Email Mitra"
            type="email"
            placeholder="Masukan email mitra"
            leftIcon={<Mail className="size-5" />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Kata Sandi"
            type="password"
            placeholder="Masukan kata sandi"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <Button type="submit" size="lg" isLoading={isLoading} className="mt-2">
            Lanjutkan
          </Button>
        </form>
      </div>
    </PageContainer>
  );
}

function ResubmitInfo({
  icon,
  message,
}: {
  icon: 'check' | 'clock' | 'lock' | 'warn';
  message: string;
}) {
  const navigate = useNavigate();
  const Icon =
    icon === 'check'
      ? CheckCircle2
      : icon === 'clock'
        ? Clock
        : icon === 'lock'
          ? Lock
          : AlertTriangle;
  const tone =
    icon === 'check'
      ? 'text-success'
      : icon === 'lock' || icon === 'warn'
        ? 'text-[#e76a6a]'
        : 'text-deep-blue-500';

  return (
    <PageContainer className="bg-neutral-200">
      <AppHeader title="Perbaiki Data Mitra" showLogo />
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <Icon className={`size-12 ${tone}`} />
        <p className="text-sm leading-relaxed text-neutral-800">{message}</p>
        {/* Netral: layar ini juga muncul untuk akun asuransi, yang tidak bisa
            masuk lewat /login/mitra. Pemilih login membawanya ke tempat benar. */}
        <Button fullWidth={false} onClick={() => navigate(ROUTES.login)}>
          Kembali ke Beranda
        </Button>
      </div>
    </PageContainer>
  );
}

function ResubmitForm({ session }: { session: ResubmitSession }) {
  const navigate = useNavigate();
  const { token, role, partnerType, rejectionReason, prefill } = session;
  const [step, setStep] = useState(0);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [ktpFile, setKtpFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    trigger,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<PartnerProfileValues>({
    resolver: zodResolver(partnerProfileSchema),
    mode: 'onTouched',
    defaultValues: toFormValues(prefill),
  });

  const initialPoint =
    prefill.latitude !== 0 || prefill.longitude !== 0
      ? { lat: prefill.latitude, lng: prefill.longitude }
      : undefined;

  const handleBack = () => {
    if (isSubmitting) return;
    if (step > 0) setStep((current) => current - 1);
    else navigate(-1);
  };

  const submit = async () => {
    setIsSubmitting(true);
    try {
      const [logoUrl, picKtpPhotoUrl] = await Promise.all([
        logoFile
          ? uploadPartnerOnboardingImage(logoFile, 'partner_logo')
          : Promise.resolve(prefill.logoUrl),
        ktpFile
          ? uploadPartnerOnboardingImage(ktpFile, 'partner_ktp')
          : Promise.resolve(prefill.picKtpPhotoUrl),
      ]);
      await resubmitPartnerProfile(token, { ...getValues(), logoUrl, picKtpPhotoUrl });
      toast.success('Data berhasil dikirim ulang. Mohon tunggu peninjauan ulang admin.');
      goToLoginAfterResubmit(role, navigate);
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Gagal mengirim ulang data.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleNext = async () => {
    if (isSubmitting) return;
    const valid = await trigger(RESUBMIT_STEP_FIELDS[step] ?? [], { shouldFocus: true });
    if (!valid) return;
    if (step < RESUBMIT_LAST_STEP) {
      setStep((current) => current + 1);
      return;
    }
    void submit();
  };

  return (
    <PageContainer className="bg-neutral-200">
      <AppHeader title="Perbaiki Data Mitra" showLogo onBack={handleBack} />
      <form
        className="flex min-h-[calc(100dvh-60px)] flex-1 flex-col"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void handleNext();
        }}
      >
        <div className="px-5 pt-3 pb-2">
          <StepDots current={step} total={3} />
        </div>

        {rejectionReason.trim() && (
          <div className="border-warning/25 bg-warning/10 mx-5 mt-1 flex items-start gap-2 rounded-lg border p-3">
            <AlertTriangle className="text-warning mt-0.5 size-5 shrink-0" />
            <div>
              <p className="text-12 font-semibold text-neutral-900">Alasan penolakan</p>
              <p className="text-12 mt-0.5 text-neutral-700">{rejectionReason}</p>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-5 py-4">
          {step === 0 && (
            <StepCompany
              register={register}
              errors={errors}
              setValue={setValue}
              logoFile={logoFile}
              onLogoChange={setLogoFile}
              initialPoint={initialPoint}
            />
          )}
          {step === 1 && (
            <StepPic
              register={register}
              errors={errors}
              ktpFile={ktpFile}
              onKtpChange={setKtpFile}
            />
          )}
          {step === 2 && (
            <StepLegal
              register={register}
              errors={errors}
              licenseLabel={licenseLabelFor(partnerType)}
            />
          )}
        </div>

        <div className="border-t border-neutral-300 bg-neutral-100 px-5 pt-3 pb-4">
          <Button
            type="button"
            size="lg"
            isLoading={isSubmitting}
            onClick={() => void handleNext()}
          >
            {step === RESUBMIT_LAST_STEP
              ? `Kirim Ulang Data Mitra ${mitraTypeName(partnerType)}`
              : 'Selanjutnya'}
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}

function toFormValues(prefill: PartnerProfilePrefill): PartnerProfileValues {
  return {
    companyName: prefill.companyName,
    nib: prefill.nib,
    npwp: prefill.npwp ?? '',
    officeAddress: prefill.officeAddress,
    city: prefill.city ?? '',
    province: prefill.province ?? '',
    latitude: prefill.latitude,
    longitude: prefill.longitude,
    companyEmail: prefill.companyEmail,
    companyPhone: prefill.companyPhone ?? '',
    picName: prefill.picName,
    picPosition: prefill.picPosition ?? '',
    picKtpNumber: prefill.picKtpNumber,
    picPhone: prefill.picPhone,
    picEmail: prefill.picEmail ?? '',
    legalDeed: prefill.legalDeed ?? '',
    legalBusinessLicense: prefill.legalBusinessLicense ?? '',
    legalTdpNib: prefill.legalTdpNib ?? '',
    establishedYear: prefill.establishedYear ?? '',
    skKemenkumham: prefill.skKemenkumham ?? '',
  };
}

function mitraTypeName(value: string): string {
  return partnerTypeLabel(value).replace(/^Mitra\s+/i, '');
}
