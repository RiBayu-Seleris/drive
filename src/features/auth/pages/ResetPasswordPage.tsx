import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/feedback/toast';
import { extractErrorMessage } from '@/lib/api/client';
import { ROUTES } from '@/app/routes';
import { env } from '@/config/env';
import { resetPassword, type PasswordResetLoginTarget } from '../api/authApi';
import { resetPasswordSchema, type ResetPasswordValues } from '../schemas';
import { maskEmail } from '../otp';

/**
 * Dibawa dari halaman verifikasi kode. `resetToken` adalah hasil penukaran
 * kode 6 digit — sekali pakai dan berumur pendek, jadi halaman ini tidak
 * pernah menyentuh kodenya sama sekali.
 */
export interface ResetPasswordState {
  email: string;
  resetToken: string;
  /** Halaman masuk yang dituju setelah berhasil (lihat loginTargetForRole). */
  loginTarget?: PasswordResetLoginTarget;
}

function readState(state: unknown): ResetPasswordState | null {
  if (!state || typeof state !== 'object') return null;
  const record = state as Record<string, unknown>;
  const email = record.email;
  const resetToken = record.resetToken;
  if (typeof email !== 'string' || !email.trim()) return null;
  if (typeof resetToken !== 'string' || !resetToken.trim()) return null;
  const target = record.loginTarget;
  return {
    email: email.trim(),
    resetToken,
    loginTarget:
      target === 'mitra' || target === 'backoffice' || target === 'user' ? target : 'user',
  };
}

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = useMemo(() => readState(location.state), [location.state]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { newPassword: '', retypePassword: '' },
  });

  // Tanpa token (mis. halaman dibuka langsung) alur ini tak bisa jalan.
  useEffect(() => {
    if (!state) {
      toast.error('Sesi tidak ditemukan. Mulai lagi dari Lupa Kata Sandi.');
      navigate(ROUTES.forgotPassword, { replace: true });
    }
  }, [state, navigate]);

  const target = state?.loginTarget ?? 'user';
  const isPartner = target !== 'user';
  const loginRoute = target === 'mitra' ? ROUTES.loginMitra : ROUTES.loginUser;

  /**
   * Mitra asuransi masuk lewat Backoffice, aplikasi terpisah. Kalau URL-nya
   * dikonfigurasi, mereka dilempar ke sana; kalau tidak, cukup diberi tahu
   * lalu diarahkan ke pemilih halaman masuk (bukan ke portal mitra, karena
   * asuransi pasti ditolak di sana).
   */
  const goToLogin = () => {
    if (target === 'backoffice') {
      if (env.backofficeUrl) {
        window.location.href = `${env.backofficeUrl}/login`;
        return;
      }
      navigate(ROUTES.login, { replace: true });
      return;
    }
    navigate(loginRoute, { replace: true });
  };

  const onSubmit = handleSubmit(async (values) => {
    if (!state) return;
    try {
      await resetPassword({
        email: state.email,
        resetToken: state.resetToken,
        newPassword: values.newPassword,
        retypePassword: values.retypePassword,
      });
      toast.success(
        target === 'backoffice'
          ? 'Kata sandi berhasil diubah. Silakan masuk lewat Backoffice DRIVE.'
          : 'Kata sandi berhasil diubah. Silakan masuk.',
      );
      goToLogin();
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Gagal mengubah kata sandi.'));
    }
  });

  if (!state) return null;

  return (
    <AuthLayout
      title="Buat Kata Sandi Baru"
      subtitle={`Kode untuk ${maskEmail(state.email)} sudah terverifikasi. Tentukan kata sandi baru Anda.`}
      footer={
        <button type="button" className="text-deep-blue-500 font-semibold" onClick={goToLogin}>
          Kembali ke halaman masuk
        </button>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Input
          label="Kata Sandi Baru"
          requiredMark
          type="password"
          autoComplete="new-password"
          placeholder="Minimal 8 karakter"
          error={errors.newPassword?.message}
          {...register('newPassword')}
        />
        <Input
          label="Konfirmasi Kata Sandi Baru"
          requiredMark
          type="password"
          autoComplete="new-password"
          placeholder="Ulangi kata sandi baru"
          error={errors.retypePassword?.message}
          {...register('retypePassword')}
        />

        <Button type="submit" size="lg" isLoading={isSubmitting} className="mt-2">
          Simpan Kata Sandi
        </Button>

        <p className="text-12 text-center leading-5 text-neutral-500">
          Setelah kata sandi diubah, semua perangkat yang masih masuk akan dikeluarkan.
          {isPartner && ' Penarikan saldo juga ditahan 24 jam demi keamanan.'}
          {target === 'backoffice' && ' Akun asuransi masuk lewat Backoffice DRIVE.'}
        </p>
      </form>
    </AuthLayout>
  );
}
