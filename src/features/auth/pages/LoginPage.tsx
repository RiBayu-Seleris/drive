import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/feedback/toast';
import { buildPath, ROUTES } from '@/app/routes';
import { useDriverStore } from '@/features/auth/store/driverStore';
import { loginSchema, type LoginValues } from '../schemas';
import { useLogin, type LoginMode } from '../hooks/useLogin';

interface LoginCopy {
  title: string;
  subtitle: string;
  submitText: string;
  helper: (redirectTo?: string) => JSX.Element;
  footer: (redirectTo?: string) => JSX.Element;
}

function withRedirect(path: string, redirectTo?: string): string {
  return redirectTo ? `${path}?redirect=${encodeURIComponent(redirectTo)}` : path;
}

const LOGIN_COPY: Record<LoginMode, LoginCopy> = {
  user: {
    title: 'Masuk Pengguna',
    subtitle: 'Kelola checkup kendaraan, klaim asuransi, dan riwayat pembayaran Anda.',
    submitText: 'Masuk sebagai Pengguna',
    helper: (redirectTo) => (
      <>
        Akun mitra dan sopir memakai halaman masuk terpisah.{' '}
        <Link to={withRedirect(ROUTES.loginMitra, redirectTo)} className="font-semibold underline">
          Masuk Mitra
        </Link>
        {' atau '}
        <Link to={withRedirect(ROUTES.loginSopir, redirectTo)} className="font-semibold underline">
          Masuk Sopir
        </Link>
        .
      </>
    ),
    footer: (redirectTo) => {
      const registerHref = redirectTo
        ? `${ROUTES.register}?redirect=${encodeURIComponent(redirectTo)}`
        : ROUTES.register;
      return (
        <span className="inline-flex flex-wrap justify-center gap-x-1">
          <span>Belum punya akun pengguna?</span>{' '}
          <Link to={registerHref} className="text-deep-blue-500 font-semibold">
            Daftar
          </Link>
        </span>
      );
    },
  },
  mitra: {
    title: 'Masuk Mitra',
    subtitle: 'Untuk bengkel dan mitra towing yang sudah aktif di AutoClaim.',
    submitText: 'Masuk sebagai Mitra',
    helper: () => (
      <>
        Mitra baru dapat mulai dari{' '}
        <Link to={buildPath.mitraRegister()} className="font-semibold underline">
          pendaftaran mitra
        </Link>
        {'. Pendaftaran ditolak? '}
        <Link to={ROUTES.mitraResubmit} className="font-semibold underline">
          Perbaiki data mitra
        </Link>
        .
      </>
    ),
    footer: (redirectTo) => (
      <span className="inline-flex flex-wrap justify-center gap-x-1">
        <span>Bukan akun mitra?</span>{' '}
        <Link
          to={withRedirect(ROUTES.loginUser, redirectTo)}
          className="text-deep-blue-500 font-semibold"
        >
          Masuk Pengguna
        </Link>
        <span>atau</span>
        <Link
          to={withRedirect(ROUTES.loginSopir, redirectTo)}
          className="text-deep-blue-500 font-semibold"
        >
          Sopir
        </Link>
      </span>
    ),
  },
  sopir: {
    title: 'Masuk Sopir',
    subtitle: 'Untuk sopir towing yang sudah dibuat oleh admin mitra towing.',
    submitText: 'Masuk sebagai Sopir',
    helper: () => (
      <>
        Akun sopir dibuat dan dikelola oleh admin mitra towing. Hubungi admin mitra bila akun belum
        aktif.
      </>
    ),
    footer: (redirectTo) => (
      <span className="inline-flex flex-wrap justify-center gap-x-1">
        <span>Bukan akun sopir?</span>{' '}
        <Link
          to={withRedirect(ROUTES.loginUser, redirectTo)}
          className="text-deep-blue-500 font-semibold"
        >
          Masuk Pengguna
        </Link>
        <span>atau</span>
        <Link
          to={withRedirect(ROUTES.loginMitra, redirectTo)}
          className="text-deep-blue-500 font-semibold"
        >
          Mitra
        </Link>
      </span>
    ),
  },
};

function LoginPage({ mode }: { mode: LoginMode }) {
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect') ?? undefined;
  const copy = LOGIN_COPY[mode];
  const { submit, isSubmitting } = useLogin(mode);
  const driverLoggedIn = useDriverStore((s) => s.isLoggedIn);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  // Sopir yang masih login tak perlu melihat form ini lagi (mis. gestur back
  // dari portal) — langsung ke portal sopir. Redirect HANYA dihormati bila
  // menuju area /driver; selain itu (mis. /home yang terbawa dari selector)
  // diabaikan agar sopir tidak terlempar keluar portal setelah login.
  if (mode === 'sopir' && driverLoggedIn) {
    const target = redirectTo?.startsWith(ROUTES.driver) ? redirectTo : ROUTES.driver;
    return <Navigate to={target} replace />;
  }

  const onSubmit = handleSubmit(async (values) => {
    const result = await submit(values, redirectTo);
    if (!result.ok && result.message) toast.error(result.message);
  });

  return (
    <AuthLayout title={copy.title} subtitle={copy.subtitle} footer={copy.footer(redirectTo)}>
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Input
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="Masukkan email"
          error={errors.email?.message}
          {...register('email')}
        />
        <Input
          label="Kata Sandi"
          type="password"
          autoComplete="current-password"
          placeholder="Masukkan kata sandi"
          error={errors.password?.message}
          {...register('password')}
        />

        {/* Setel ulang kata sandi tersedia untuk user & mitra. Kata sandi sopir
            tetap disetel oleh admin mitra karena emailnya belum tentu miliknya. */}
        {mode !== 'sopir' && (
          <div className="-mt-1 text-right">
            <Link to={ROUTES.forgotPassword} className="text-deep-blue-500 text-12 font-semibold">
              Lupa kata sandi?
            </Link>
          </div>
        )}

        <Button type="submit" size="lg" isLoading={isSubmitting} className="mt-4">
          {copy.submitText}
        </Button>

        <div className="bg-deep-blue-50 text-12 text-deep-blue-700 mt-2 rounded-lg px-4 py-3">
          {copy.helper(redirectTo)}
        </div>
      </form>
    </AuthLayout>
  );
}

export function UserLoginPage() {
  return <LoginPage mode="user" />;
}

export function MitraLoginPage() {
  return <LoginPage mode="mitra" />;
}

export function SopirLoginPage() {
  return <LoginPage mode="sopir" />;
}
