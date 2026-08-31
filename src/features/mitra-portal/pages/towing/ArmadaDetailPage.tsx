import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Calendar,
  CheckCircle2,
  MapPin,
  Package,
  Phone,
  Settings,
  Truck,
  type LucideIcon,
} from 'lucide-react';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/Button';
import { Modal } from '@/components/ui/Modal';
import { LoadingState } from '@/components/ui/Spinner';
import { toast } from '@/components/feedback/toast';
import { extractErrorMessage } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';
import { buildPath } from '@/app/routes';
import { MitraShell } from '../../components/MitraShell';
import {
  fleetStatusLabel,
  fleetTypeLabel,
  getMitraTowingFleets,
  getMitraTowingOrders,
  towingStatusLabel,
  updateMitraTowingFleet,
  TOWING_FLEET_STATUS_OPTIONS,
  type MitraTowingFleet,
  type MitraTowingOrder,
} from '../../api';

interface ArmadaTrip {
  id: string;
  route: string;
  label: string;
  meta: string;
}

interface ArmadaView {
  name: string;
  type: string;
  capacity: string;
  photo: string;
  year: string;
  engineNo: string;
  statusLabel: string;
  lastSeen: string;
  driverName: string;
  driverSince: string;
  trips: ArmadaTrip[];
  location: string;
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'A';
}

function timeLabel(value: string): string {
  if (!value) return 'Waktu belum tercatat';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Waktu belum tercatat';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function routeLabel(order: MitraTowingOrder): string {
  const pickup = order.pickupAddress || 'Lokasi jemput';
  const dropoff = order.dropoffAddress || order.workshopName || 'Tujuan';
  return `${pickup} -> ${dropoff}`;
}

function buildArmadaView(fleet: MitraTowingFleet, orders: MitraTowingOrder[]): ArmadaView {
  const latestOrder = orders[0];
  const hasLocation = fleet.lastLatitude !== 0 || fleet.lastLongitude !== 0;
  return {
    name: fleet.plateNumber,
    type: fleetTypeLabel(fleet.fleetType),
    capacity: fleet.capacityLabel || 'Belum diisi',
    photo: fleet.photoUrl,
    year: 'Belum diisi',
    engineNo: 'Belum diisi',
    statusLabel: fleetStatusLabel(fleet.status),
    lastSeen: fleet.lastSeenAt ? timeLabel(fleet.lastSeenAt) : 'Belum ada update lokasi',
    driverName: latestOrder?.driverFullname || 'Belum ditugaskan',
    driverSince: latestOrder
      ? `Order terakhir ${timeLabel(latestOrder.requestedAt)}`
      : 'Belum ada order',
    trips: orders.slice(0, 5).map((order) => ({
      id: String(order.id),
      route: routeLabel(order),
      label: towingStatusLabel(order.status),
      meta: order.requestedAt ? timeLabel(order.requestedAt) : order.orderCode,
    })),
    location: hasLocation
      ? `${fleet.lastLatitude.toFixed(6)}, ${fleet.lastLongitude.toFixed(6)}`
      : 'Lokasi terakhir belum tersedia',
  };
}

/** Detail armada: kondisi, riwayat, pengemudi utama, lokasi. */
export function ArmadaDetailPage() {
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const fleetID = Number(id);
  const [fleets, setFleets] = useState<MitraTowingFleet[]>([]);
  const [orders, setOrders] = useState<MitraTowingOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusSheetOpen, setStatusSheetOpen] = useState(false);
  const [savingStatus, setSavingStatus] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([getMitraTowingFleets(), getMitraTowingOrders({ page: 1, limit: 50 })])
      .then(([fleetItems, orderResult]) => {
        if (!active) return;
        setFleets(fleetItems);
        setOrders(orderResult.data);
      })
      .catch((error) => toast.error(extractErrorMessage(error, 'Gagal memuat detail armada.')))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const fleet = useMemo(() => fleets.find((item) => item.id === fleetID), [fleets, fleetID]);
  const relatedOrders = useMemo(
    () => orders.filter((order) => order.fleetId === fleetID),
    [orders, fleetID],
  );
  const armada = useMemo(
    () => (fleet ? buildArmadaView(fleet, relatedOrders) : undefined),
    [fleet, relatedOrders],
  );

  if (loading) {
    return (
      <MitraShell>
        <AppHeader showLogo />
        <LoadingState label="Memuat detail armada…" />
      </MitraShell>
    );
  }

  if (!fleet || !armada || !Number.isFinite(fleetID)) {
    return (
      <MitraShell>
        <AppHeader showLogo />
        <p className="text-12 px-5 py-20 text-center text-neutral-500">Armada tidak ditemukan.</p>
      </MitraShell>
    );
  }

  const available = fleet.isActive && fleet.status === 'AVAILABLE';

  /**
   * Ubah status unit. Endpoint PUT menimpa seluruh kolom, jadi seluruh nilai
   * armada dikirim ulang — termasuk koordinat terakhir — agar tidak terhapus.
   */
  const changeStatus = async (status: string) => {
    if (status === fleet.status) {
      setStatusSheetOpen(false);
      return;
    }
    setSavingStatus(status);
    try {
      await updateMitraTowingFleet(fleet.id, {
        plateNumber: fleet.plateNumber,
        fleetType: fleet.fleetType,
        capacityLabel: fleet.capacityLabel,
        photoUrl: fleet.photoUrl,
        status,
        isActive: fleet.isActive,
        lastLatitude: fleet.lastLatitude,
        lastLongitude: fleet.lastLongitude,
      });
      setFleets((current) =>
        current.map((item) => (item.id === fleet.id ? { ...item, status } : item)),
      );
      setStatusSheetOpen(false);
      toast.success(`Status unit diubah ke ${fleetStatusLabel(status)}.`);
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Gagal memperbarui status armada.'));
    } finally {
      setSavingStatus('');
    }
  };

  return (
    <MitraShell>
      <AppHeader showLogo />

      <div className="px-5 pt-2 pb-6">
        {/* Hero kendaraan */}
        <div className="relative overflow-hidden rounded-2xl">
          {armada.photo ? (
            <img src={armada.photo} alt={armada.name} className="h-44 w-full object-cover" />
          ) : (
            <div className="from-deep-blue-700 to-deep-blue-500 grid h-44 w-full place-items-center bg-gradient-to-br">
              <Truck className="size-16 text-white/30" />
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 to-transparent" />
          <div className="absolute right-0 bottom-0 left-0 p-4 text-white">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium backdrop-blur">
              <span className="bg-green-cust size-1.5 rounded-full" />
              {available ? 'Aktif · Siap Beroperasi' : 'Sedang Bertugas'}
            </span>
            <h1 className="text-18 mt-2 font-bold">{armada.name}</h1>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            onClick={() => navigate(buildPath.mitraArmadaEdit(String(fleetID)))}
          >
            Edit Kendaraan
          </Button>
          <Button onClick={() => setStatusSheetOpen(true)}>Update Status</Button>
        </div>

        {/* Spesifikasi */}
        <div className="mt-4 grid grid-cols-2 gap-3">
          <SpecTile icon={Truck} label="Tipe" value={armada.type} />
          <SpecTile icon={Package} label="Kapasitas" value={armada.capacity ?? '—'} />
          <SpecTile icon={Calendar} label="Tahun" value={armada.year ?? '—'} />
          <SpecTile icon={Settings} label="No. Mesin" value={armada.engineNo ?? '—'} />
        </div>

        {/* Status operasional */}
        <div className="drive-card mt-4 rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-14 font-semibold text-neutral-900">Status Operasional</h2>
            <CheckCircle2 className="text-green-cust size-5" />
          </div>
          <div className="mt-3">
            <div className="text-12 flex items-center justify-between text-neutral-600">
              <span>Status Unit</span>
              <span className="text-green-cust font-semibold">{armada.statusLabel}</span>
            </div>
            <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-neutral-200">
              <div
                className="bg-green-cust h-full rounded-full"
                style={{ width: available ? '100%' : '60%' }}
              />
            </div>
          </div>
          <div className="mt-3 flex items-end justify-between border-t border-neutral-300 pt-3">
            <div>
              <p className="text-[11px] text-neutral-500">Update Terakhir</p>
              <p className="text-14 font-bold text-neutral-900">{armada.lastSeen}</p>
            </div>
            <button
              type="button"
              onClick={() => toast.info('Penjadwalan servis segera hadir.')}
              className="text-deep-blue-500 text-12 font-semibold"
            >
              Jadwalkan Servis →
            </button>
          </div>
        </div>

        {/* Riwayat perjalanan */}
        <div className="drive-card mt-4 rounded-2xl p-4">
          <h2 className="text-14 font-semibold text-neutral-900">Riwayat Perjalanan Terakhir</h2>
          <div className="mt-3 space-y-4">
            {(armada.trips ?? []).map((trip, idx, arr) => (
              <div key={trip.id} className="flex gap-3">
                <div className="flex flex-col items-center">
                  <span className="bg-deep-blue-500 mt-1 size-2.5 rounded-full" />
                  {idx < arr.length - 1 && <span className="w-px flex-1 bg-neutral-200" />}
                </div>
                <div className="-mt-0.5 pb-1">
                  <p className="text-12 font-semibold text-neutral-900">{trip.route}</p>
                  <p className="text-[11px] text-neutral-500">{trip.label}</p>
                  <p className="text-[11px] text-neutral-400">{trip.meta}</p>
                </div>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={() => toast.info('Riwayat lengkap segera hadir.')}
            className="text-deep-blue-500 text-12 mt-3 w-full rounded-lg bg-neutral-200 py-2.5 font-semibold"
          >
            Lihat Semua Riwayat
          </button>
        </div>

        {/* Pengemudi utama */}
        <div className="bg-deep-blue-700 text-on-brand mt-4 rounded-2xl p-4">
          <p className="text-[11px] text-on-brand/70">PENGEMUDI UTAMA</p>
          <div className="mt-2 flex items-center gap-3">
            <div className="grid size-12 place-items-center rounded-full bg-on-brand/12 text-sm font-semibold">
              {initials(armada.driverName ?? '')}
            </div>
            <div className="min-w-0">
              <p className="text-14 font-semibold">{armada.driverName}</p>
              <p className="text-[11px] text-on-brand/70">{armada.driverSince}</p>
            </div>
          </div>
          <div className="mt-3 flex gap-6 border-t border-on-brand/15 pt-3">
            <div>
              <p className="text-[11px] text-on-brand/70">Status Unit</p>
              <p className="text-sm font-bold">{armada.statusLabel}</p>
            </div>
            <div>
              <p className="text-[11px] text-on-brand/70">Total Tugas</p>
              <p className="text-sm font-bold">{armada.trips?.length ?? 0}+ tugas</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => toast.info(`Menghubungi ${armada.driverName}…`)}
            className="text-deep-blue-700 mt-3 flex w-full items-center justify-center gap-2 rounded-lg bg-neutral-200 py-2.5 text-sm font-semibold"
          >
            <Phone className="size-4" />
            Hubungi Pengemudi
          </button>
        </div>

        {/* Lokasi */}
        <div className="drive-card mt-4 rounded-2xl p-4">
          <h2 className="text-14 font-semibold text-neutral-900">Lokasi Terkini</h2>
          <div className="drive-card relative mt-3 grid h-28 place-items-center overflow-hidden rounded-xl">
            <span className="text-[11px] tracking-wide text-neutral-400">MAP PREVIEW</span>
            <MapPin className="text-danger absolute size-7" />
          </div>
          <p className="text-12 mt-2 flex items-center gap-1.5 text-neutral-600">
            <MapPin className="text-deep-blue-500 size-4" />
            {armada.location}
          </p>
        </div>
      </div>

      <Modal
        open={statusSheetOpen}
        onClose={() => setStatusSheetOpen(false)}
        title="Status Unit"
        variant="sheet"
      >
        <p className="text-12 mb-3 text-neutral-500">
          Status menentukan apakah armada ini bisa dipilih saat penugasan order.
        </p>
        <div className="space-y-2">
          {TOWING_FLEET_STATUS_OPTIONS.map((option) => {
            const active = fleet.status === option.value;
            return (
              <button
                key={option.value}
                type="button"
                disabled={Boolean(savingStatus)}
                onClick={() => void changeStatus(option.value)}
                className={cn(
                  'flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left transition disabled:opacity-60',
                  active
                    ? 'border-deep-blue-500 bg-deep-blue-50'
                    : 'border-neutral-200 hover:bg-neutral-200',
                )}
              >
                <span
                  className={cn(
                    'text-14 font-semibold',
                    active ? 'text-deep-blue-600' : 'text-neutral-800',
                  )}
                >
                  {option.label}
                </span>
                {savingStatus === option.value ? (
                  <span className="text-12 text-neutral-500">Menyimpan…</span>
                ) : (
                  active && <CheckCircle2 className="text-deep-blue-500 size-5" />
                )}
              </button>
            );
          })}
        </div>
      </Modal>
    </MitraShell>
  );
}

function SpecTile({
  icon: Icon,
  label,
  value,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
}) {
  return (
    <div className="drive-card rounded-2xl p-3">
      <Icon className="text-deep-blue-500 size-4" />
      <p className="mt-2 text-[11px] text-neutral-500">{label}</p>
      <p className="text-12 font-semibold text-neutral-900">{value}</p>
    </div>
  );
}
