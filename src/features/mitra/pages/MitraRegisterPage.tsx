import { useEffect, useState } from 'react';
import {
  useForm,
  type FieldErrors,
  type FieldPath,
  type UseFormRegister,
  type UseFormSetValue,
} from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Mail } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { AppHeader } from '@/components/layout/AppHeader';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/feedback/toast';
import { extractErrorMessage } from '@/lib/api/client';
import { ROUTES, buildPath } from '@/app/routes';
import { env } from '@/config/env';
import {
  isEmailAvailable,
  registerPartner,
  uploadPartnerOnboardingImage,
} from '@/features/auth/api/authApi';
import { confirm } from '@/components/feedback/confirm';
import {
  PARTNER_TYPES,
  ALLOWED_PARTNER_TYPES,
  isPartnerTypeComingSoon,
  partnerTypeLabel,
  licenseLabelFor,
} from '../constants';
import {
  partnerRegisterSchema,
  type PartnerProfileValues,
  type PartnerRegisterValues,
} from '../schemas';
import { StepCompany, StepDots, StepLegal, StepPic } from '../components/ProfileSteps';

const LAST_STEP = 3;
const STEP_STATE_KEY = 'mitraRegisterStep';

type PartnerRegisterField = FieldPath<PartnerRegisterValues>;

const STEP_FIELDS: PartnerRegisterField[][] = [
  ['email', 'password', 'retypePassword'],
  ['companyName', 'nib', 'officeAddress', 'companyEmail'],
  ['picName', 'picKtpNumber', 'picPhone'],
  ['legalDeed', 'legalBusinessLicense', 'legalTdpNib', 'establishedYear', 'skKemenkumham'],
];

const DEFAULT_VALUES: PartnerRegisterValues = {
  email: '',
  password: '',
  retypePassword: '',
  companyName: '',
  nib: '',
  npwp: '',
  officeAddress: '',
  city: '',
  province: '',
  latitude: 0,
  longitude: 0,
  companyEmail: '',
  companyPhone: '',
  picName: '',
  picPosition: '',
  picKtpNumber: '',
  picPhone: '',
  picEmail: '',
  legalDeed: '',
  legalBusinessLicense: '',
  legalTdpNib: '',
  establishedYear: '',
  skKemenkumham: '',
};

export function MitraRegisterPage() {
  const [searchParams] = useSearchParams();
  const partner = searchParams.get('partner') ?? '';

  // Jenis yang belum dibuka ikut dipulangkan ke pemilih, supaya membuka
  // URL-nya langsung tidak bisa melewati pemberitahuan di layar pemilihan.
  if (!ALLOWED_PARTNER_TYPES.has(partner) || isPartnerTypeComingSoon(partner)) {
    return <MitraTypeChooser initialNoticeFor={isPartnerTypeComingSoon(partner) ? partner : ''} />;
  }
  return <MitraRegisterForm partnerType={partner} />;
}

/** Popup pemberitahuan bahwa pendaftaran jenis mitra ini belum dibuka. */
async function showComingSoonNotice(partnerValue: string) {
  await confirm({
    title: 'Dalam Pengembangan',
    message: `Pendaftaran ${partnerTypeLabel(partnerValue)} belum dibuka. Alur kemitraannya masih kami siapkan. Silakan pilih jenis mitra lain untuk saat ini.`,
    confirmText: 'Mengerti',
    hideCancel: true,
  });
}

function MitraTypeChooser({ initialNoticeFor = '' }: { initialNoticeFor?: string }) {
  const navigate = useNavigate();
  const [selected, setSelected] = useState(initialNoticeFor || PARTNER_TYPES[0]!.value);

  // Sampai di sini lewat URL langsung ke jenis yang belum dibuka.
  useEffect(() => {
    if (initialNoticeFor) void showComingSoonNotice(initialNoticeFor);
  }, [initialNoticeFor]);

  const handleContinue = () => {
    if (isPartnerTypeComingSoon(selected)) {
      void showComingSoonNotice(selected);
      return;
    }
    navigate(buildPath.mitraRegister(selected));
  };

  return (
    <PageContainer className="bg-white">
      <AppHeader title="Pendaftaran Mitra" showLogo />
      <div className="flex flex-1 flex-col px-6 py-6">
        <img
          src="/assets/mitra/logo-register-mitra.png"
          alt=""
          className="mx-auto mb-6 h-[172px] w-auto object-contain"
        />
        <h1 className="text-deep-blue-500 text-center text-[27px] leading-[1.18] font-bold">
          Pilih Jenis Mitra
        </h1>
        <p className="text-14 mt-3 text-center leading-6 text-neutral-700">
          Pilih jenis kemitraan yang ingin Anda daftarkan.
        </p>

        <div className="mt-6 flex flex-col gap-3">
          {PARTNER_TYPES.map(({ value, label, description, icon: Icon }) => {
            const active = selected === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => setSelected(value)}
                className={`flex items-center gap-3 rounded-lg border p-4 text-left transition ${
                  active ? 'border-deep-blue-500 bg-deep-blue-50' : 'border-neutral-400 bg-white'
                }`}
              >
                <span
                  className={`flex size-11 items-center justify-center rounded-lg ${
                    active ? 'bg-deep-blue-500 text-white' : 'bg-neutral-200 text-neutral-600'
                  }`}
                >
                  <Icon className="size-6" />
                </span>
                <span className="flex-1">
                  <span className="text-14 block font-semibold text-neutral-900">{label}</span>
                  <span className="text-12 block text-neutral-600">{description}</span>
                </span>
                <span
                  className={`size-4 rounded-full border-2 ${
                    active ? 'border-deep-blue-500 bg-deep-blue-500' : 'border-neutral-400'
                  }`}
                />
              </button>
            );
          })}
        </div>

        <div className="mt-auto pt-8">
          <Button size="lg" onClick={handleContinue}>
            Lanjutkan
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}

function MitraRegisterForm({ partnerType }: { partnerType: string }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [step, setStep] = useState(() => readRegisterStep(location.state));
  const [checkingEmail, setCheckingEmail] = useState(false);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [ktpFile, setKtpFile] = useState<File | null>(null);
  const typeLabel = mitraTypeName(partnerType);

  const {
    register,
    handleSubmit,
    trigger,
    setValue,
    setError,
    getValues,
    watch,
    formState: { errors },
  } = useForm<PartnerRegisterValues>({
    resolver: zodResolver(partnerRegisterSchema),
    mode: 'onTouched',
    defaultValues: DEFAULT_VALUES,
  });

  const accountEmail = watch('email');
  useEffect(() => {
    setValue('companyEmail', accountEmail.trim(), { shouldDirty: false, shouldValidate: step > 0 });
  }, [accountEmail, setValue, step]);

  useEffect(() => {
    const historyStep = readRegisterStep(location.state);
    setStep((current) => (current === historyStep ? current : historyStep));
  }, [location.state]);

  const mutation = useMutation({
    mutationFn: async (values: PartnerRegisterValues) => {
      const [logoUrl, picKtpPhotoUrl] = await Promise.all([
        logoFile ? uploadPartnerOnboardingImage(logoFile, 'partner_logo') : Promise.resolve(''),
        ktpFile ? uploadPartnerOnboardingImage(ktpFile, 'partner_ktp') : Promise.resolve(''),
      ]);
      await registerPartner({ partnerType, ...values, logoUrl, picKtpPhotoUrl });
    },
    onSuccess: () => {
      // Tidak ada email aktivasi: begitu admin menyetujui, akun langsung aktif
      // dan mitra bisa langsung masuk.
      //
      // Mitra ASURANSI masuknya lewat Backoffice, bukan portal mitra di sini —
      // mengarahkannya ke halaman masuk mitra akan berujung penolakan.
      if (partnerType === 'insurance') {
        toast.success(
          'Pendaftaran terkirim. Setelah disetujui admin, masuk lewat Backoffice AutoClaim.',
        );
        if (env.backofficeUrl) {
          window.location.href = `${env.backofficeUrl}/login`;
          return;
        }
        navigate(ROUTES.login, { replace: true });
        return;
      }
      toast.success('Pendaftaran terkirim. Anda bisa masuk setelah disetujui admin.');
      navigate(ROUTES.loginMitra, { replace: true });
    },
    onError: (error) => toast.error(extractErrorMessage(error, 'Pendaftaran mitra gagal.')),
  });

  const submit = handleSubmit((values) => mutation.mutate(values));

  const handleBack = () => {
    if (mutation.isPending) return;
    if (step > 0) {
      if (readRegisterStep(location.state) > 0) {
        navigate(-1);
        return;
      }
      setStep((current) => Math.max(0, current - 1));
      return;
    }
    navigate(-1);
  };

  const handleNext = async () => {
    if (mutation.isPending || checkingEmail) return;
    if (step === 0) {
      setValue('companyEmail', getValues('email').trim(), { shouldValidate: true });
    }
    const valid = await trigger(STEP_FIELDS[step] ?? [], { shouldFocus: true });
    if (!valid) return;

    // Bentrok email dicegat di langkah pertama, sebelum ada logo & foto KTP yang
    // terlanjur terunggah. Sebelumnya baru ketahuan saat submit terakhir:
    // berkasnya jadi yatim di storage dan seluruh pengisian formulir terbuang.
    if (step === 0) {
      setCheckingEmail(true);
      try {
        const available = await isEmailAvailable(getValues('email').trim());
        if (!available) {
          setError('email', {
            message: 'Email ini sudah terdaftar. Gunakan email lain atau masuk.',
          });
          return;
        }
      } catch {
        // Gagal memeriksa (mis. jaringan) tidak boleh mengunci pendaftaran —
        // backend tetap menolak duplikat saat submit.
      } finally {
        setCheckingEmail(false);
      }
    }

    if (step < LAST_STEP) {
      const nextStep = step + 1;
      setStep(nextStep);
      navigate(
        { pathname: location.pathname, search: location.search },
        { state: { [STEP_STATE_KEY]: nextStep } },
      );
      return;
    }
    void submit();
  };

  // Step profil dipakai bersama dengan alur resubmit; tipe form di sini adalah
  // superset (berisi field akun), jadi disempitkan ke PartnerProfileValues.
  const profileRegister = register as unknown as UseFormRegister<PartnerProfileValues>;
  const profileErrors = errors as unknown as FieldErrors<PartnerProfileValues>;
  const profileSetValue = setValue as unknown as UseFormSetValue<PartnerProfileValues>;

  return (
    <PageContainer className="bg-white">
      <AppHeader showLogo onBack={handleBack} />
      <form
        className="flex min-h-[calc(100dvh-60px)] flex-1 flex-col"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void handleNext();
        }}
      >
        <div className="px-5 pt-3 pb-2">
          <StepDots current={step} total={4} />
        </div>

        <div className="flex-1 overflow-y-auto px-5 pb-4">
          {step === 0 && (
            <StepAccount
              typeLabel={typeLabel}
              isInsurance={partnerType === 'insurance'}
              register={register}
              errors={errors}
            />
          )}
          {step === 1 && (
            <StepCompany
              register={profileRegister}
              errors={profileErrors}
              setValue={profileSetValue}
              logoFile={logoFile}
              onLogoChange={setLogoFile}
            />
          )}
          {step === 2 && (
            <StepPic
              register={profileRegister}
              errors={profileErrors}
              ktpFile={ktpFile}
              onKtpChange={setKtpFile}
            />
          )}
          {step === 3 && (
            <StepLegal
              register={profileRegister}
              errors={profileErrors}
              licenseLabel={licenseLabelFor(partnerType)}
            />
          )}
        </div>

        <div className="border-t border-neutral-300 bg-white px-5 pt-3 pb-4">
          <Button
            type="button"
            size="lg"
            isLoading={mutation.isPending || checkingEmail}
            onClick={() => void handleNext()}
          >
            Selanjutnya
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}

function StepAccount({
  typeLabel,
  isInsurance,
  register,
  errors,
}: {
  typeLabel: string;
  /** Asuransi masuk lewat Backoffice, bukan portal mitra di aplikasi ini. */
  isInsurance: boolean;
  register: UseFormRegister<PartnerRegisterValues>;
  errors: FieldErrors<PartnerRegisterValues>;
}) {
  return (
    <div className="pb-5">
      <img
        src="/assets/mitra/logo-register-mitra.png"
        alt=""
        className="mx-auto h-[230px] w-auto object-contain"
      />
      <div className="text-center">
        <h1 className="text-deep-blue-500 text-[26px] leading-[1.18] font-bold">
          Registrasi Mitra {typeLabel}
          <br />
          AutoClaim
        </h1>
        <p className="mt-3 text-[15px] text-neutral-700">
          Silakan isi data yang diperlukan untuk bergabung
        </p>
      </div>

      <div className="mt-7 flex flex-col gap-4">
        <Input
          label="Email (email perusahaan)"
          requiredMark
          type="email"
          placeholder="Masukan email perusahaan"
          leftIcon={<Mail className="size-5" />}
          error={errors.email?.message}
          {...register('email')}
        />
        <Input
          label="Kata Sandi"
          requiredMark
          type="password"
          placeholder="Masukan kata sandi"
          error={errors.password?.message}
          {...register('password')}
        />
        <Input
          label="Konfirmasi Kata Sandi"
          requiredMark
          type="password"
          placeholder="Masukan konfirmasi kata sandi"
          error={errors.retypePassword?.message}
          {...register('retypePassword')}
        />
      </div>

      <p className="mt-5 text-center text-sm text-neutral-700">
        Sudah punya akun?{' '}
        {isInsurance && env.backofficeUrl ? (
          <a
            href={`${env.backofficeUrl}/login`}
            className="text-deep-blue-500 font-bold"
            rel="noreferrer"
          >
            Masuk lewat Backoffice
          </a>
        ) : (
          <Link
            to={isInsurance ? ROUTES.login : ROUTES.loginMitra}
            className="text-deep-blue-500 font-bold"
          >
            Masuk
          </Link>
        )}
      </p>
    </div>
  );
}

function mitraTypeName(value: string): string {
  return partnerTypeLabel(value).replace(/^Mitra\s+/i, '');
}

function readRegisterStep(state: unknown): number {
  if (!state || typeof state !== 'object') return 0;
  const value = (state as Record<string, unknown>)[STEP_STATE_KEY];
  if (typeof value !== 'number' || !Number.isInteger(value)) return 0;
  if (value < 0 || value > LAST_STEP) return 0;
  return value;
}
