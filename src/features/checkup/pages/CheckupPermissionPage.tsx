import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Camera, Lock, MapPin } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/app/routes';
import { markCheckupPermissionsSeen, requestCheckupPermissions } from '../permissions';

interface PermissionItem {
  icon: LucideIcon;
  title: string;
  description: string;
}

const PERMISSION_ITEMS: PermissionItem[] = [
  {
    icon: Camera,
    title: 'Kamera',
    description: 'Mengambil foto kondisi & plat kendaraan',
  },
  {
    icon: MapPin,
    title: 'Lokasi',
    description: 'Mencari rekomendasi bengkel dan layanan terdekat',
  },
  {
    icon: Bell,
    title: 'Notifikasi',
    description: 'Update status klaim & hasil analisis secara real-time',
  },
];

/**
 * Layar izin satu kali sebelum alur scan (mengikuti permission gate Flutter).
 * Meminta kamera, lokasi, dan notifikasi, lalu meneruskan ke langkah scan.
 */
export function CheckupPermissionPage() {
  const navigate = useNavigate();
  const [isRequesting, setIsRequesting] = useState(false);

  const proceed = () => {
    markCheckupPermissionsSeen();
    // Izin diminta setelah pilih kendaraan + isi data → langsung ke scan plat.
    navigate(ROUTES.licensePlate, { replace: true });
  };

  const handleContinue = async () => {
    setIsRequesting(true);
    try {
      // Best-effort: izin yang ditolak tetap dilanjutkan — kamera akan meminta
      // ulang saat pengambilan foto, dan lokasi punya fallback default.
      await requestCheckupPermissions();
    } finally {
      setIsRequesting(false);
      proceed();
    }
  };

  return (
    <PageContainer className="bg-neutral-200">
      <div className="flex flex-1 flex-col px-6 pt-14 pb-8">
        <button type="button" onClick={() => navigate(ROUTES.home)} className="mx-auto">
          <Logo className="[&_img]:h-11" />
        </button>

        <h1 className="text-deep-blue-500 mt-10 text-center text-2xl font-bold">
          Aktifkan Izin Aplikasi
        </h1>
        <p className="mt-3 text-center text-sm leading-relaxed text-neutral-700">
          Sebelum mulai cek kondisi kendaraan, DRIVE membutuhkan izin berikut:
        </p>

        <div className="mt-8 flex flex-col gap-3">
          {PERMISSION_ITEMS.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="drive-card flex items-center gap-3 rounded-xl border border-neutral-400 px-4 py-3"
            >
              <span className="bg-deep-blue-50 text-deep-blue-500 flex size-11 shrink-0 items-center justify-center rounded-lg">
                <Icon className="size-6" />
              </span>
              <div className="min-w-0">
                <p className="text-14 font-semibold text-neutral-900">{title}</p>
                <p className="text-12 text-neutral-600">{description}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-auto flex flex-col items-center gap-3 pt-10">
          <Button size="lg" isLoading={isRequesting} onClick={() => void handleContinue()}>
            Lanjutkan
          </Button>
          <p className="text-10 flex items-center gap-1.5 text-neutral-600">
            <Lock className="size-3.5" />
            Data Anda aman, terenkripsi, dan tidak akan dibagikan
          </p>
        </div>
      </div>
    </PageContainer>
  );
}
