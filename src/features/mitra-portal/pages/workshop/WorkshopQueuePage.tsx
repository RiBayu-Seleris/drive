import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Car, CircleCheckBig, QrCode, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { buildPath } from '@/app/routes';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/Spinner';
import { toast } from '@/components/feedback/toast';
import { confirm } from '@/components/feedback/confirm';
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
import {
  completeWorkshopVisit,
  getWorkshopVisits,
  repairWorkshopVisit,
  workshopVisitStatusLabel,
  type WorkshopVisit,
} from '../../workshopVisitApi';

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
  const [visits, setVisits] = useState<WorkshopVisit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showScan, setShowScan] = useState(false);

  /*
   * Dua sumber, satu antrean.
   *
   * `repair_jobs` lahir dari klaim yang sudah disetujui; `workshop_visit_requests`
   * datang dari tombol "Antar Mandiri" dan bisa tanpa klaim sama sekali. Sebelum
   * ini bengkel hanya melihat yang pertama, jadi kendaraan yang diantar sendiri
   * tiba tanpa ada yang menunggunya.
   */
  const load = useCallback((silent = false) => {
    if (!silent) setLoading(true);
    Promise.all([getRepairJobs(), getWorkshopVisits()])
      .then(([jobRows, visitRows]) => {
        setJobs(jobRows);
        setVisits(visitRows);
      })
      .catch((error) => {
        if (!silent) toast.error(extractErrorMessage(error, 'Gagal memuat antrean.'));
      })
      .finally(() => {
        if (!silent) setLoading(false);
      });
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /*
   * Keputusan bengkel setelah memeriksa kendaraan yang diantar sendiri.
   *
   * Dua ujung, satu pemeriksaan: lanjut diperbaiki (lahir pekerjaan perbaikan,
   * kartunya pindah ke daftar di bawah) atau tidak perlu apa-apa (kunjungan
   * ditutup di tempat). Keduanya menutup kartu kunjungan, jadi dikonfirmasi
   * dulu — tidak ada tombol batal setelahnya.
   */
  const [deciding, setDeciding] = useState('');

  const decide = async (visit: WorkshopVisit, repair: boolean) => {
    const ok = await confirm({
      title: repair ? 'Mulai perbaikan?' : 'Tidak perlu perbaikan?',
      message: repair
        ? `Kendaraan ${visit.vehiclePlate || 'ini'} akan masuk antrean pekerjaan perbaikan.`
        : `Kunjungan ${visit.vehiclePlate || 'ini'} ditutup tanpa pekerjaan perbaikan.`,
      confirmText: repair ? 'Dilakukan Perbaikan' : 'Tutup Kunjungan',
    });
    if (!ok) return;
    setDeciding(visit.visitCode);
    try {
      if (repair) {
        await repairWorkshopVisit(visit.visitCode);
        toast.success('Pekerjaan perbaikan dibuat. Kendaraan masuk antrean.');
      } else {
        await completeWorkshopVisit(visit.visitCode);
        toast.success('Kunjungan ditutup tanpa perbaikan.');
      }
      load(true);
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Gagal menyimpan keputusan pemeriksaan.'));
    } finally {
      setDeciding('');
    }
  };

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
        {/* Kunjungan mandiri ditaruh di ATAS: kendaraannya sedang di jalan
            menuju ke sini, jadi lebih mendesak daripada pekerjaan yang mobilnya
            sudah ada di bengkel. */}
        {!loading && visits.length > 0 && filter === 'all' && (
          <div className="mb-4">
            <p className="drive-eyebrow mb-2">Datang sendiri</p>
            <div className="flex flex-col gap-2">
              {visits.map((visit) => (
                <div key={visit.id} className="drive-card rounded-2xl p-4">
                  <div className="flex items-start gap-3">
                    <div className="drive-chip grid size-11 shrink-0 place-items-center rounded-full">
                      <QrCode className="text-deep-blue-500 size-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-14 font-semibold text-neutral-900">
                        {visit.vehiclePlate || 'Plat belum diisi'}
                      </p>
                      <p className="text-11 text-neutral-500">
                        {visit.userFullname || 'Pelanggan'}
                        {visit.userPhone ? ` · ${visit.userPhone}` : ''}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-full px-2.5 py-1 text-[12px] font-medium',
                        visit.status === 'ARRIVED'
                          ? 'bg-green-cust/12 text-green-cust'
                          : 'bg-warning/12 text-warning',
                      )}
                    >
                      {workshopVisitStatusLabel(visit.status)}
                    </span>
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-neutral-300 pt-3">
                    <span className="hud-readout text-11 text-deep-blue-500">
                      {visit.visitCode}
                    </span>
                    <span className="text-11 text-neutral-600">
                      {visit.claimNumber ? `Klaim ${visit.claimNumber}` : 'Tanpa klaim'}
                    </span>
                  </div>

                  {/* Kendaraan sudah di tempat dan diperiksa — dua ujung yang
                      mungkin dari pemeriksaan itu. Sebelum tiba, tidak ada yang
                      bisa diputuskan: mobilnya belum kelihatan. */}
                  {visit.status === 'ARRIVED' && (
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        disabled={deciding === visit.visitCode}
                        leftIcon={<CircleCheckBig className="size-4" />}
                        onClick={() => void decide(visit, false)}
                      >
                        Tidak Perlu
                      </Button>
                      <Button
                        isLoading={deciding === visit.visitCode}
                        leftIcon={<Wrench className="size-4" />}
                        onClick={() => void decide(visit, true)}
                      >
                        Perbaikan
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

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
