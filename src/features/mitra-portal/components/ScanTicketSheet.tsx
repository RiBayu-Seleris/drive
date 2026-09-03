import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Camera, Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/feedback/toast';
import { extractErrorMessage } from '@/lib/api/client';
import { scanRepairJob, type RepairJob } from '../repairJobApi';
import { scanWorkshopVisit } from '../workshopVisitApi';

// Pustaka pembacanya ~120 kB (gzip). Dimuat hanya saat kamera benar-benar
// diminta, supaya halaman antrean bengkel tetap ringan di jaringan seluler.
const BarcodeScanner = lazy(() =>
  import('./BarcodeScanner').then((m) => ({ default: m.BarcodeScanner })),
);

/** Pekerjaan yang sedang dibuka; kode yang dimasukkan wajib cocok dengannya. */
export interface ExpectedTicket {
  jobCode: string;
  claimNumber: string;
}

export interface ScanTicketSheetProps {
  open: boolean;
  onClose: () => void;
  onScanned: (job: RepairJob) => void;
  /**
   * Bila diisi, kode yang diketik harus milik pekerjaan ini. Ini yang mencegah
   * petugas menandai tiket terpakai sambil menatap pekerjaan lain — dan
   * memaksa tiket pelanggan benar-benar hadir untuk dipindai.
   */
  expected?: ExpectedTicket | null;
}

const normalize = (value: string): string => value.trim().toUpperCase();

/**
 * Lembar pemindaian tiket perbaikan. Kode diketik atau dimasukkan pemindai
 * barcode (pemindai mengetikkan isinya ke input yang sedang fokus, lalu Enter).
 */
export function ScanTicketSheet({ open, onClose, onScanned, expected }: ScanTicketSheetProps) {
  const [code, setCode] = useState('');
  const [saving, setSaving] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setCode('');
      setCameraOn(false);
      return;
    }
    // Fokus otomatis supaya pemindai barcode genggam (yang berperilaku seperti
    // keyboard) langsung mengisi input ini tanpa disentuh.
    const focus = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(focus);
  }, [open]);

  const verify = async (raw: string) => {
    const value = normalize(raw);
    if (!value) return;

    if (
      expected &&
      !value.startsWith('WVS-') &&
      value !== normalize(expected.jobCode) &&
      value !== normalize(expected.claimNumber)
    ) {
      toast.error('Kode tidak cocok dengan pekerjaan ini. Periksa kembali tiket pelanggan.');
      return;
    }

    setSaving(true);
    try {
      /*
       * Kode kunjungan mandiri (WVS-...) ditangani terpisah.
       *
       * Kunjungan mandiri bukan pekerjaan perbaikan — bisa datang tanpa klaim
       * sama sekali — jadi ia punya endpoint sendiri dan memindainya hanya
       * menandai kendaraan SUDAH TIBA. Tanpa cabang ini, kode WVS ditolak
       * "tiket tidak ditemukan" padahal pelanggannya berdiri di depan meja.
       */
      if (value.startsWith('WVS-')) {
        const visit = await scanWorkshopVisit(value);
        toast.success(
          `Kedatangan ${visit.vehiclePlate || 'kendaraan'} tercatat. Silakan lanjut pemeriksaan.`,
        );
        setCode('');
        setCameraOn(false);
        onClose();
        return;
      }

      const job = await scanRepairJob(value);
      toast.success('Tiket terverifikasi.');
      setCode('');
      setCameraOn(false);
      onScanned(job);
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Tiket tidak ditemukan untuk bengkel ini.'));
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = () => void verify(code);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Pindai Tiket Pelanggan"
      variant="sheet"
      footer={
        <div className="flex gap-3">
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button isLoading={saving} disabled={!code.trim()} onClick={handleSubmit}>
            Verifikasi
          </Button>
        </div>
      }
    >
      <p className="text-12 mb-3 text-neutral-600">
        Minta pelanggan membuka tiketnya dan menekan <strong>Tampilkan kode</strong>, lalu arahkan
        kamera ke kode QR-nya. Bisa juga diketik manual — nomor klaim dan kode kunjungan (WVS) ikut diterima.
      </p>

      {cameraOn ? (
        <Suspense
          fallback={
            <div className="drive-card text-12 grid h-56 place-items-center rounded-xl text-neutral-600">
              <span className="flex items-center gap-2">
                <Loader2 className="size-4 animate-spin" /> Menyiapkan pemindai…
              </span>
            </div>
          }
        >
          <BarcodeScanner
            onDetected={(scanned) => {
              setCode(scanned.toUpperCase());
              void verify(scanned);
            }}
            onError={() => setCameraOn(false)}
          />
        </Suspense>
      ) : (
        <Button
          variant="outline"
          leftIcon={<Camera className="size-4" />}
          onClick={() => setCameraOn(true)}
        >
          Pindai dengan Kamera
        </Button>
      )}

      <div className="text-11 my-3 flex items-center gap-3 text-neutral-500">
        <span className="h-px flex-1 bg-neutral-300" />
        atau ketik kodenya
        <span className="h-px flex-1 bg-neutral-300" />
      </div>

      <input
        ref={inputRef}
        value={code}
        onChange={(event) => setCode(event.target.value.toUpperCase())}
        onKeyDown={(event) => {
          if (event.key === 'Enter') void handleSubmit();
        }}
        placeholder="Contoh: RPJ-XXXXXX"
        autoCapitalize="characters"
        className="focus:border-deep-blue-500 focus:ring-deep-blue-200 h-12 w-full rounded-lg border border-neutral-300 bg-neutral-200 px-4 text-sm font-semibold tracking-wide text-neutral-900 shadow-sm transition placeholder:font-normal placeholder:tracking-normal placeholder:text-neutral-500 focus:ring-2 focus:outline-none"
      />
    </Modal>
  );
}
