import { Bell } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { useMitraStore } from '@/features/auth/store/mitraStore';
import { extractErrorMessage } from '@/lib/api/client';
import { toast } from '@/components/feedback/toast';
import { Logo } from '@/components/brand/Logo';
import { MitraShell } from '../../components/MitraShell';
import { BalanceCard } from '../../components/BalanceCard';
import { QuickActionGrid } from '../../components/QuickActionGrid';
import { TOWING_QUICK_ACTIONS } from '../../data/towingMock';
import { getMitraSaldo } from '../../financeApi';
import {
  fleetTypeLabel,
  getMitraTowingOrders,
  towingStatusLabel,
  type MitraTowingOrder,
} from '../../api';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? 'M';
  const second = parts[1]?.[0] ?? '';
  return (first + second).toUpperCase();
}

function timeLabel(value: string): string {
  if (!value) return 'Baru saja';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Baru saja';
  return new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(date);
}

function orderDescription(order: MitraTowingOrder): string {
  const pickup = order.pickupAddress || 'Lokasi jemput';
  const destination = order.dropoffAddress || order.workshopName || 'Tujuan';
  return `${towingStatusLabel(order.status)} • ${pickup} -> ${destination}`;
}

/** Home portal mitra towing: hero biru (logo + profil) di belakang, konten di depan. */
export function TowingHomePage() {
  const navigate = useNavigate();
  const name = useMitraStore((s) => s.name);
  const email = useMitraStore((s) => s.email);
  const [balance, setBalance] = useState(0);
  const [orders, setOrders] = useState<MitraTowingOrder[]>([]);
  const [offeredCount, setOfferedCount] = useState(0);
  const [loadingActivities, setLoadingActivities] = useState(true);

  useEffect(() => {
    let active = true;
    setLoadingActivities(true);
    Promise.all([
      getMitraSaldo(),
      getMitraTowingOrders({ page: 1, limit: 5 }),
      getMitraTowingOrders({ status: 'OFFERED', page: 1, limit: 1 }),
    ])
      .then(([saldo, orderResult, offeredResult]) => {
        if (!active) return;
        setBalance(saldo.balance);
        setOrders(orderResult.data);
        setOfferedCount(offeredResult.total);
      })
      .catch((error) => toast.error(extractErrorMessage(error, 'Gagal memuat data mitra.')))
      .finally(() => {
        if (active) setLoadingActivities(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const activities = useMemo(
    () =>
      orders.map((order) => ({
        id: String(order.id),
        driverName: order.driverFullname || order.userFullname || 'Order Towing',
        description: orderDescription(order),
        time: timeLabel(order.requestedAt),
        fleetLabel:
          order.fleetPlateNumber ||
          (order.fleetId ? `Armada ${order.fleetId}` : fleetTypeLabel(order.fleetType) || 'Armada'),
      })),
    [orders],
  );

  return (
    <MitraShell>
      {/* HERO FOTO — perlakuannya sama persis dengan hero beranda user:
          foto full-bleed, peluruhan gradien ke bawah, lalu sapuan hijau merek
          dari kiri atas. Mitra dulu cuma dapat strip gelap. */}
      <header className="relative z-0 overflow-hidden px-5 pt-12 pb-20 text-white">
        <img
          src="/assets/mitra/hero-admin-towing.webp"
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
        <div className="relative z-10 mt-10 flex items-start justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid size-11 shrink-0 place-items-center rounded-full bg-white/20 text-sm font-semibold ring-2 ring-white/60">
              {initials(name)}
            </div>
            <div className="min-w-0">
              <p className="text-14 truncate font-semibold">{name || 'Mitra Towing'}</p>
              <p className="truncate text-[11px] text-white/70">
                {email || 'Mitra Towing DRIVE'}
              </p>
            </div>
          </div>
          <button
            type="button"
            aria-label="Notifikasi"
            className="relative grid size-10 shrink-0 place-items-center"
          >
            <Bell className="size-6" fill="currentColor" strokeWidth={1.5} />
            {offeredCount > 0 && (
              <span className="absolute top-0 right-0 grid size-4.5 place-items-center rounded-full bg-[#df3a3a] text-[9px] font-bold text-white ring-2 ring-white/40">
                {offeredCount > 9 ? '9+' : offeredCount}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* KONTEN — lapisan depan, menumpuk tipis di atas hero (sesuai desain) */}
      <div className="relative z-10 -mt-8">
        <div className="px-5">
          <BalanceCard
            amount={balance}
            onWithdraw={() => navigate(ROUTES.mitraTarikSaldo)}
          />
        </div>

        <section className="mt-5 px-5">
          <QuickActionGrid actions={TOWING_QUICK_ACTIONS} />
        </section>

        {/* Aktivitas terkini — di desain tampil polos tanpa judul */}
        <section className="mt-6 px-5">
          <div className="space-y-3">
            {loadingActivities ? (
              <p className="text-12 py-6 text-center text-neutral-500">Memuat aktivitas…</p>
            ) : activities.length === 0 ? (
              <p className="text-12 py-6 text-center text-neutral-500">Belum ada aktivitas.</p>
            ) : (
              activities.map((act) => (
              <div
                key={act.id}
                className="flex items-center gap-3 border-b border-neutral-200 pb-3 last:border-0"
              >
                <div className="relative shrink-0">
                  <div className="bg-deep-blue-50 text-deep-blue-600 grid size-10 place-items-center rounded-full text-xs font-semibold">
                    {initials(act.driverName)}
                  </div>
                  <span className="bg-green-cust absolute -right-0.5 -bottom-0.5 size-3 rounded-full border-2 border-white" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-12 font-semibold text-neutral-900">{act.driverName}</p>
                  <p className="truncate text-[11px] text-neutral-600">{act.description}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-[11px] text-neutral-700">{act.time}</p>
                  <p className="text-[11px] text-neutral-500">{act.fleetLabel}</p>
                </div>
              </div>
              ))
            )}
          </div>
        </section>
      </div>
    </MitraShell>
  );
}
