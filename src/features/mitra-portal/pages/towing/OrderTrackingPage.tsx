import { useLocation } from 'react-router-dom';
import { MessageSquare, Phone, Star } from 'lucide-react';
import { AppHeader } from '@/components/layout/AppHeader';
import { toast } from '@/components/feedback/toast';
import { MitraShell } from '../../components/MitraShell';
import { MapPreview } from '../../components/MapPreview';
import type { MitraTowingDriver, MitraTowingFleet, MitraTowingOrder } from '../../api';

function rupiah(value: number): string {
  if (!value) return 'Menunggu estimasi';
  return 'Rp ' + value.toLocaleString('id-ID');
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'DR';
}

/** Pelacakan sopir menuju lokasi penjemputan (Order tracking). */
export function OrderTrackingPage() {
  const location = useLocation();
  const state = (location.state as {
    order?: MitraTowingOrder;
    driver?: MitraTowingDriver;
    fleet?: MitraTowingFleet;
    dropoff?: string;
  } | null) ?? {};
  const { order, driver, fleet } = state;
  const driverName = driver?.fullname || order?.driverFullname || 'Sopir belum ditetapkan';
  const fleetLabel = fleet?.plateNumber || order?.fleetPlateNumber || 'Armada belum ditetapkan';
  const fleetType = fleet?.fleetType || order?.fleetType || 'Towing';
  const pickup = order?.pickupAddress || 'Lokasi penjemputan';
  const dropoff = state.dropoff || order?.dropoffAddress || order?.workshopName || 'Lokasi tujuan';

  return (
    <MitraShell>
      <AppHeader showLogo />

      <div className="relative">
        <MapPreview className="h-64 rounded-none" />
        <div className="absolute top-3 left-1/2 -translate-x-1/2">
          <span className="text-12 inline-flex items-center gap-2 rounded-full bg-neutral-200 px-4 py-2 font-medium text-neutral-800 shadow-md">
            <span className="bg-deep-blue-500 size-2 rounded-full" />
            Sopir menuju lokasi
          </span>
        </div>
      </div>

      {/* Bottom sheet */}
      <div className="relative -mt-6 flex-1 rounded-t-3xl bg-neutral-200 px-5 pt-5 shadow-[0_-10px_30px_-12px_rgba(15,23,42,0.25)]">
        <div className="flex items-center justify-between">
          <p className="text-14 font-semibold text-neutral-900">Estimasi kedatangan</p>
          <p className="text-deep-blue-600 text-14 font-bold">12 Menit</p>
        </div>
        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-neutral-200">
          <div className="bg-warning h-full w-[68%] rounded-full" />
        </div>

        {/* Sopir */}
        <div className="mt-4 flex items-center gap-3 border-t border-neutral-300 pt-4">
          <div className="bg-deep-blue-50 text-deep-blue-600 grid size-12 shrink-0 place-items-center rounded-full text-sm font-semibold">
            {initials(driverName)}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-14 font-semibold text-neutral-900">{driverName}</p>
            <p className="text-12 flex items-center gap-1 text-neutral-500">
              <Star className="fill-warning text-warning size-3.5" />
              4.9 · {fleetType}
            </p>
            <p className="text-deep-blue-600 text-[11px] font-semibold">{fleetLabel}</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              aria-label="Telepon"
              onClick={() => toast.info('Menghubungi sopir…')}
              className="bg-deep-blue-50 text-deep-blue-600 grid size-10 place-items-center rounded-full"
            >
              <Phone className="size-4" />
            </button>
            <button
              type="button"
              aria-label="Pesan"
              onClick={() => toast.info('Buka pesan…')}
              className="bg-deep-blue-700 text-on-brand grid size-10 place-items-center rounded-full"
            >
              <MessageSquare className="size-4" />
            </button>
          </div>
        </div>

        {/* Rute */}
        <div className="mt-4 flex gap-3 border-t border-neutral-300 pt-4">
          <div className="flex flex-col items-center pt-1">
            <span className="bg-deep-blue-500 size-2.5 rounded-full" />
            <span className="my-1 w-px flex-1 bg-neutral-200" />
            <span className="bg-danger size-2.5 rounded-full" />
          </div>
          <div className="flex-1 space-y-4">
            <p className="text-12 font-medium text-neutral-800">{pickup}</p>
            <p className="text-12 font-medium text-neutral-800">{dropoff}</p>
          </div>
        </div>

        {/* Kendaraan — kartu berbingkai sesuai desain */}
        <div className="drive-card border-deep-blue-100 mt-4 mb-4 flex items-center justify-between rounded-xl border p-3.5">
          <div>
            <p className="text-12 font-semibold text-neutral-900">{order?.userFullname || 'Order towing'}</p>
            <p className="text-[11px] text-neutral-500">{order?.orderCode || 'Belum ada kode'}</p>
          </div>
          <span className="text-deep-blue-600 text-14 font-bold">{rupiah(order?.userPayable ?? order?.quotedPrice ?? 0)}</span>
        </div>
      </div>
    </MitraShell>
  );
}
