import { NavLink } from 'react-router-dom';
import { Home, Truck, BarChart3, User, ClipboardList } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { ROUTES } from '@/app/routes';
import { useMitraStore } from '@/features/auth/store/mitraStore';
import { usePendingPartnershipCount } from '../usePendingPartnership';

const TOWING_TABS = [
  { to: ROUTES.mitra, label: 'Home', icon: Home },
  { to: ROUTES.mitraArmada, label: 'Armada', icon: Truck },
  { to: ROUTES.mitraLaporan, label: 'Laporan', icon: BarChart3 },
  { to: ROUTES.mitraAkun, label: 'Akun', icon: User },
] as const;

const WORKSHOP_TABS = [
  { to: ROUTES.mitra, label: 'Home', icon: Home },
  { to: ROUTES.mitraWorkshopJobs, label: 'Antrian', icon: ClipboardList },
  { to: ROUTES.mitraLaporan, label: 'Laporan', icon: BarChart3 },
  { to: ROUTES.mitraAkun, label: 'Akun', icon: User },
] as const;

/** Bottom nav portal mitra (Home/Armada/Laporan/Akun). */
export function MitraBottomNav() {
  const partnerType = useMitraStore((s) => s.partnerType);
  const tabs = partnerType === 'workshop' ? WORKSHOP_TABS : TOWING_TABS;
  // Undangan kemitraan asuransi ada di tab Akun; tandai titik supaya terlihat
  // dari mana pun tanpa harus membuka menunya dulu.
  const pendingInvites = usePendingPartnershipCount();

  return (
    <nav className="pb-safe fixed bottom-0 left-1/2 z-50 w-full max-w-md -translate-x-1/2 border-t border-neutral-300 bg-white px-4 py-2 text-xs text-neutral-700 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
      <div className="flex justify-between">
        {tabs.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) =>
              cn(
                'flex flex-1 flex-col items-center gap-1 py-1 transition-colors duration-200',
                isActive ? 'text-deep-blue-500' : 'text-neutral-600',
              )
            }
          >
            {({ isActive }) => (
              <>
                <span className="relative">
                  <Icon className="size-6" strokeWidth={isActive ? 2.5 : 2} />
                  {label === 'Akun' && pendingInvites > 0 && (
                    <span className="bg-danger absolute -top-0.5 -right-1 size-2.5 rounded-full border-2 border-white" />
                  )}
                </span>
                {label}
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
