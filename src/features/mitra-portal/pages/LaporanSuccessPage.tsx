import { useLocation, useNavigate } from 'react-router-dom';
import { BadgeCheck, Check, Home } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/Button';
import { MitraShell } from '../components/MitraShell';
import type { Laporan } from '../types';

function nowWIB(): string {
  const now = new Date();
  const hh = now.getHours().toString().padStart(2, '0');
  const mm = now.getMinutes().toString().padStart(2, '0');
  return `${hh}:${mm} WIB`;
}

/** Konfirmasi laporan terkirim (sesuai desain "Laporan Berhasil Terkirim"). */
export function LaporanSuccessPage() {
  const navigate = useNavigate();
  const report = ((useLocation().state as { report?: Laporan } | null) ?? {}).report;
  const refId = `#${report?.id ?? 'TRX-00000'}-AC`;

  return (
    <MitraShell hideNav>
      <AppHeader showLogo showBack={false} />

      <div className="flex flex-1 flex-col px-5 py-6">
        {/* Ikon sukses konsentris */}
        <div className="mt-4 flex justify-center">
          <div className="bg-green-cust/10 grid size-32 place-items-center rounded-full">
            <div className="bg-green-cust/15 grid size-24 place-items-center rounded-full">
              <div className="bg-green-cust grid size-16 place-items-center rounded-full text-white shadow-lg">
                <Check className="size-9" strokeWidth={3} />
              </div>
            </div>
          </div>
        </div>

        <h1 className="text-20 mt-5 text-center font-bold text-neutral-900">
          Laporan Berhasil Terkirim
        </h1>
        <p className="text-13 mt-2 text-center text-neutral-500">
          Terima kasih telah memberikan informasi terbaru mengenai perjalanan Anda.
        </p>

        {/* Ringkasan */}
        <div className="drive-card mt-6 rounded-2xl/70 p-4">
          <p className="text-[11px] font-semibold tracking-wide text-neutral-400">RINGKASAN LAPORAN</p>
          <div className="mt-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-13 text-neutral-600">Waktu Kirim</span>
              <span className="text-deep-blue-600 text-13 font-semibold">{nowWIB()}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-13 text-neutral-600">ID Referensi</span>
              <span className="text-13 font-semibold text-neutral-900">{refId}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-13 text-neutral-600">Status</span>
              <span className="bg-deep-blue-50 text-deep-blue-600 rounded-full px-3 py-1 text-[11px] font-semibold">
                Diterima
              </span>
            </div>
          </div>
        </div>

        <p className="text-deep-blue-500 text-13 mt-4 flex items-center justify-center gap-2 font-semibold">
          <BadgeCheck className="size-4" />
          Sistem DRIVE Terverifikasi
        </p>

        <Button
          className="mt-6"
          leftIcon={<Home className="size-5" />}
          onClick={() => navigate(ROUTES.mitra, { replace: true })}
        >
          Kembali ke Beranda
        </Button>

        <p className="text-[11px] mt-auto pt-8 text-center text-neutral-400">
          Laporan ini akan segera diproses oleh tim administrasi kami dalam 24 jam ke depan.
        </p>
      </div>
    </MitraShell>
  );
}
