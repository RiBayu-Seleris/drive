import { NavLink } from 'react-router-dom';
import { Home, User } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { ROUTES } from '@/app/routes';

const TABS = [
  { to: ROUTES.home, label: 'Beranda', icon: Home },
  { to: ROUTES.profile, label: 'Profil', icon: User },
] as const;

/**
 * Navigasi bawah bergaya pil mengambang.
 *
 * Sebelumnya bar selebar layar dengan garis atas — bentuk yang menempel di
 * tepi dan menutup konten. Pil yang melayang di atas latar memberi kedalaman
 * yang sama seperti kartu, dan tab aktif ditandai wadah hijau, bukan sekadar
 * warna ikon (perubahan warna saja terlalu samar di tema gelap).
 */
export function BottomNav() {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center pb-[calc(14px+env(safe-area-inset-bottom))]">
      {/* Peluruhan gelap di belakang pil supaya konten yang lewat di bawahnya
          tidak beradu langsung dengan tepi navigasi. */}
      <div className="absolute inset-x-0 bottom-0 h-24 bg-[linear-gradient(180deg,transparent,rgba(7,12,17,0.92)_62%)]" />

      <nav className="pointer-events-auto relative flex items-center gap-1 rounded-full border border-[#22313c] bg-[#101a22]/95 p-1.5 shadow-[0_18px_36px_-18px_rgba(0,0,0,0.95)] backdrop-blur-sm">
        {TABS.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) =>
              cn(
                'flex items-center gap-2 rounded-full px-5 py-2.5 text-[12px] font-semibold transition-colors',
                isActive
                  ? 'bg-[linear-gradient(148deg,#aded1f,#83bd04)] text-[#10200a] shadow-[0_8px_18px_-10px_rgba(173,237,31,0.9)]'
                  : 'text-neutral-600',
              )
            }
          >
            {({ isActive }) => (
              <>
                <Icon className="size-5" strokeWidth={isActive ? 2.4 : 2} aria-hidden />
                {label}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
