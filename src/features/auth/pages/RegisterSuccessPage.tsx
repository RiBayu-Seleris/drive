import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Check, MailCheck, ShieldCheck, Sparkles } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/app/routes';
import { useAuthStore } from '../store/authStore';

interface RegisterSuccessState {
  /** Tujuan yang ingin dibuka user sebelum diminta mendaftar. */
  redirect?: string;
}

/**
 * Konfirmasi pendaftaran selesai, ditampilkan setelah kode OTP benar.
 *
 * User sengaja TIDAK diminta login ulang: dia baru saja membuktikan memiliki
 * email itu dengan mengetik kode, jadi menyuruhnya mengetik email + kata sandi
 * lagi hanya menambah friksi tanpa menambah keamanan. Sesi sudah aktif saat
 * halaman ini terbuka — halaman ini murni memberi tanda "berhasil" yang jelas,
 * yang sebelumnya cuma berupa toast sekilas.
 */
export function RegisterSuccessPage() {
  const navigate = useNavigate();
  const state = (useLocation().state as RegisterSuccessState | null) ?? {};
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = Boolean(useAuthStore((s) => s.token));

  // Halaman ini hanya bermakna tepat setelah verifikasi. Dibuka langsung tanpa
  // sesi (mis. dari riwayat browser), user diarahkan ke login.
  useEffect(() => {
    if (!isAuthenticated) {
      navigate(ROUTES.loginUser, { replace: true });
    }
  }, [isAuthenticated, navigate]);

  if (!isAuthenticated) return null;

  const continueTo = state.redirect ?? ROUTES.home;
  const continueLabel = state.redirect ? 'Lanjutkan' : 'Mulai Jelajahi';

  return (
    <PageContainer className="bg-neutral-200">
      <AppHeader showLogo showBack={false} />

      <div className="flex flex-1 flex-col px-5 py-6">
        {/* Ikon sukses konsentris, mengikuti pola halaman sukses lain. */}
        <div className="mt-4 flex justify-center">
          <div className="grid size-32 place-items-center rounded-full bg-success/10">
            <div className="grid size-24 place-items-center rounded-full bg-success/15">
              <div className="grid size-16 place-items-center rounded-full bg-success text-white shadow-lg">
                <Check className="size-9" strokeWidth={3} />
              </div>
            </div>
          </div>
        </div>

        <h1 className="text-20 mt-5 text-center font-bold text-neutral-900">
          Pendaftaran Berhasil
        </h1>
        <p className="text-13 mt-2 text-center text-neutral-500">
          {user?.fullname ? `Selamat datang, ${user.fullname}. ` : ''}
          Akun Anda sudah aktif dan siap digunakan.
        </p>

        <div className="drive-card mt-6 rounded-2xl/70 p-4">
          <p className="text-[11px] font-semibold tracking-wide text-neutral-400">DETAIL AKUN</p>
          <div className="mt-3 space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-13 shrink-0 text-neutral-600">Email</span>
              <span className="text-13 truncate font-semibold text-neutral-900">
                {user?.email ?? '-'}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-13 shrink-0 text-neutral-600">Status Email</span>
              <span className="rounded-full bg-success/15 px-3 py-1 text-[11px] font-semibold text-success">
                Terverifikasi
              </span>
            </div>
          </div>
        </div>

        <div className="mt-6 space-y-3">
          <p className="text-[11px] font-semibold tracking-wide text-neutral-400">
            YANG BISA ANDA LAKUKAN
          </p>
          <NextStep
            icon={<Sparkles className="size-4" />}
            title="Periksa kondisi kendaraan"
            description="Pindai mobil Anda untuk melihat kerusakan dan perkiraan biaya perbaikan."
          />
          <NextStep
            icon={<ShieldCheck className="size-4" />}
            title="Lindungi dengan asuransi"
            description="Beli polis langsung dari aplikasi setelah kendaraan dipindai."
          />
          <NextStep
            icon={<MailCheck className="size-4" />}
            title="Pantau klaim Anda"
            description="Ajukan klaim dan ikuti prosesnya sampai selesai tanpa perlu datang ke kantor."
          />
        </div>

        <div className="mt-auto pt-8">
          <Button fullWidth onClick={() => navigate(continueTo, { replace: true })}>
            {continueLabel}
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}

function NextStep({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="drive-card flex gap-3 rounded-xl border border-neutral-200 p-3">
      <div className="text-deep-blue-600 bg-deep-blue-50 grid size-8 shrink-0 place-items-center rounded-lg">
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-13 font-semibold text-neutral-900">{title}</p>
        <p className="text-12 mt-0.5 text-neutral-600">{description}</p>
      </div>
    </div>
  );
}
