import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/feedback/toast';
import { ROUTES } from '@/app/routes';
import { registerSchema, type RegisterValues } from '../schemas';
import { useAuthStore } from '../store/authStore';

export function RegisterPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect') ?? undefined;
  const registerUser = useAuthStore((s) => s.register);
  const isLoading = useAuthStore((s) => s.isLoading);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { fullname: '', email: '', password: '', retypePassword: '' },
  });

  const loginHref = redirectTo
    ? `${ROUTES.loginUser}?redirect=${encodeURIComponent(redirectTo)}`
    : ROUTES.loginUser;

  const onSubmit = handleSubmit(async (values) => {
    const ok = await registerUser(values);
    if (ok) {
      toast.success('Registrasi berhasil. Silakan masuk.');
      navigate(loginHref, { replace: true });
    } else {
      toast.error(useAuthStore.getState().error ?? 'Registrasi gagal. Coba lagi.');
    }
  });

  return (
    <AuthLayout
      title="Registrasi AutoClaim!"
      subtitle="Silakan masukkan data diri Anda untuk mendaftar"
      footer={
        <span>
          Sudah punya akun?{' '}
          <Link to={loginHref} className="text-deep-blue-500 font-semibold">
            Masuk
          </Link>
        </span>
      }
    >
      <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
        <Input
          label="Nama lengkap"
          requiredMark
          placeholder="Masukkan nama lengkap"
          autoComplete="name"
          error={errors.fullname?.message}
          {...register('fullname')}
        />
        <Input
          label="Email"
          requiredMark
          type="email"
          autoComplete="email"
          placeholder="Masukkan email"
          error={errors.email?.message}
          {...register('email')}
        />
        <Input
          label="Kata Sandi"
          requiredMark
          type="password"
          autoComplete="new-password"
          placeholder="Minimal 8 karakter"
          error={errors.password?.message}
          {...register('password')}
        />
        <Input
          label="Konfirmasi Kata Sandi"
          requiredMark
          type="password"
          autoComplete="new-password"
          placeholder="Ulangi kata sandi"
          error={errors.retypePassword?.message}
          {...register('retypePassword')}
        />
        <Button type="submit" size="lg" isLoading={isLoading} className="mt-6">
          Daftar
        </Button>
      </form>
    </AuthLayout>
  );
}
