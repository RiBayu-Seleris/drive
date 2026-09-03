import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType } from '@zxing/library';
import { Loader2 } from 'lucide-react';

/**
 * Format yang dibaca sengaja dibatasi: tiket klaim memakai Code 128, dan QR
 * disertakan untuk kode lain yang mungkin dipakai nanti. Semakin sedikit
 * format, semakin cepat dan semakin kecil peluang salah baca.
 */
const FORMATS = [BarcodeFormat.CODE_128, BarcodeFormat.QR_CODE];

/** Sesudah sekian lama tanpa hasil, kemungkinan besar bukan sekadar kurang sabar. */
const HINT_AFTER_MS = 12_000;

function messageFor(error: unknown): string {
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError') {
    return 'Izin kamera ditolak. Aktifkan lewat pengaturan browser, atau ketik kodenya manual.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'Kamera tidak ditemukan di perangkat ini. Ketik kodenya manual.';
  }
  if (name === 'NotReadableError' || name === 'TrackStartError') {
    return 'Kamera sedang dipakai aplikasi lain (mis. Zoom atau Photo Booth). Tutup dulu, atau ketik kodenya manual.';
  }
  return 'Kamera tidak bisa dibuka. Ketik kodenya manual.';
}

export interface BarcodeScannerProps {
  /** Dipanggil sekali saat kode terbaca; pemindaian langsung dihentikan. */
  onDetected: (code: string) => void;
  /** Dipanggil bila kamera tidak bisa dipakai, agar pemanggil kembali ke input manual. */
  onError?: (message: string) => void;
}

/**
 * Pemindai barcode berbasis kamera. Dekoder dihentikan begitu satu kode terbaca
 * atau komponen dilepas — kamera yang menyala terus menguras baterai dan
 * membuat lampu indikator perangkat tetap hidup.
 */
export function BarcodeScanner({ onDetected, onError }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const detectedRef = useRef(false);
  const [starting, setStarting] = useState(true);
  const [error, setError] = useState('');
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState('');
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    let controls: IScannerControls | null = null;
    let cancelled = false;

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, FORMATS);
    /*
     * Barcode tiket sering dibaca dari LAYAR HP, bukan dari kertas: ada
     * pantulan, piksel, dan garis halus dari penyegaran layar. Mode "berusaha
     * lebih keras" memberi dekoder kesempatan kedua pada gambar seperti itu,
     * dengan ongkos beberapa milidetik per bingkai.
     */
    hints.set(DecodeHintType.TRY_HARDER, true);
    const reader = new BrowserMultiFormatReader(hints);

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        const message = 'Kamera tidak tersedia di browser ini. Ketik kodenya manual.';
        setError(message);
        setStarting(false);
        onError?.(message);
        return;
      }
      setStarting(true);
      setSlow(false);
      try {
        /*
         * Resolusi diminta setinggi mungkin. Bawaan kamera laptop kerap
         * 640x480 — untuk Code 128 yang batangnya rapat, itu di ambang
         * terbaca, dan hasilnya pemindai yang "menyala tapi tidak pernah
         * mengenali apa pun".
         */
        const video: MediaTrackConstraints = deviceId
          ? { deviceId: { exact: deviceId }, width: { ideal: 1280 }, height: { ideal: 720 } }
          : {
              // Hanya preferensi, bukan syarat: laptop yang cuma punya kamera
              // depan tetap mendapat kameranya.
              facingMode: 'environment',
              width: { ideal: 1280 },
              height: { ideal: 720 },
            };

        controls = await reader.decodeFromConstraints({ video }, videoRef.current!, (result) => {
          if (!result || detectedRef.current) return;
          detectedRef.current = true;
          controls?.stop();
          onDetected(result.getText().trim());
        });
        if (cancelled) {
          controls.stop();
          return;
        }
        setStarting(false);

        /*
         * Daftar kamera baru punya nama setelah izin diberikan, jadi diambil
         * SESUDAH pemindai jalan. Ini penting di laptop: macOS kerap
         * menawarkan kamera iPhone (Continuity) dan "Desk View" yang bisa
         * terpilih lebih dulu dan mengirim gambar gelap — kamera menyala, tapi
         * tidak ada yang bisa dibaca.
         */
        const all = await navigator.mediaDevices.enumerateDevices();
        if (!cancelled) setDevices(all.filter((item) => item.kind === 'videoinput'));
      } catch (err) {
        if (cancelled) return;
        const message = messageFor(err);
        setError(message);
        setStarting(false);
        onError?.(message);
      }
    };

    void start();
    const hintTimer = window.setTimeout(() => {
      if (!cancelled && !detectedRef.current) setSlow(true);
    }, HINT_AFTER_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(hintTimer);
      controls?.stop();
    };
    // onDetected/onError sengaja tidak jadi dependency: kamera hanya boleh
    // dinyalakan ulang saat kameranya diganti, bukan tiap render induknya.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deviceId]);

  if (error) {
    return (
      <div className="drive-card text-12 rounded-xl px-4 py-6 text-center text-neutral-700">
        {error}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative overflow-hidden rounded-xl bg-black">
        <video ref={videoRef} className="h-56 w-full object-cover" autoPlay muted playsInline />

        {/* Bingkai bidik: barcode tiket berbentuk memanjang, jadi kotaknya lebar. */}
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <div className="h-20 w-4/5 rounded-lg border-2 border-white/80 shadow-[0_0_0_9999px_rgb(0_0_0_/_0.35)]" />
        </div>

        {starting && (
          <div className="absolute inset-0 grid place-items-center bg-black/60">
            <span className="text-12 flex items-center gap-2 font-medium text-white">
              <Loader2 className="size-4 animate-spin" /> Menyalakan kamera…
            </span>
          </div>
        )}
      </div>

      {devices.length > 1 && (
        <label className="text-11 flex items-center gap-2 text-neutral-600">
          <span className="shrink-0">Kamera</span>
          <select
            value={deviceId || devices[0]?.deviceId || ''}
            onChange={(event) => {
              detectedRef.current = false;
              setDeviceId(event.target.value);
            }}
            className="text-12 h-9 min-w-0 flex-1 rounded-lg border border-neutral-300 bg-neutral-200 px-2 text-neutral-900"
          >
            {devices.map((item, index) => (
              <option key={item.deviceId} value={item.deviceId}>
                {item.label || `Kamera ${index + 1}`}
              </option>
            ))}
          </select>
        </label>
      )}

      {slow && !starting && (
        <p className="text-11 text-neutral-600">
          Belum terbaca? Dekatkan sampai barcode memenuhi lebar bingkai, naikkan kecerahan layar
          pelanggan, dan hindari pantulan lampu. Kalau tetap gagal, ketik kodenya di bawah.
        </p>
      )}
    </div>
  );
}
