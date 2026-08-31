import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ImageIcon, Plus, Send, Truck, Wrench, X } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { TextArea } from '@/components/ui/TextArea';
import { LoadingState } from '@/components/ui/Spinner';
import { toast } from '@/components/feedback/toast';
import { extractErrorMessage } from '@/lib/api/client';
import { useMitraStore } from '@/features/auth/store/mitraStore';
import { MitraShell } from '../components/MitraShell';
import { getMitraReport, submitMitraReport } from '../financeApi';
import type { Laporan } from '../types';

const SELECT_CLASS =
  'block h-11 w-full rounded-lg border border-neutral-300 bg-neutral-200 px-3 text-sm text-neutral-900 focus:border-deep-blue-500 focus:ring-2 focus:ring-deep-blue-200 focus:outline-none';

/** Form penyelesaian tugas (sesuai desain "Laporan Detail"). */
export function LaporanDetailPage() {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const partnerType = useMitraStore((s) => s.partnerType);
  const [report, setReport] = useState<Laporan | undefined>();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [finalOdometer, setFinalOdometer] = useState('');
  const [vehicleCondition, setVehicleCondition] = useState('baik');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    getMitraReport(partnerType, id)
      .then((res) => {
        if (active) setReport(res);
      })
      .catch((error) => toast.error(extractErrorMessage(error, 'Gagal memuat laporan.')))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [partnerType, id]);

  if (loading) {
    return (
      <MitraShell>
        <AppHeader title="Laporan Detail" />
        <LoadingState label="Memuat laporan…" />
      </MitraShell>
    );
  }

  if (!report) {
    return (
      <MitraShell>
        <AppHeader title="Laporan Detail" />
        <div className="px-5 py-16 text-center">
          <p className="text-14 font-semibold text-neutral-900">Laporan tidak ditemukan</p>
          <Button className="mt-5" onClick={() => navigate(ROUTES.mitraLaporan)}>
            Kembali
          </Button>
        </div>
      </MitraShell>
    );
  }

  const isWorkshop = partnerType === 'workshop';
  const headline = isWorkshop ? 'Perbaikan Selesai' : 'Towing Selesai';
  const HeadIcon = isWorkshop ? Wrench : Truck;

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      const odometer = Number(finalOdometer.replace(/\D/g, '')) || 0;
      const submittedReport = await submitMitraReport(report.id, {
        finalOdometer: odometer,
        vehicleCondition,
        notes,
      });
      toast.success('Laporan berhasil dikirim.');
      navigate(ROUTES.mitraLaporanBerhasil, { state: { report: submittedReport } });
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Gagal mengirim laporan.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <MitraShell>
      <AppHeader title="Laporan Detail" />

      <form onSubmit={handleSubmit} className="px-5 py-4">
        {/* Order header */}
        <div className="flex items-center gap-3">
          <span className="bg-deep-blue-50 text-deep-blue-500 grid size-11 shrink-0 place-items-center rounded-xl">
            <HeadIcon className="size-5" />
          </span>
          <div>
            <p className="text-[11px] font-semibold tracking-wide text-neutral-400">
              ORDER #{report.id}
            </p>
            <p className="text-deep-blue-600 text-16 font-bold">{headline}</p>
          </div>
        </div>

        {/* Foto bukti */}
        <p className="text-12 mt-5 font-medium text-neutral-800">Foto Bukti (Selesai Tugas)</p>
        <div className="mt-2 grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => toast.info('Tambah foto bukti segera hadir.')}
            className="hover:border-deep-blue-400 flex aspect-square w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 text-neutral-400 transition"
          >
            <Plus className="size-6" />
            <span className="text-[11px]">Tambah Foto</span>
          </button>
          <div className="drive-card relative aspect-square overflow-hidden rounded-xl">
            <div className="grid size-full place-items-center">
              <ImageIcon className="size-8 text-neutral-500" />
            </div>
            <button
              type="button"
              aria-label="Hapus foto"
              onClick={() => toast.info('Hapus foto segera hadir.')}
              className="bg-danger absolute top-2 right-2 grid size-6 place-items-center rounded-full text-white shadow"
            >
              <X className="size-3.5" />
            </button>
          </div>
        </div>

        {/* Kilometer akhir */}
        <div className="mt-5">
          <Input
            label="Kilometer Akhir"
            inputMode="numeric"
            placeholder="000.000"
            value={finalOdometer}
            onChange={(event) => setFinalOdometer(event.target.value.replace(/\D/g, ''))}
          />
        </div>

        {/* Kondisi kendaraan */}
        <div className="mt-4">
          <label className="mb-2 block text-sm font-medium text-neutral-800">
            Kondisi Kendaraan
          </label>
          <Select
            className={SELECT_CLASS}
            value={vehicleCondition}
            onChange={setVehicleCondition}
            options={[
              { value: 'baik', label: 'Sesuai (Baik)' },
              { value: 'ringan', label: 'Ada Kerusakan Ringan' },
              { value: 'khusus', label: 'Perlu Perhatian Khusus' },
            ]}
          />
        </div>

        {/* Catatan tambahan */}
        <div className="mt-4">
          <TextArea
            label="Catatan Tambahan"
            rows={4}
            placeholder="Tuliskan catatan detail perjalanan atau kendala yang ditemui…"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>

        <Button
          type="submit"
          className="mt-6"
          isLoading={submitting}
          rightIcon={<Send className="size-5" />}
        >
          Kirim Laporan
        </Button>
        <p className="mt-3 text-center text-[11px] text-neutral-400">
          *Laporan akan diverifikasi oleh tim admin segera.
        </p>
      </form>
    </MitraShell>
  );
}
