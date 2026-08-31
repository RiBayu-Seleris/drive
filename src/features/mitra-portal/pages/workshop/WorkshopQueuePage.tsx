import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, QrCode, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { buildPath } from '@/app/routes';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/Spinner';
import { toast } from '@/components/feedback/toast';
import { extractErrorMessage } from '@/lib/api/client';
import { formatCurrency } from '@/lib/utils/format';
import { MitraShell } from '../../components/MitraShell';
import { MitraFilterChips } from '../../components/MitraFilterChips';
import { ScanTicketSheet } from '../../components/ScanTicketSheet';
import {
  getRepairJobs,
  repairJobStatusLabel,
  type RepairJob,
  type RepairJobStatus,
} from '../../repairJobApi';

const FILTERS = [
  { value: 'all', label: 'Semua' },
  { value: 'QUEUED', label: 'Menunggu' },
  { value: 'IN_PROGRESS', label: 'Dikerjakan' },
  { value: 'COMPLETED', label: 'Selesai' },
];

const STATUS_TONE: Record<RepairJobStatus, string> = {
  QUEUED: 'bg-warning/12 text-warning',
  IN_PROGRESS: 'bg-deep-blue-50 text-deep-blue-600',
  COMPLETED: 'bg-green-cust/12 text-green-cust',
  CANCELED: 'bg-neutral-200 text-neutral-600',
};

/** Antrean pekerjaan perbaikan milik bengkel ini. */
export function WorkshopQueuePage() {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('all');
  const [jobs, setJobs] = useState<RepairJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [showScan, setShowScan] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    getRepairJobs()
      .then(setJobs)
      .catch((error) => toast.error(extractErrorMessage(error, 'Gagal memuat antrean.')))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const list = useMemo(
    () => (filter === 'all' ? jobs : jobs.filter((job) => job.status === filter)),
    [jobs, filter],
  );
  const waiting = useMemo(() => jobs.filter((job) => job.status === 'QUEUED').length, [jobs]);

  return (
    <MitraShell>
      <AppHeader title="Antrian Bengkel" />

      <div className="space-y-4 px-5 pt-4">
        {/*
          Kartu gelap dengan aksen hijau — pola yang dipakai seluruh aplikasi
          ini. Sebelumnya berupa slab hijau terang setinggi penuh dengan baris
          kedua `text-white/70`: putih di atas #aded1f praktis tidak terbaca,
          dan bidang hijau sebesar itu menyilaukan di tema gelap.
        */}
        <div className="drive-card flex items-center gap-3 p-4">
          <span className="drive-chip grid size-11 shrink-0 place-items-center rounded-full">
            <Wrench className="text-deep-blue-500 size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-14 font-semibold text-neutral-900">
              <span className="text-deep-blue-500">{waiting}</span> mobil menunggu dikerjakan
            </p>
            <p className="text-12 text-neutral-600">
              Semua pekerjaan di sini klaimnya sudah disetujui asuransi
            </p>
          </div>
        </div>

        <Button leftIcon={<QrCode className="size-5" />} onClick={() => setShowScan(true)}>
          Pindai Tiket Pelanggan
        </Button>

        <MitraFilterChips options={FILTERS} value={filter} onChange={setFilter} />
      </div>

      <div className="mt-4 space-y-3 px-5">
        {loading ? (
          <LoadingState label="Memuat antrean…" />
        ) : list.length === 0 ? (
          <div className="py-12 text-center">
            <Car className="mx-auto size-9 text-neutral-500" />
            <p className="text-12 mt-3 text-neutral-500">
              {filter === 'all'
                ? 'Belum ada pekerjaan masuk.'
                : 'Tidak ada pekerjaan pada filter ini.'}
            </p>
          </div>
        ) : (
          list.map((job) => (
            <button
              key={job.id}
              type="button"
              onClick={() => navigate(buildPath.mitraWorkshopJobDetail(job.jobCode))}
              className="drive-card block w-full rounded-2xl p-4 text-left transition active:scale-[0.99]"
            >
              <div className="flex items-start gap-3">
                <div className="bg-deep-blue-50 text-deep-blue-600 grid size-11 shrink-0 place-items-center rounded-full">
                  <Car className="size-5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-14 font-semibold text-neutral-900">
                    {job.vehiclePlate || 'Tanpa plat'}
                  </p>
                  <p className="text-11 text-neutral-500">
                    {job.userFullname || 'Pelanggan'} · {job.claimNumber}
                  </p>
                </div>
                <span
                  className={cn(
                    'shrink-0 rounded-full px-2.5 py-1 text-[14px] font-medium',
                    STATUS_TONE[job.status],
                  )}
                >
                  {repairJobStatusLabel(job.status)}
                </span>
              </div>

              <div className="mt-3 flex items-center justify-between border-t border-neutral-300 pt-3">
                <span className="text-12 text-neutral-600">Estimasi biaya</span>
                <span className="text-14 font-semibold text-neutral-900">
                  {formatCurrency(job.estimatedCost)}
                </span>
              </div>
            </button>
          ))
        )}
      </div>

      <ScanTicketSheet
        open={showScan}
        onClose={() => setShowScan(false)}
        onScanned={(job) => {
          setShowScan(false);
          load();
          navigate(buildPath.mitraWorkshopJobDetail(job.jobCode));
        }}
      />
    </MitraShell>
  );
}
