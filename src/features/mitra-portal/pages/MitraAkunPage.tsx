import { useNavigate } from 'react-router-dom';
import { ChevronRight, Handshake, LogOut, User } from 'lucide-react';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/Button';
import { confirm } from '@/components/feedback/confirm';
import { ROUTES } from '@/app/routes';
import { useMitraStore } from '@/features/auth/store/mitraStore';
import { MitraShell } from '../components/MitraShell';
import { usePendingPartnershipCount } from '../usePendingPartnership';

/** Tab Akun portal mitra: profil ringkas + keluar. */
export function MitraAkunPage() {
  const navigate = useNavigate();
  const name = useMitraStore((s) => s.name);
  const role = useMitraStore((s) => s.role);
  const partnerType = useMitraStore((s) => s.partnerType);
  const logout = useMitraStore((s) => s.logout);
  const pendingInvites = usePendingPartnershipCount();

  const handleLogout = async () => {
    const ok = await confirm({
      title: 'Keluar',
      message: 'Yakin keluar dari portal mitra?',
      confirmText: 'Keluar',
      tone: 'danger',
    });
    if (!ok) return;
    logout();
    navigate(ROUTES.loginMitra, { replace: true });
  };

  return (
    <MitraShell>
      <AppHeader title="Akun" />
      <div className="px-5 py-6">
        <div className="flex items-center gap-4 rounded-2xl bg-white p-5 shadow-sm">
          <div className="bg-deep-blue-50 text-deep-blue-600 grid size-14 place-items-center rounded-full">
            <User className="size-7" />
          </div>
          <div className="min-w-0">
            <p className="text-14 font-semibold text-neutral-900">{name || 'Mitra'}</p>
            <p className="text-12 text-neutral-600 capitalize">{role.replace(/_/g, ' ')}</p>
          </div>
        </div>
        {/* Kemitraan asuransi hanya relevan untuk mitra towing independen. */}
        {partnerType === 'towing' && (
          <button
            type="button"
            onClick={() => navigate(ROUTES.mitraKemitraan)}
            className="mt-4 flex w-full items-center gap-3 rounded-2xl bg-white p-4 text-left shadow-sm transition active:scale-[0.99]"
          >
            <span className="bg-deep-blue-50 text-deep-blue-600 grid size-10 shrink-0 place-items-center rounded-full">
              <Handshake className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-14 block font-semibold text-neutral-900">
                Kemitraan Asuransi
              </span>
              <span className="text-12 block text-neutral-500">
                Kelola asuransi yang menjadi rekanan Anda
              </span>
            </span>
            {pendingInvites > 0 && (
              <span className="bg-danger text-11 grid min-w-5 shrink-0 place-items-center rounded-full px-1.5 py-0.5 font-bold text-white">
                {pendingInvites}
              </span>
            )}
            <ChevronRight className="size-5 shrink-0 text-neutral-400" />
          </button>
        )}

        <Button
          variant="outline"
          className="mt-6"
          leftIcon={<LogOut className="size-5" />}
          onClick={handleLogout}
        >
          Keluar
        </Button>
      </div>
    </MitraShell>
  );
}
