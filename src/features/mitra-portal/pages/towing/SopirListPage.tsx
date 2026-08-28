import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, Phone, Star, Truck } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { ROUTES, buildPath } from '@/app/routes';
import { AppHeader } from '@/components/layout/AppHeader';
import { LoadingState } from '@/components/ui/Spinner';
import { toast } from '@/components/feedback/toast';
import { extractErrorMessage } from '@/lib/api/client';
import { MitraShell } from '../../components/MitraShell';
import { MitraSearch } from '../../components/MitraSearch';
import { MitraFilterChips } from '../../components/MitraFilterChips';
import { MitraFab } from '../../components/MitraFab';
import {
  driverStatusLabel,
  fleetTypeLabel,
  getMitraTowingDrivers,
  type MitraTowingDriver,
} from '../../api';

const SOPIR_FILTERS = [
  { value: 'all', label: 'Semua' },
  { value: 'AVAILABLE', label: 'Tersedia' },
  { value: 'BUSY', label: 'Bertugas' },
  { value: 'OFFLINE', label: 'Offline' },
  { value: 'INACTIVE', label: 'Nonaktif' },
];

const SOPIR_STATUS_META: Record<string, { label: string; tone: string }> = {
  AVAILABLE: { label: 'Tersedia', tone: 'bg-green-cust/12 text-green-cust' },
  BUSY: { label: 'Bertugas', tone: 'bg-deep-blue-500 text-[#10200a]' },
  OFFLINE: { label: 'Offline', tone: 'bg-neutral-200 text-neutral-600' },
  INACTIVE: { label: 'Nonaktif', tone: 'bg-neutral-200 text-neutral-600' },
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'S';
}

function driverCode(id: number): string {
  return `DRV-${String(id).padStart(4, '0')}`;
}

/** Daftar sopir towing dengan pencarian + filter status. */
export function SopirListPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [drivers, setDrivers] = useState<MitraTowingDriver[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getMitraTowingDrivers()
      .then((items) => {
        if (active) setDrivers(items);
      })
      .catch((error) => toast.error(extractErrorMessage(error, 'Gagal memuat sopir.')))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return drivers.filter((s) => {
      const matchStatus = filter === 'all' || s.status === filter;
      const matchQuery =
        !q ||
        s.fullname.toLowerCase().includes(q) ||
        driverCode(s.id).toLowerCase().includes(q) ||
        s.phone.toLowerCase().includes(q) ||
        s.licenseNumber.toLowerCase().includes(q);
      return matchStatus && matchQuery;
    });
  }, [drivers, query, filter]);

  return (
    <MitraShell>
      <AppHeader showLogo />

      <div className="space-y-4 px-5 pt-4">
        <MitraSearch value={query} onChange={setQuery} placeholder="Cari driver atau ID…" />
        <MitraFilterChips options={SOPIR_FILTERS} value={filter} onChange={setFilter} />
      </div>

      <div className="mt-4 space-y-3 px-5">
        {loading ? (
          <LoadingState label="Memuat sopir…" />
        ) : list.length === 0 ? (
          <p className="text-12 py-10 text-center text-neutral-500">Tidak ada sopir ditemukan.</p>
        ) : (
          list.map((s) => (
            <SopirCard
              key={s.id}
              sopir={s}
              onOpen={() => navigate(buildPath.mitraSopirDetail(String(s.id)))}
            />
          ))
        )}
      </div>

      <MitraFab label="Tambah Sopir" onClick={() => navigate(ROUTES.mitraSopirTambah)} />
    </MitraShell>
  );
}

function SopirCard({ sopir, onOpen }: { sopir: MitraTowingDriver; onOpen: () => void }) {
  const meta = SOPIR_STATUS_META[sopir.status] ?? {
    label: driverStatusLabel(sopir.status),
    tone: 'bg-neutral-200 text-neutral-600',
  };
  const isOffline = sopir.status === 'OFFLINE' || sopir.status === 'INACTIVE';
  // Sopir tidak terikat kendaraan; tampilkan spesialisasi armada saja.
  const specialization = sopir.fleetType ? fleetTypeLabel(sopir.fleetType) : 'Semua jenis armada';

  return (
    <button
      type="button"
      onClick={onOpen}
      className="drive-card block w-full rounded-2xl p-4 text-left transition active:scale-[0.99]"
    >
      <div className="flex items-start gap-3">
        <div className="bg-deep-blue-50 text-deep-blue-600 grid size-12 shrink-0 place-items-center rounded-full text-sm font-semibold">
          {initials(sopir.fullname)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-14 font-semibold text-neutral-900">{sopir.fullname}</p>
          <p className="text-[12px] text-neutral-500">ID: {driverCode(sopir.id)}</p>
        </div>
        <span className={cn('rounded-full px-2.5 py-1 text-[12px] font-medium', meta.tone)}>
          {meta.label}
        </span>
      </div>

      <div className="mt-3 flex items-center gap-2 text-neutral-600">
        <Truck className="size-4" />
        <span className="text-12">Spesialis: {specialization}</span>
      </div>

      <div className="mt-3 border-t border-neutral-300 pt-3">
        <div className="flex items-center justify-between gap-3">
          {sopir.status === 'BUSY' ? (
            <div className="min-w-0">
              <p className="text-[11px] text-neutral-500">Status:</p>
              <p className="text-12 truncate font-semibold text-neutral-900">
                Sedang menangani order
              </p>
            </div>
          ) : isOffline ? (
            <span className="text-12 flex items-center gap-1.5 text-neutral-500">
              <Clock className="size-4" />
              {driverStatusLabel(sopir.status)}
            </span>
          ) : (
            <span className="text-12 flex items-center gap-1.5 font-medium text-neutral-800">
              <Star className="fill-warning text-warning size-4" />
              Siap menerima tugas
            </span>
          )}

          <span
            className={cn(
              'grid size-9 shrink-0 place-items-center rounded-full',
              isOffline ? 'bg-neutral-200 text-neutral-400' : 'bg-deep-blue-50 text-deep-blue-600',
            )}
          >
            <Phone className="size-4" />
          </span>
        </div>
      </div>
    </button>
  );
}
