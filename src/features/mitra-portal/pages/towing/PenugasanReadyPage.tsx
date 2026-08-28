import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  CheckCircle2,
  Clock,
  MapPin,
  Pencil,
  Send,
  Star,
  Truck,
  User,
  type LucideIcon,
} from 'lucide-react';
import { ROUTES } from '@/app/routes';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/feedback/toast';
import { confirm } from '@/components/feedback/confirm';
import { extractErrorMessage } from '@/lib/api/client';
import { MitraShell } from '../../components/MitraShell';
import { MapPreview } from '../../components/MapPreview';
import {
  acceptMitraTowingOrder,
  reassignMitraTowingOrder,
  type MitraTowingDriver,
  type MitraTowingFleet,
  type MitraTowingOrder,
} from '../../api';

interface PenugasanState {
  order?: MitraTowingOrder;
  driver?: MitraTowingDriver;
  fleet?: MitraTowingFleet;
  dropoff?: string;
  notes?: string;
}

/** Verifikasi akhir penugasan sebelum dikirim ke sopir. */
export function PenugasanReadyPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = (location.state as PenugasanState | null) ?? {};
  const { order, driver, fleet } = state;
  const dropoff = state.dropoff || order?.dropoffAddress || 'Tujuan belum diisi';
  const [submitting, setSubmitting] = useState(false);

  const handleSend = async () => {
    if (!order || !driver || !fleet) return;
    setSubmitting(true);
    try {
      const payload = { orderId: order.id, driverId: driver.id, fleetId: fleet.id };
      if (order.status === 'NEEDS_REASSIGN') {
        await reassignMitraTowingOrder(payload);
      } else {
        await acceptMitraTowingOrder(payload);
      }
      toast.success('Penugasan terkirim ke sopir.');
      navigate(ROUTES.mitraOrderTerima, { replace: true, state: { order, driver, fleet, dropoff } });
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Gagal mengirim penugasan.'));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    const ok = await confirm({
      title: 'Batalkan Penugasan',
      message: 'Yakin membatalkan penugasan ini?',
      confirmText: 'Batalkan',
      tone: 'danger',
    });
    if (ok) navigate(ROUTES.mitraOrder);
  };

  if (!order || !driver || !fleet) {
    return (
      <MitraShell>
        <AppHeader title="Konfirmasi Penugasan" />
        <div className="px-5 py-16 text-center">
          <div className="bg-deep-blue-50 text-deep-blue-500 mx-auto grid size-12 place-items-center rounded-full">
            <Truck className="size-6" />
          </div>
          <p className="text-14 mt-3 font-semibold text-neutral-900">Data penugasan belum lengkap</p>
          <p className="text-12 mt-1 text-neutral-500">
            Pilih order, armada, dan sopir sebelum mengirim penugasan.
          </p>
          <Button className="mt-5" onClick={() => navigate(ROUTES.mitraOrder)}>
            Ke Order Masuk
          </Button>
        </div>
      </MitraShell>
    );
  }

  return (
    <MitraShell>
      <AppHeader title="Konfirmasi Penugasan" />

      <div className="px-5 py-4">
        <p className="text-green-cust text-14 flex items-center gap-2 font-semibold">
          <CheckCircle2 className="size-5" />
          Detail Penugasan Terverifikasi
        </p>

        {/* Armada */}
        <div className="drive-card mt-4 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold tracking-wide text-neutral-400">ARMADA</p>
            <Truck className="text-deep-blue-500 size-4" />
          </div>
          <div className="mt-2 flex items-center gap-3">
            <div className="from-deep-blue-700 to-deep-blue-500 grid size-12 place-items-center rounded-xl bg-gradient-to-br">
              <Truck className="size-6 text-white/40" />
            </div>
            <div>
              <p className="text-14 font-semibold text-neutral-900">{fleet.fleetType}</p>
              <p className="text-deep-blue-600 text-12 font-semibold">{fleet.plateNumber}</p>
              <span className="text-green-cust mt-0.5 inline-block text-[11px] font-medium">
                Ready
              </span>
            </div>
          </div>
        </div>

        {/* Driver */}
        <div className="drive-card mt-4 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <p className="text-[11px] font-semibold tracking-wide text-neutral-400">DRIVER</p>
            <User className="text-deep-blue-500 size-4" />
          </div>
          <div className="mt-2 flex items-center gap-3">
            <div className="bg-deep-blue-50 text-deep-blue-600 grid size-12 place-items-center rounded-full text-sm font-semibold">
              {driver.fullname
                .split(/\s+/)
                .slice(0, 2)
                .map((part) => part[0])
                .join('')
                .toUpperCase()}
            </div>
            <div>
              <p className="text-14 font-semibold text-neutral-900">{driver.fullname}</p>
              <p className="text-12 flex items-center gap-1 text-neutral-500">
                <Star className="fill-warning text-warning size-3.5" />
                {driver.fleetType} · {driver.phone || 'Nomor belum ada'}
              </p>
            </div>
          </div>
        </div>

        {/* Rute */}
        <div className="drive-card mt-4 rounded-2xl p-4">
          <p className="text-[11px] font-semibold tracking-wide text-neutral-400">RUTE PENUGASAN</p>
          <div className="mt-3 flex gap-3">
            <div className="flex flex-col items-center pt-1">
              <span className="bg-deep-blue-500 size-2.5 rounded-full" />
              <span className="my-1 w-px flex-1 bg-neutral-200" />
              <span className="bg-warning size-2.5 rounded-full" />
            </div>
            <div className="flex-1 space-y-4">
              <div>
                <p className="text-[11px] text-neutral-500">Lokasi Penjemputan</p>
                <p className="text-12 font-medium text-neutral-800">
                  {order.pickupAddress}
                </p>
              </div>
              <div>
                <p className="text-[11px] text-neutral-500">Lokasi Tujuan</p>
                <p className="text-12 flex items-center gap-1.5 font-medium text-neutral-800">
                  {dropoff}
                  <Pencil className="size-3 text-neutral-400" />
                </p>
              </div>
            </div>
          </div>

          <div className="relative mt-3">
            <MapPreview className="h-28" marker={false} />
            <span className="bg-danger absolute top-2 right-2 rounded-md px-2 py-1 text-[10px] font-semibold text-white">
              9 min · Heavy traffic
            </span>
          </div>
          <button
            type="button"
            onClick={() => toast.info('Lihat detail rute segera hadir.')}
            className="text-deep-blue-500 text-12 mt-3 w-full rounded-lg bg-neutral-200 py-2.5 font-semibold"
          >
            Lihat Detail
          </button>
        </div>

        {/* Estimasi */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <EstTile icon={MapPin} label="Kode Order" value={order.orderCode || `#${order.id}`} />
          <EstTile icon={Clock} label="Status" value="Siap Kirim" />
        </div>

        {/* Aksi */}
        <Button
          className="mt-6"
          rightIcon={<Send className="size-5" />}
          onClick={handleSend}
          isLoading={submitting}
        >
          Kirim Penugasan
        </Button>
        <div className="mt-3 grid grid-cols-2 gap-3">
          <Button variant="outline" onClick={() => navigate(-1)}>
            Ubah
          </Button>
          <Button
            variant="ghost"
            className="text-danger hover:bg-danger/5"
            onClick={handleCancel}
          >
            Batalkan
          </Button>
        </div>
      </div>
    </MitraShell>
  );
}

function EstTile({ icon: Icon, label, value }: { icon: LucideIcon; label: string; value: string }) {
  return (
    <div className="drive-card flex items-center gap-3 rounded-2xl p-3">
      <span className="bg-deep-blue-50 text-deep-blue-500 grid size-9 place-items-center rounded-lg">
        <Icon className="size-4" />
      </span>
      <div>
        <p className="text-[11px] text-neutral-500">{label}</p>
        <p className="text-14 font-bold text-neutral-900">{value}</p>
      </div>
    </div>
  );
}
