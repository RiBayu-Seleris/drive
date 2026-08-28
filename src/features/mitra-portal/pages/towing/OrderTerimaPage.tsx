import { useNavigate } from 'react-router-dom';
import { useLocation } from 'react-router-dom';
import { Car, CheckCircle2, Clock, MapPin, Navigation, type LucideIcon } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/feedback/toast';
import { MitraShell } from '../../components/MitraShell';
import { MapPreview } from '../../components/MapPreview';
import type { MitraTowingDriver, MitraTowingFleet, MitraTowingOrder } from '../../api';

/** Konfirmasi order diterima (Pesanan Diterima). */
export function OrderTerimaPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as {
    order?: MitraTowingOrder;
    driver?: MitraTowingDriver;
    fleet?: MitraTowingFleet;
    dropoff?: string;
  } | null) ?? {};
  const order = state.order;
  const driver = state.driver;
  const fleet = state.fleet;

  // Label mengikuti desain "Pesanan Diterima" (Kendaraan / Lokasi / Estimasi).
  const summary: { icon: LucideIcon; label: string; value: string }[] = [
    {
      icon: Car,
      label: 'Kendaraan',
      value: driver && fleet ? `${fleet.fleetType} · ${fleet.plateNumber}` : order?.orderCode || 'Order towing',
    },
    { icon: MapPin, label: 'Lokasi Penjemputan', value: order?.pickupAddress || '-' },
    {
      icon: Clock,
      label: 'Estimasi Kedatangan',
      value: driver ? `Sopir ${driver.fullname} sedang bersiap` : 'Menunggu konfirmasi sopir',
    },
  ];

  return (
    <MitraShell>
      <AppHeader showLogo />

      <div className="px-5 pt-2 pb-6">
        <div className="flex flex-col items-center pt-6 text-center">
          <div className="bg-green-cust grid size-16 place-items-center rounded-full shadow-lg">
            <CheckCircle2 className="size-9 text-white" />
          </div>
          <h1 className="text-deep-blue-600 text-18 mt-4 font-bold">Pesanan Diterima</h1>
          <p className="text-12 mt-1 text-neutral-500">Sedang menyiapkan bantuan untuk Anda</p>
        </div>

        <div className="drive-card mt-6 rounded-2xl border border-neutral-300 p-4">
          <p className="text-[11px] font-semibold tracking-wide text-neutral-400">
            RINGKASAN PESANAN
          </p>
          <div className="mt-3 space-y-4">
            {summary.map((item) => (
              <div key={item.label} className="flex items-center gap-3">
                <span className="bg-deep-blue-50 text-deep-blue-500 grid size-9 shrink-0 place-items-center rounded-lg">
                  <item.icon className="size-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[11px] text-neutral-500">{item.label}</p>
                  <p className="text-12 font-semibold text-neutral-900">{item.value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <MapPreview
          className="mt-4 h-40"
          overlay={
            <span className="text-12 inline-flex items-center gap-2 rounded-full bg-neutral-200 px-3 py-1.5 font-medium text-neutral-700 shadow">
              <span className="bg-deep-blue-500 size-2 animate-pulse rounded-full" />
              Driver sedang menuju lokasi
            </span>
          }
        />

        <div className="mt-5 space-y-3">
          <Button
            leftIcon={<Navigation className="size-5" />}
            onClick={() => navigate(ROUTES.mitraOrderTracking, { state })}
          >
            Mulai Navigasi
          </Button>
          <Button variant="outline" onClick={() => toast.info('Menghubungi bantuan…')}>
            Hubungi Bantuan
          </Button>
        </div>
      </div>
    </MitraShell>
  );
}
