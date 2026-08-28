import { useState } from 'react';
import { Truck, Mail } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { AppHeader } from '@/components/layout/AppHeader';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/feedback/toast';
import { useDriverStore } from '@/features/auth/store/driverStore';

export function DriverLoginPage() {
  const loginAsDriver = useDriverStore((s) => s.loginAsDriver);
  const isLoading = useDriverStore((s) => s.isLoading);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = await loginAsDriver(email.trim(), password);
    if (!ok) toast.error(useDriverStore.getState().error ?? 'Login gagal.');
  };

  return (
    <PageContainer className="bg-neutral-200">
      <AppHeader title="Masuk Sopir Towing" />
      <form onSubmit={handleSubmit} className="flex flex-1 flex-col px-6 py-8">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <div className="bg-deep-blue-50 text-deep-blue-500 flex size-16 items-center justify-center rounded-lg">
            <Truck className="size-8" />
          </div>
          <div>
            <h1 className="text-18 font-semibold text-neutral-900">Portal Sopir Towing</h1>
            <p className="text-12 mt-1 text-neutral-700">
              Masuk dengan akun yang dibuat oleh mitra Anda.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-4">
          <Input
            label="Email"
            type="email"
            placeholder="email@mitra.com"
            leftIcon={<Mail className="size-5" />}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <Input
            label="Kata Sandi"
            type="password"
            placeholder="Masukkan kata sandi"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <div className="mt-auto pt-8">
          <Button type="submit" size="lg" isLoading={isLoading} disabled={!email || !password}>
            Masuk
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}
