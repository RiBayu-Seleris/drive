import { cn } from '@/lib/utils/cn';

/**
 * Wordmark DRIVE.
 *
 * Berkas asli dari pembuat merek ada di `/LOGO` pada akar repo; salinannya di
 * `public/assets/brand/`. Varian turunan dibuat dari `Drive-Horizontal.svg`
 * dan tidak boleh diedit tangan — kalau logo aslinya berubah, bangun ulang.
 *
 * Tiga hal yang perlu diketahui sebelum mengubah apa pun di sini:
 *
 * 1. Lockup resmi memuat tagline dua baris. Pada tinggi header (36 px) tagline
 *    itu jadi sekitar 4 px — tidak terbaca, cuma jadi kotoran visual. Yang
 *    dipakai di layar adalah lockup ringkas tanpa tagline.
 * 2. Mobil dan partikel di dalam huruf D adalah LUBANG TEMBUS, bukan isian
 *    putih. Tanpa bidang putih di belakangnya, mobil mengambil warna latar dan
 *    berubah jadi hitam pekat di tema gelap. Varian `light` dan `dark` sudah
 *    memuat bidang itu; varian `mono` sengaja tidak, karena logo satu warna
 *    memang mengandalkan lubang.
 * 3. JANGAN membaca `bg-neutral-100` sebagai latar terang. Tema DRIVE membalik
 *    seluruh skala netral di `styles/index.css`: `neutral-100` = `#131c24`
 *    (panel gelap) dan `neutral-900` = teks terang. Praktisnya seluruh webapp
 *    gelap — karena itu bawaannya `dark`. Varian `light` disediakan untuk
 *    permukaan terang yang mungkin muncul nanti (cetakan, PDF laporan), bukan
 *    karena ada halaman terang hari ini.
 */
export type LogoTone =
  /** Latar benar-benar terang — cetakan, PDF, kartu putih. Ikon hijau, wordmark gelap. */
  | 'light'
  /** Latar gelap tema DRIVE — bawaan untuk hampir semua layar. Ikon hijau, wordmark putih. */
  | 'dark'
  /** Latar berwarna pekat — hijau merek, teal, atau foto. Seluruhnya putih,
   *  karena ikon hijau di atas latar hijau akan hilang. */
  | 'mono';

const WORDMARK: Record<LogoTone, string> = {
  light: '/assets/brand/Drive-Compact.svg',
  dark: '/assets/brand/Drive-Compact-on-dark.svg',
  mono: '/assets/brand/Drive-Compact-white.svg',
};

const ICON: Record<LogoTone, string> = {
  light: '/assets/brand/Drive-Tab-Logo.svg',
  dark: '/assets/brand/Drive-Tab-on-dark.svg',
  mono: '/assets/brand/Drive-Tab-Logo-white.svg',
};

export function Logo({
  className,
  tone = 'dark',
  withText = true,
}: {
  className?: string;
  tone?: LogoTone;
  withText?: boolean;
}) {
  return (
    <span className={cn('inline-flex items-center', className)}>
      <img
        src={withText ? WORDMARK[tone] : ICON[tone]}
        alt={withText ? 'DRIVE' : ''}
        className={cn(withText ? 'h-9 w-auto' : 'h-8 w-auto object-contain')}
      />
    </span>
  );
}
