import type { ReactNode } from 'react';
import { cn } from '@/lib/utils/cn';
import { MitraBottomNav } from './MitraBottomNav';

/**
 * Kerangka halaman portal mitra: kanvas mobile terpusat + bottom nav tetap.
 * `pb-24` memberi ruang agar konten tidak tertutup nav.
 *
 * Latar halaman memakai `neutral-200` (#0f1720), BUKAN `neutral-100` (#131c24).
 * Sebelumnya keduanya #131c24 — warna kartu dan warna halaman sama persis,
 * jadi kartu di daftar sopir/armada/order tidak punya batas sama sekali dan
 * seluruh isinya menyatu jadi satu bidang. Kartu duduk di atas latar ini
 * memakai `.drive-card`, yang membawa garis tepi dan kilau tepinya sendiri.
 */
export function MitraShell({
  children,
  className,
  hideNav = false,
}: {
  children: ReactNode;
  className?: string;
  /** Sembunyikan bottom nav untuk alur fokus (mis. sukses/konfirmasi). */
  hideNav?: boolean;
}) {
  return (
    <div className="min-h-dvh bg-neutral-200">
      <div
        className={cn(
          'relative mx-auto flex min-h-dvh w-full max-w-md flex-col overflow-x-hidden bg-neutral-200',
          hideNav ? 'pb-0' : 'pb-24',
          className,
        )}
      >
        {children}
        {!hideNav && <MitraBottomNav />}
      </div>
    </div>
  );
}
