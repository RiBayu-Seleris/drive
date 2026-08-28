import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  ClipboardCheck,
  Search,
  Shield,
  Truck,
  User,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { buildPath } from '@/app/routes';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/Spinner';
import { toast } from '@/components/feedback/toast';
import { extractErrorMessage } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';
import { useMitraStore } from '@/features/auth/store/mitraStore';
import { MitraShell } from '../components/MitraShell';
import { getMitraReports, type MitraReportSummary } from '../financeApi';
import type { Laporan, MitraIconKey } from '../types';

const ICONS: Record<MitraIconKey, LucideIcon> = {
  truck: Truck,
  user: User,
  building: Building2,
  wallet: Wallet,
  shield: Shield,
  wrench: Wrench,
};

const TONE: Record<Laporan['statusTone'], string> = {
  yellow: 'bg-warning/15 text-warning',
  blue: 'bg-deep-blue-50 text-deep-blue-600',
  green: 'bg-green-cust/15 text-green-cust',
};

/** Daftar laporan tugas mitra: ringkasan kinerja + tab Aktif/Riwayat. */
export function LaporanPage() {
  const navigate = useNavigate();
  const partnerType = useMitraStore((s) => s.partnerType);
  const [tab, setTab] = useState<'aktif' | 'riwayat'>('aktif');
  const [reports, setReports] = useState<Laporan[]>([]);
  const [stats, setStats] = useState<MitraReportSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getMitraReports(partnerType)
      .then((res) => {
        if (!active) return;
        setReports(res.reports);
        setStats(res.stats);
      })
      .catch((error) => toast.error(extractErrorMessage(error, 'Gagal memuat laporan.')))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [partnerType]);

  const list = useMemo(
    () => reports.filter((item) => (tab === 'riwayat' ? item.archived : !item.archived)),
    [reports, tab],
  );
  const title = partnerType === 'workshop' ? 'Laporan Bengkel' : 'Laporan Sopir Towing';

  return (
    <MitraShell>
      <AppHeader title={title} />

      {loading ? (
        <LoadingState label="Memuat laporan…" />
      ) : (
        <div className="px-5 py-4">
          {/* Hero kinerja */}
          <div className="from-deep-blue-500 to-deep-blue-700 relative overflow-hidden rounded-2xl bg-gradient-to-br p-5 text-white shadow-lg">
            <p className="text-12 text-white/70">Total Laporan Selesai</p>
            <p className="mt-1 text-4xl font-bold">{stats?.completed ?? 0}</p>
            <p className="text-12 mt-2 max-w-[80%] text-white/70">
              Kinerja Anda bulan ini melampaui target sebesar {stats?.growthPercent ?? 0}%.
              Pertahankan profesionalitas Anda.
            </p>
            <ClipboardCheck
              className="absolute -right-3 -bottom-3 size-24 text-white/10"
              strokeWidth={1}
            />
          </div>

          {/* Perlu diselesaikan */}
          <div className="drive-card mt-4 flex flex-col items-center rounded-2xl py-4">
            <span className="bg-deep-blue-50 text-deep-blue-500 grid size-10 place-items-center rounded-full">
              <ClipboardCheck className="size-5" />
            </span>
            <p className="text-12 mt-2 text-neutral-500">Perlu Diselesaikan</p>
            <p className="text-16 font-bold text-neutral-900">
              {String(stats?.pending ?? 0).padStart(2, '0')} Laporan
            </p>
          </div>

          {/* Tab garis */}
          <div className="mt-5 flex gap-6 border-b border-neutral-200">
            <TabButton active={tab === 'aktif'} onClick={() => setTab('aktif')}>
              Laporan Aktif
            </TabButton>
            <TabButton active={tab === 'riwayat'} onClick={() => setTab('riwayat')}>
              Riwayat
            </TabButton>
          </div>

          <div className="mt-4 space-y-3">
            {list.length === 0 ? (
              <p className="text-12 py-8 text-center text-neutral-500">Belum ada laporan.</p>
            ) : (
              list.map((item) => (
                <ReportCard
                  key={item.id}
                  item={item}
                  onOpen={() => navigate(buildPath.mitraLaporanDetail(item.id))}
                />
              ))
            )}
          </div>

          {/* CTA marketplace */}
          <div className="mt-5 flex flex-col items-center rounded-2xl border border-dashed border-neutral-300 bg-white/50 px-5 py-6 text-center">
            <span className="bg-deep-blue-50 text-deep-blue-500 grid size-12 place-items-center rounded-full">
              <Search className="size-5" />
            </span>
            <p className="text-14 mt-3 font-semibold text-neutral-900">Cari Penugasan Lain?</p>
            <p className="text-12 mt-1 text-neutral-500">
              Gunakan fitur jelajah untuk menemukan laporan yang belum terdata di sistem Anda.
            </p>
            <button
              type="button"
              onClick={() => toast.info('Marketplace tugas segera hadir.')}
              className="text-deep-blue-500 text-12 mt-3 font-semibold"
            >
              Buka Marketplace Tugas →
            </button>
          </div>
        </div>
      )}
    </MitraShell>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'text-13 -mb-px border-b-2 pb-2.5 font-semibold transition',
        active ? 'border-deep-blue-500 text-deep-blue-600' : 'border-transparent text-neutral-400',
      )}
    >
      {children}
    </button>
  );
}

function ReportCard({ item, onOpen }: { item: Laporan; onOpen: () => void }) {
  const Icon = ICONS[item.iconKey];
  return (
    <div className="drive-card rounded-2xl p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] flex items-center gap-1.5 font-medium text-neutral-500">
          <Icon className="text-deep-blue-500 size-4" />
          ID: {item.id}
        </span>
        <span
          className={cn(
            'shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold',
            TONE[item.statusTone],
          )}
        >
          {item.statusLabel}
        </span>
      </div>
      <p className="text-14 mt-2 font-semibold text-neutral-900">{item.title}</p>
      <p className="text-12 mt-0.5 text-neutral-500">{item.subtitle}</p>
      {item.actionable ? (
        <Button className="mt-3" onClick={onOpen}>
          Buat Laporan
        </Button>
      ) : (
        <button
          type="button"
          onClick={onOpen}
          className="text-12 mt-3 w-full rounded-lg bg-neutral-200 py-2.5 font-semibold text-neutral-600"
        >
          Lengkapi Data
        </button>
      )}
    </div>
  );
}
