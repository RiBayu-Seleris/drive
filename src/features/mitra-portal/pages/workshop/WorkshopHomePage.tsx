import { Bell } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { EmptyState } from '@/components/feedback/StateViews';
import { toast } from '@/components/feedback/toast';
import { useMitraStore } from '@/features/auth/store/mitraStore';
import { extractErrorMessage } from '@/lib/api/client';
import { Logo } from '@/components/brand/Logo';
import { MitraShell } from '../../components/MitraShell';
import { BalanceCard } from '../../components/BalanceCard';
import { QuickActionGrid } from '../../components/QuickActionGrid';
import { WORKSHOP_QUICK_ACTIONS } from '../../data/workshopMock';
import { getMitraSaldo } from '../../financeApi';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? 'B';
  const second = parts[1]?.[0] ?? '';
  return (first + second).toUpperCase();
}

/** Home portal mitra bengkel, mengikuti pola home towing dengan konteks pekerjaan bengkel. */
export function WorkshopHomePage() {
  const navigate = useNavigate();
  const name = useMitraStore((s) => s.name);
  const [balance, setBalance] = useState(0);

  useEffect(() => {
    let active = true;
    getMitraSaldo()
      .then((saldo) => {
        if (active) setBalance(saldo.balance);
      })
      .catch((error) => toast.error(extractErrorMessage(error, 'Gagal memuat data mitra.')));
    return () => {
      active = false;
    };
  }, []);

  return (
    <MitraShell>
      {/* HERO FOTO — perlakuannya sama persis dengan hero beranda user:
          foto full-bleed, peluruhan gradien ke bawah, lalu sapuan hijau merek
          dari kiri atas. Mitra dulu cuma dapat strip gelap. */}
      <header className="relative z-0 overflow-hidden px-5 pt-12 pb-28 text-white">
        <img
          src="/assets/mitra/hero-workshop.webp"
          alt=""
          fetchPriority="high"
          className="pointer-events-none absolute inset-0 size-full object-cover object-center"
        />
        {/* Peluruhan ke bawah: foto melebur ke warna halaman, tanpa garis potong. */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(7,12,17,0.55)_0%,rgba(7,12,17,0.35)_30%,rgba(15,23,32,0.92)_76%,#0f1720_100%)]" />
        {/* Sapuan hijau merek dari kiri atas — sumber cahaya yang sama dengan kartu. */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(100%_68%_at_16%_6%,rgba(173,237,31,0.3),transparent_58%)]" />
        <div className="drive-header drive-fade-b pointer-events-none absolute inset-0 opacity-35" />
        <Logo className="relative z-10 mx-auto flex justify-center [&_img]:h-7" />
        <div className="relative z-10 mt-10 flex items-center justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-full bg-white/20 text-sm font-semibold ring-2 ring-white/30">
              {initials(name)}
            </div>
            <div className="min-w-0">
              <p className="text-14 truncate font-semibold">{name || 'Bengkel Mitra DRIVE'}</p>
              <p className="truncate text-[11px] text-white/70">Mitra Bengkel DRIVE</p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Notifikasi"
            className="relative grid size-10 shrink-0 place-items-center rounded-full bg-white/15"
          >
            <Bell className="size-5" />
          </button>
        </div>
      </header>

      <div className="relative z-10 -mt-16">
        <div className="px-5">
          <BalanceCard amount={balance} onWithdraw={() => navigate(ROUTES.mitraTarikSaldo)} />
        </div>

        <section className="mt-5 px-5">
          <QuickActionGrid actions={WORKSHOP_QUICK_ACTIONS} />
        </section>

        <section className="mt-6 px-5">
          <h2 className="text-14 font-semibold text-neutral-900">Aktivitas Bengkel</h2>
          <div className="mt-3">
            <EmptyState
              title="Belum ada aktivitas"
              description="Aktivitas bengkel akan muncul di sini."
            />
          </div>
        </section>
      </div>
    </MitraShell>
  );
}
