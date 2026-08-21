import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  CheckCircle2,
  PackageCheck,
  Phone,
  QrCode,
  ShieldCheck,
  User,
  Wallet,
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { ROUTES } from '@/app/routes';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/Spinner';
import { confirm } from '@/components/feedback/confirm';
import { toast } from '@/components/feedback/toast';
import { extractErrorMessage } from '@/lib/api/client';
import { formatCurrency } from '@/lib/utils/format';
import { MitraShell } from '../../components/MitraShell';
import { ScanTicketSheet } from '../../components/ScanTicketSheet';
import {
  completeRepairJob,
  receiveRepairJobVehicle,
  getRepairJob,
  repairJobStatusLabel,
  type RepairJob,
} from '../../repairJobApi';

/** Detail satu pekerjaan perbaikan: rincian biaya, verifikasi tiket, selesai. */
export function WorkshopJobDetailPage() {
  const navigate = useNavigate();
  const { id: code = '' } = useParams<{ id: string }>();
  const [job, setJob] = useState<RepairJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    if (!code) return;
    setLoading(true);
    getRepairJob(code)
      .then(setJob)
      .catch((error) => toast.error(extractErrorMessage(error, 'Gagal memuat pekerjaan.')))
      .finally(() => setLoading(false));
  }, [code]);

  useEffect(() => {
    load();
  }, [load]);

  // Verifikasi TIDAK boleh sekali klik: tiket hanya boleh hangus setelah kode
  // pelanggan benar-benar dipindai/diketik. Sekali klik membuat petugas bisa
  // menandai tiket terpakai tanpa pelanggannya hadir.
  const [scanOpen, setScanOpen] = useState(false);

  // Konfirmasi kendaraan diterima — lapis kedua serah-terima setelah foto
  // sopir. Tidak mengubah status pekerjaan dan tidak menghalangi apa pun;
  // gunanya memberi user kepastian dari pihak ketiga.
  const handleReceive = async () => {
    if (!job) return;
    setBusy(true);
    try {
      setJob(await receiveRepairJobVehicle(job.jobCode));
      toast.success('Kendaraan dikonfirmasi diterima.');
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Gagal mengonfirmasi penerimaan.'));
    } finally {
      setBusy(false);
    }
  };

  const handleComplete = async () => {
    if (!job) return;
    const ok = await confirm({
      title: 'Tandai selesai',
      message:
        job.userPayable > 0
          ? `Perbaikan selesai? Pelanggan masih perlu membayar ${formatCurrency(job.userPayable)}.`
          : 'Perbaikan selesai? Seluruh biaya ditanggung asuransi.',
      confirmText: 'Ya, selesai',
    });
    if (!ok) return;

    setBusy(true);
    try {
      setJob(await completeRepairJob(job.jobCode));
      toast.success('Pekerjaan ditandai selesai.');
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Gagal menandai selesai.'));
    } finally {
      setBusy(false);
    }
  };

  if (loading) {
    return (
      <MitraShell>
        <AppHeader title="Detail Pekerjaan" />
        <LoadingState label="Memuat pekerjaan…" />
      </MitraShell>
    );
  }

  if (!job) {
    return (
      <MitraShell>
        <AppHeader title="Detail Pekerjaan" />
        <div className="px-5 py-16 text-center">
          <p className="text-14 font-semibold text-neutral-900">Pekerjaan tidak ditemukan</p>
          <Button className="mt-5" onClick={() => navigate(ROUTES.mitraWorkshopJobs)}>
            Kembali
          </Button>
        </div>
      </MitraShell>
    );
  }

  const isDone = job.status === 'COMPLETED';
  const isCovered = job.insurerId > 0;

  return (
    <MitraShell>
      <AppHeader title="Detail Pekerjaan" />

      <div className="space-y-4 px-5 pt-4">
        <div className="rounded-2xl bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-16 font-semibold text-neutral-900">
                {job.vehiclePlate || 'Tanpa plat'}
              </p>
              <p className="text-11 mt-0.5 text-neutral-500">Kode: {job.jobCode}</p>
            </div>
            <span
              className={cn(
                'shrink-0 rounded-full px-2.5 py-1 text-[14px] font-medium',
                isDone ? 'bg-green-cust/12 text-green-cust' : 'bg-deep-blue-50 text-deep-blue-600',
              )}
            >
              {repairJobStatusLabel(job.status)}
            </span>
          </div>

          <div className="mt-3 space-y-2 border-t border-neutral-100 pt-3">
            <Row icon={<User className="size-4" />} text={job.userFullname || 'Pelanggan'} />
            {job.userPhone && <Row icon={<Phone className="size-4" />} text={job.userPhone} />}
            <Row icon={<ShieldCheck className="size-4" />} text={`Klaim ${job.claimNumber}`} />
          </div>
        </div>

        <div className="flex flex-col gap-y-3 rounded-2xl bg-white p-4 shadow-sm">
          <p className="text-14 flex items-center gap-2 font-semibold text-neutral-900">
            <Wallet className="text-deep-blue-500 size-4" />
            Rincian Biaya
          </p>
          <div className="flex h-auto w-full flex-col gap-y-1">
            <Money label="Estimasi perbaikan" value={job.estimatedCost} />
            {isCovered && job.deductibleAmount > 0 && (
              <Money label="Potongan wajib pelanggan" value={job.deductibleAmount} muted />
            )}
            <Money label="Ditanggung asuransi" value={job.insuranceCoverage} tone="green" />
          </div>
          <div className="h-0.5 w-full rounded-full bg-neutral-400" />
          <div className="h-auto w-full">
            <Money label="Dibayar pelanggan" value={job.userPayable} strong />
          </div>
          {!isCovered && (
            <p className="text-11 mt-3 rounded-xl bg-neutral-50 px-3 py-2 text-neutral-600">
              Pekerjaan ini bayar sendiri — tidak ada porsi asuransi.
            </p>
          )}
        </div>

        {job.notes && (
          <div className="rounded-2xl bg-white p-4 shadow-sm">
            <p className="text-12 font-semibold text-neutral-900">Catatan pelanggan</p>
            <p className="text-12 mt-1 text-neutral-600">{job.notes}</p>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-3 px-5">
        {!job.vehicleReceivedAt && job.status !== 'CANCELED' && (
          <Button
            size="lg"
            variant="outline"
            isLoading={busy}
            leftIcon={<PackageCheck className="size-5" />}
            onClick={handleReceive}
          >
            Konfirmasi Kendaraan Diterima
          </Button>
        )}
        {job.vehicleReceivedAt && (
          <div className="text-green-cust bg-green-cust/10 flex items-center gap-2 rounded-2xl px-4 py-3">
            <PackageCheck className="size-5 shrink-0" />
            <p className="text-12 font-medium">Kendaraan sudah dikonfirmasi diterima.</p>
          </div>
        )}
        {job.status === 'QUEUED' && (
          <Button
            size="lg"
            leftIcon={<QrCode className="size-5" />}
            onClick={() => setScanOpen(true)}
          >
            Pindai Tiket Pelanggan
          </Button>
        )}
        {!isDone && job.status !== 'CANCELED' && (
          <Button
            size="lg"
            variant={job.status === 'QUEUED' ? 'outline' : 'primary'}
            isLoading={busy}
            leftIcon={<CheckCircle2 className="size-5" />}
            onClick={handleComplete}
          >
            Tandai Selesai
          </Button>
        )}
        {isDone && (
          <div className="bg-green-cust/10 text-green-cust flex items-center gap-2 rounded-2xl px-4 py-3">
            <CheckCircle2 className="size-5 shrink-0" />
            <p className="text-12 font-medium">
              {job.userPayable > 0
                ? `Selesai. Menunggu pembayaran pelanggan ${formatCurrency(job.userPayable)}.`
                : 'Selesai dan lunas via asuransi.'}
            </p>
          </div>
        )}
      </div>

      <ScanTicketSheet
        open={scanOpen}
        onClose={() => setScanOpen(false)}
        expected={{ jobCode: job.jobCode, claimNumber: job.claimNumber }}
        onScanned={(scanned) => {
          setScanOpen(false);
          setJob(scanned);
        }}
      />
    </MitraShell>
  );
}

function Row({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="text-12 flex items-center gap-2 text-neutral-700">
      <span className="text-neutral-400">{icon}</span>
      {text}
    </div>
  );
}

function Money({
  label,
  value,
  tone,
  strong,
  muted,
}: {
  label: string;
  value: number;
  tone?: 'green';
  strong?: boolean;
  muted?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <span className={cn('text-[14px]', muted ? 'text-neutral-500' : 'text-neutral-600')}>
        {label}
      </span>
      <span
        className={cn(
          'font-semibold',
          strong ? 'text-[14px] text-neutral-900' : 'text-[14px]',
          tone === 'green' && 'text-green-cust',
          !tone && !strong && 'text-neutral-800',
        )}
      >
        {formatCurrency(value)}
      </span>
    </div>
  );
}
