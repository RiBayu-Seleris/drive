import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertTriangle, CheckCircle2, Flag, MapPin, Send, Star, Truck } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { ROUTES } from '@/app/routes';
import { AppHeader } from '@/components/layout/AppHeader';
import { Select } from '@/components/ui/Select';
import { Button } from '@/components/ui/Button';
import { TextArea } from '@/components/ui/TextArea';
import { LoadingState } from '@/components/ui/Spinner';
import { toast } from '@/components/feedback/toast';
import { extractErrorMessage } from '@/lib/api/client';
import { MitraShell } from '../../components/MitraShell';
import {
  driverStatusLabel,
  fleetStatusLabel,
  getMitraTowingDrivers,
  subscribeMitraTowingOrderChanges,
  getMitraTowingFleets,
  isAvailableDriver,
  isAvailableFleet,
  reassignReasonLabel,
  type MitraTowingDriver,
  type MitraTowingFleet,
  type MitraTowingOrder,
} from '../../api';

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'S';
}

const FIELD_CLASS =
  'block h-11 w-full rounded-lg border border-neutral-300 bg-neutral-200 px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-deep-blue-400 focus:ring-2 focus:ring-deep-blue-100 focus:outline-none';

/** Penugasan armada + pemilihan sopir untuk sebuah order. */
export function PenugasanPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const order = (location.state as { order?: MitraTowingOrder } | null)?.order;
  const [drivers, setDrivers] = useState<MitraTowingDriver[]>([]);
  const [fleets, setFleets] = useState<MitraTowingFleet[]>([]);
  const [selectedDriver, setSelectedDriver] = useState<number>(0);
  const [selectedFleet, setSelectedFleet] = useState<number>(0);
  const [dropoff, setDropoff] = useState(order?.dropoffAddress ?? '');
  const [notes, setNotes] = useState(order?.notes ?? '');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const [driverRows, fleetRows] = await Promise.all([
        getMitraTowingDrivers(),
        getMitraTowingFleets(),
      ]);
      setDrivers(driverRows);
      setFleets(fleetRows);
      /*
       * Pilihan yang SUDAH dibuat tidak ditimpa saat penyegaran diam-diam.
       * Kalau tidak, sopir pilihan admin bisa melompat sendiri di tengah
       * proses hanya karena ada sopir lain yang berganti status.
       */
      if (!silent) {
        setSelectedDriver((driverRows.find(isAvailableDriver) ?? driverRows[0])?.id ?? 0);
        setSelectedFleet((fleetRows.find(isAvailableFleet) ?? fleetRows[0])?.id ?? 0);
      }
    } catch (error) {
      if (!silent) toast.error(extractErrorMessage(error, 'Gagal memuat sopir atau armada.'));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /*
   * Halaman inilah yang paling berbahaya kalau datanya basi: admin bisa
   * menugaskan sopir yang beberapa detik lalu menekan "offline" di
   * aplikasinya. Daftar disegarkan begitu ada perubahan ketersediaan.
   */
  useEffect(() => {
    return subscribeMitraTowingOrderChanges({
      onChange: () => void load(true),
      onDriversChange: () => void load(true),
    });
  }, [load]);

  const availableDrivers = useMemo(() => drivers.filter(isAvailableDriver), [drivers]);
  const availableFleets = useMemo(() => fleets.filter(isAvailableFleet), [fleets]);
  const selectedDriverData =
    availableDrivers.find((driver) => driver.id === selectedDriver) ?? availableDrivers[0];
  const selectedFleetData =
    availableFleets.find((fleet) => fleet.id === selectedFleet) ?? availableFleets[0];

  if (!order) {
    return (
      <MitraShell>
        <AppHeader title="Tugaskan Armada" />
        <div className="px-5 py-16 text-center">
          <div className="bg-deep-blue-50 text-deep-blue-500 mx-auto grid size-12 place-items-center rounded-full">
            <Truck className="size-6" />
          </div>
          <p className="text-14 mt-3 font-semibold text-neutral-900">Pilih order lebih dulu</p>
          <p className="text-12 mt-1 text-neutral-500">
            Penugasan harus dimulai dari order masuk agar sopir dan armada terikat ke permintaan
            user.
          </p>
          <Button className="mt-5" onClick={() => navigate(ROUTES.mitraOrder)}>
            Ke Order Masuk
          </Button>
        </div>
      </MitraShell>
    );
  }

  const canContinue = Boolean(selectedDriverData && selectedFleetData);

  return (
    <MitraShell>
      <AppHeader title="Tugaskan Armada" />

      {loading ? (
        <LoadingState label="Memuat sopir dan armada…" />
      ) : (
        <div className="px-5 py-4">
          {order.status === 'NEEDS_REASSIGN' && (
            <div className="border-danger/30 bg-danger/5 mb-4 flex items-start gap-2.5 rounded-2xl border p-3">
              <AlertTriangle className="text-danger mt-0.5 size-4 shrink-0" />
              <div className="min-w-0">
                <p className="text-danger text-12 font-semibold">
                  {reassignReasonLabel(order.reassignReason)}
                </p>
                {order.reassignNote && (
                  <p className="text-11 mt-0.5 text-neutral-600">{order.reassignNote}</p>
                )}
                <p className="text-11 mt-1 text-neutral-500">
                  Pilih sopir &amp; armada pengganti lalu kirim penugasan ulang.
                </p>
              </div>
            </div>
          )}
          <div className="drive-card mb-4 rounded-2xl p-4">
            <p className="text-[11px] font-semibold tracking-wide text-neutral-400">ORDER</p>
            <p className="text-14 mt-1 font-semibold text-neutral-900">
              {order.userFullname || order.orderCode}
            </p>
            <p className="text-12 mt-1 flex items-start gap-1.5 text-neutral-500">
              <MapPin className="text-deep-blue-500 mt-0.5 size-4 shrink-0" />
              {order.pickupAddress}
            </p>
          </div>

          {/* Armada terpilih */}
          {selectedFleetData && (
            <div className="drive-card rounded-2xl p-4">
              <div className="flex items-center gap-3">
                <div className="from-deep-blue-700 to-deep-blue-500 grid size-14 shrink-0 place-items-center rounded-xl bg-gradient-to-br">
                  <Truck className="text-on-brand/45 size-7" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-14 font-semibold text-neutral-900">
                    {selectedFleetData.fleetType}
                  </p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="rounded-md bg-neutral-200 px-2 py-0.5 text-[11px] font-semibold">
                      {selectedFleetData.plateNumber}
                    </span>
                    <span className="text-green-cust flex items-center gap-1 text-[11px] font-medium">
                      <CheckCircle2 className="size-3.5" />{' '}
                      {fleetStatusLabel(selectedFleetData.status)}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="drive-card mt-3 rounded-2xl p-4">
            <label className="mb-2 block text-[11px] font-semibold tracking-wide text-neutral-400">
              PILIH ARMADA
            </label>
            <Select
              className={FIELD_CLASS}
              value={String(selectedFleet)}
              onChange={(value) => setSelectedFleet(Number(value))}
              placeholder="Tidak ada armada tersedia"
              options={availableFleets.map((fleet) => ({
                value: String(fleet.id),
                label: `${fleet.plateNumber} - ${fleet.fleetType}`,
              }))}
            />
          </div>

          {/* Pilih sopir */}
          <div className="mt-5 flex items-center justify-between">
            <h2 className="text-16 font-bold text-neutral-900">Pilih Sopir Tersedia</h2>
            <span className="text-deep-blue-500 text-12 font-semibold">
              {availableDrivers.length} Aktif
            </span>
          </div>
          <div className="mt-3 space-y-3">
            {availableDrivers.length === 0 ? (
              <div className="drive-card rounded-2xl p-4 text-center">
                <p className="text-12 font-semibold text-neutral-900">Tidak ada sopir tersedia</p>
                <p className="text-[11px] text-neutral-500">
                  Aktifkan sopir sebelum menerima order.
                </p>
              </div>
            ) : (
              availableDrivers.map((s) => {
                const active = s.id === selectedDriver;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedDriver(s.id)}
                    className={cn(
                      'drive-card flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition',
                      active
                        ? 'border-deep-blue-500 ring-deep-blue-100 ring-2'
                        : 'border-neutral-300',
                    )}
                  >
                    <div className="bg-deep-blue-50 text-deep-blue-600 grid size-11 shrink-0 place-items-center rounded-full text-sm font-semibold">
                      {initials(s.fullname)}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-14 font-semibold text-neutral-900">{s.fullname}</p>
                      <p className="text-12 flex items-center gap-1 text-neutral-500">
                        <Star className="fill-warning text-warning size-3.5" />
                        {driverStatusLabel(s.status)} · {s.fleetType}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'grid size-6 shrink-0 place-items-center rounded-full border-2',
                        active ? 'border-deep-blue-500 bg-deep-blue-500' : 'border-neutral-300',
                      )}
                    >
                      {active && <CheckCircle2 className="text-on-brand size-5" />}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* Detail penugasan */}
          <h2 className="text-16 mt-6 font-bold text-neutral-900">Detail Penugasan</h2>
          <div className="mt-3 flex gap-3">
            <div className="flex flex-col items-center pt-3">
              <MapPin className="text-deep-blue-500 size-5" />
              <span className="my-1 w-px flex-1 border-l border-dashed border-neutral-300" />
              <Flag className="text-warning size-5" />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <label className="mb-1 block text-[11px] text-neutral-500">
                  Lokasi Penjemputan
                </label>
                <input className={FIELD_CLASS} value={order.pickupAddress} readOnly />
              </div>
              <div>
                <label className="mb-1 block text-[11px] text-neutral-500">Tujuan</label>
                <input
                  className={FIELD_CLASS}
                  placeholder="Masukkan alamat tujuan"
                  value={dropoff}
                  onChange={(event) => setDropoff(event.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="mt-3">
            <TextArea
              label="Instruksi Tambahan (Opsional)"
              rows={3}
              placeholder="Contoh: Ban pecah, butuh alat angkat khusus…"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>

          <Button
            className="mt-5"
            rightIcon={<Send className="size-5" />}
            disabled={!canContinue}
            onClick={() =>
              navigate(ROUTES.mitraPenugasanKonfirmasi, {
                state: {
                  order,
                  driver: selectedDriverData,
                  fleet: selectedFleetData,
                  dropoff,
                  notes,
                },
              })
            }
          >
            Konfirmasi Penugasan
          </Button>
        </div>
      )}
    </MitraShell>
  );
}
