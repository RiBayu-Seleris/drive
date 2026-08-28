import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronRight, Truck } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { ROUTES, buildPath } from '@/app/routes';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/Spinner';
import { toast } from '@/components/feedback/toast';
import { extractErrorMessage } from '@/lib/api/client';
import { MitraShell } from '../../components/MitraShell';
import { MitraSearch } from '../../components/MitraSearch';
import { MitraFilterChips } from '../../components/MitraFilterChips';
import { MitraFab } from '../../components/MitraFab';
import {
  fleetStatusLabel,
  fleetTypeLabel,
  getMitraTowingFleets,
  TOWING_FLEET_TYPE_OPTIONS,
  type MitraTowingFleet,
} from '../../api';

const ARMADA_FILTERS = [
  { value: 'all', label: 'Semua' },
  ...TOWING_FLEET_TYPE_OPTIONS.map((option) => ({ value: option.value, label: option.label })),
];

const ARMADA_STATUS_META: Record<string, { label: string; tone: string }> = {
  AVAILABLE: { label: 'Tersedia', tone: 'text-green-cust' },
  BUSY: { label: 'Bertugas', tone: 'text-warning' },
  OFFLINE: { label: 'Offline', tone: 'text-neutral-500' },
  INACTIVE: { label: 'Nonaktif', tone: 'text-neutral-500' },
};

/** Daftar armada towing dengan pencarian + filter jenis. */
export function ArmadaListPage() {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [fleets, setFleets] = useState<MitraTowingFleet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getMitraTowingFleets()
      .then((items) => {
        if (active) setFleets(items);
      })
      .catch((error) => toast.error(extractErrorMessage(error, 'Gagal memuat armada.')))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return fleets.filter((a) => {
      const matchType = filter === 'all' || a.fleetType === filter;
      const matchQuery =
        !q ||
        fleetTypeLabel(a.fleetType).toLowerCase().includes(q) ||
        a.plateNumber.toLowerCase().includes(q) ||
        a.capacityLabel.toLowerCase().includes(q);
      return matchType && matchQuery;
    });
  }, [fleets, query, filter]);

  return (
    <MitraShell>
      <AppHeader showLogo />

      <div className="space-y-4 px-5 pt-4">
        <MitraSearch value={query} onChange={setQuery} placeholder="Cari unit atau nomor plat…" />
        <MitraFilterChips options={ARMADA_FILTERS} value={filter} onChange={setFilter} />
      </div>

      <div className="mt-4 space-y-4 px-5">
        {loading ? (
          <LoadingState label="Memuat armada…" />
        ) : list.length === 0 ? (
          <p className="text-12 py-10 text-center text-neutral-500">Tidak ada armada ditemukan.</p>
        ) : (
          list.map((a) => (
            <ArmadaCard
              key={a.id}
              armada={a}
              onOpen={() => navigate(buildPath.mitraArmadaDetail(String(a.id)))}
              onAssign={() => navigate(ROUTES.mitraOrder)}
            />
          ))
        )}
      </div>

      <MitraFab label="Tambah Armada" onClick={() => navigate(ROUTES.mitraArmadaTambah)} />
    </MitraShell>
  );
}

function ArmadaCard({
  armada,
  onOpen,
  onAssign,
}: {
  armada: MitraTowingFleet;
  onOpen: () => void;
  onAssign: () => void;
}) {
  const meta = ARMADA_STATUS_META[armada.status] ?? {
    label: fleetStatusLabel(armada.status),
    tone: 'text-neutral-500',
  };
  const available = armada.isActive && armada.status === 'AVAILABLE';

  return (
    <div className="drive-card overflow-hidden rounded-2xl">
      <button type="button" onClick={onOpen} className="relative block w-full">
        <div className="from-deep-blue-100 to-deep-blue-50 grid h-36 w-full place-items-center bg-gradient-to-br">
          <Truck className="text-deep-blue-300 size-12" />
        </div>
        <span
          className={cn(
            'absolute top-3 right-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold shadow-sm backdrop-blur',
            meta.tone,
          )}
        >
          {meta.label}
        </span>
      </button>

      <div className="p-4">
        {/* Nama armada + jenis di kiri, plat sebagai chip di kanan (sesuai desain) */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-16 font-bold text-neutral-900">
              {armada.capacityLabel || armada.plateNumber}
            </p>
            <p className="text-12 mt-0.5 text-neutral-500">{fleetTypeLabel(armada.fleetType)}</p>
          </div>
          <span className="text-12 shrink-0 rounded-md bg-neutral-200 px-2.5 py-1 font-semibold tracking-wide text-neutral-700">
            {armada.plateNumber}
          </span>
        </div>

        <div className="mt-3">
          {available ? (
            <Button size="sm" onClick={onAssign}>
              Tugaskan Sekarang
            </Button>
          ) : (
            <button
              type="button"
              onClick={onOpen}
              className="text-deep-blue-500 text-12 flex w-full items-center justify-center gap-1 rounded-lg bg-neutral-200 py-2.5 font-semibold"
            >
              Lihat Detail Tugas
              <ChevronRight className="size-4" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
