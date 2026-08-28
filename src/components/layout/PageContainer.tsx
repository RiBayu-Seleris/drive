import type { HTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';

/**
 * Kanvas mobile terpusat untuk halaman pengguna.
 *
 * Latar halaman memakai `neutral-200` (#0f1720), BUKAN `neutral-100` (#131c24).
 * Sebelumnya keduanya #131c24 — warna kartu dan warna halaman sama persis,
 * sehingga kartu tidak punya batas sama sekali dan seluruh isi halaman menyatu
 * jadi satu bidang. Kartu duduk di atas latar ini memakai `.drive-card`, yang
 * membawa garis tepi, kilau tepi, dan bayangannya sendiri.
 */
export function PageContainer({ className, children, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className="min-h-dvh bg-neutral-200">
      <div
        className={cn(
          /*
           * `overflow-x-clip`, BUKAN `overflow-x-hidden`.
           *
           * Keduanya sama-sama memotong luapan mendatar, tapi `hidden` diam-diam
           * mengubah `overflow-y` jadi `auto`. Wadah ini lalu jadi wadah gulir,
           * dan setiap elemen `sticky` di dalamnya menempel padanya alih-alih
           * pada layar — sehingga sticky tidak pernah terlihat bekerja, tanpa
           * error apa pun yang bisa dilacak.
           *
           * `clip` memotong tanpa membuat wadah gulir. Perilaku pemotongannya
           * sendiri tidak berubah.
           */
          'relative mx-auto flex min-h-dvh w-full max-w-md flex-col overflow-x-clip bg-neutral-200',
          className,
        )}
        {...rest}
      >
        {children}
      </div>
    </div>
  );
}
