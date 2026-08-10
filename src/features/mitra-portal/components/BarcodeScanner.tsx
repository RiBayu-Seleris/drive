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

function messageFor(error: unknown): string {
  const name = error instanceof Error ? error.name : '';
  if (name === 'NotAllowedError') {
    return 'Izin kamera ditolak. Aktifkan lewat pengaturan browser, atau ketik kodenya manual.';
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'Kamera tidak ditemukan di perangkat ini. Ketik kodenya manual.';
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
 * Pemindai barcode berbasis kamera belakang. Dekoder dihentikan begitu satu
 * kode terbaca atau komponen dilepas — kamera yang menyala terus menguras
 * baterai dan membuat lampu indikator perangkat tetap hidup.
 */
export function BarcodeScanner({ onDetected, onError }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const detectedRef = useRef(false);
  const [starting, setStarting] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let controls: IScannerControls | null = null;
    let cancelled = false;

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, FORMATS);
    const reader = new BrowserMultiFormatReader(hints);

    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        const message = 'Kamera tidak tersedia di browser ini. Ketik kodenya manual.';
        setError(message);
        setStarting(false);
        onError?.(message);
        return;
      }
      try {
        controls = await reader.decodeFromConstraints(
          { video: { facingMode: 'environment' } },
          videoRef.current!,
          (result) => {
            if (!result || detectedRef.current) return;
            detectedRef.current = true;
            controls?.stop();
            onDetected(result.getText().trim());
          },
        );
        if (cancelled) controls.stop();
        else setStarting(false);
      } catch (err) {
        if (cancelled) return;
        const message = messageFor(err);
        setError(message);
        setStarting(false);
        onError?.(message);
      }
    };

    void start();

    return () => {
      cancelled = true;
      controls?.stop();
    };
    // onDetected/onError sengaja tidak jadi dependency: kamera hanya boleh
    // dinyalakan sekali per pembukaan, bukan tiap render induknya.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="text-12 rounded-xl bg-neutral-100 px-4 py-6 text-center text-neutral-700">
        {error}
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-xl bg-black">
      <video ref={videoRef} className="h-56 w-full object-cover" muted playsInline />

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
  );
}
