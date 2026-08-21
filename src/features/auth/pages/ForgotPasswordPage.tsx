import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/feedback/toast';
import { extractErrorMessage } from '@/lib/api/client';
import { ROUTES } from '@/app/routes';
import { requestPasswordReset } from '../api/authApi';
import { forgotPasswordSchema, type ForgotPasswordValues } from '../schemas';
import type { VerifyResetCodeState } from './VerifyResetCodePage';

export function ForgotPasswordPage() {
  const navigate = useNavigate();

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    const email = values.email.trim();
    try {
      await requestPasswordReset(email);
      // Backend sengaja membalas seragam, jadi halaman berikutnya tetap dibuka
      // meski emailnya tidak terdaftar — kalau tidak, layar ini berubah jadi
      // alat pengecek email mana yang punya akun.
      const state: VerifyResetCodeState = { email };
      navigate(ROUTES.verifyResetCode, { state });
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Gagal mengirim kode. Coba lagi.'));
    }
  });

  return (
    <AuthLayout
      title="Lupa Kata Sandi"
      subtitle="Masukkan email akun Anda. Kami akan mengirim kode untuk membuat kata sandi baru."
      footer={
        <span>
          Ingat kata sandi Anda?{' '}
          <Link to={ROUTES.loginUser} className="text-deep-blue-500 font-semibold">
            Masuk
          </Link>
        </span>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Input
          label="Email"
          requiredMark
          type="email"
          autoComplete="email"
          placeholder="Masukkan email akun Anda"
          error={errors.email?.message}
          {...register('email')}
        />
        <Button type="submit" size="lg" isLoading={isSubmitting} className="mt-2">
          Kirim Kode
        </Button>
      </form>
    </AuthLayout>
  );
}
