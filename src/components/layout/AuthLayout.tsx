import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Logo } from '@/components/brand/Logo';
import { ROUTES } from '@/app/routes';
import { PageContainer } from './PageContainer';

interface AuthLayoutProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}

/**
 * Rangka halaman masuk / daftar / lupa sandi.
 *
 * Susunan lama menumpuk logo, ilustrasi, judul, dan form di satu kolom tengah —
 * rapi, tapi bisa jadi milik aplikasi apa saja. Sekarang memakai bahasa yang
 * sama dengan beranda: pita berfoto di atas, lalu panel form yang MENIMPA tepi
 * bawahnya. Tumpang tindih itulah yang membuat halaman terbaca berlapis.
 *
 * Fotonya berkas yang sama dengan hero beranda, jadi sudah ada di cache
 * browser saat pengguna sampai ke sini — nol unduhan tambahan.
 */
export function AuthLayout({ title, subtitle, children, footer }: AuthLayoutProps) {
  return (
    <PageContainer className="bg-neutral-200">
      <header className="relative h-[236px] w-full shrink-0 overflow-hidden">
        <img
          src="/assets/home/home.webp"
          alt=""
          fetchPriority="high"
          className="absolute inset-0 size-full object-cover object-[64%_66%]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,12,17,0.62)_0%,rgba(7,12,17,0.4)_34%,rgba(15,23,32,0.94)_80%,#0f1720_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(100%_70%_at_18%_4%,rgba(173,237,31,0.28),transparent_58%)]" />
        <div className="drive-header drive-fade-b absolute inset-0 opacity-35" />

        <div className="relative flex h-full flex-col items-center px-gutter pt-8">
          <Link to={ROUTES.home}>
            <Logo className="[&_img]:h-10" />
          </Link>

          <div className="mt-3 flex items-center gap-2 rounded-full border border-[#22313c] bg-[#0b1218]/80 px-3 py-1">
            <span className="bg-deep-blue-500 size-1.5 rounded-full shadow-[0_0_8px_2px_rgba(173,237,31,0.6)]" />
            <span className="hud-readout text-deep-blue-500 text-[9.5px] tracking-[0.18em] uppercase">
              Siap memindai
            </span>
          </div>
        </div>
      </header>

      <div className="relative z-10 -mt-12 flex flex-1 flex-col px-gutter pb-10">
        <section className="drive-card hud-frame relative p-6">
          <h1 className="drive-title text-[24px] leading-tight text-neutral-900">{title}</h1>
          {subtitle && (
            <p className="mt-2 text-[13px] leading-relaxed text-neutral-600">{subtitle}</p>
          )}

          <div className="mt-6 w-full">{children}</div>
        </section>

        {footer && (
          <div className="mt-6 text-center text-[13px] text-neutral-600">{footer}</div>
        )}
      </div>
    </PageContainer>
  );
}
