import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ArrowRight, Check } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Logo } from '@/components/brand/Logo';
import { ScanTurntable } from '@/components/brand/ScanTurntable';
import { Button } from '@/components/ui/Button';
import { extractErrorMessage } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';
import { ROUTES } from '@/app/routes';
import { isInsuranceScan, useScanStore } from '@/features/vehicle-scan/store/scanStore';
import { analyzeDamage } from '@/features/damage/api/damageApi';
import { useDamageStore } from '@/features/damage/store/damageStore';
import { scanSignature } from '../scanSignature';

/**
 * Layar tunggu saat foto sedang dianalisis.
 *
 * Sebelumnya panggilan ini terjadi diam-diam di halaman review: tombolnya
 * berputar, lalu tiba-tiba pindah ke layar hasil. Untuk panggilan yang bisa
 * makan belasan detik, itu terasa seperti aplikasinya menggantung.
 *
 * Animasi utamanya kendaraan rangka kawat yang berputar di atas meja putar
 * (`ScanTurntable`) — rotasi 3D sungguhan, bukan gambar datar yang dipipihkan.
 * Versi sebelumnya memutar FOTO plat dan sisi kendaraan; itu jujur, tapi plat
 * nomor bukan yang sedang dianalisis di tahap ini dan menampilkannya besar
 * justru menonjolkan bagian yang salah.
 *
 * Yang tetap terikat data nyata: label sisi yang sedang dibaca dan
 * penghitungnya diambil dari foto yang benar-benar dikirim.
 *
 * CATATAN PENTING soal cincin persentase: layanan AI tidak mengirim kemajuan
 * apa pun — satu permintaan, satu jawaban. Jadi angka di cincin BUKAN kemajuan
 * sungguhan; ia merayap mendekati 94% lalu BERHENTI di situ, dan baru bergerak
 * ke 100% setelah jawabannya benar-benar tiba. Sengaja begitu supaya layar ini
 * tidak pernah berjanji "tinggal 2 detik lagi" padahal tidak tahu.
 *
 * Halaman ini TIDAK pindah sendiri. Setelah 100%, user menekan "Lihat Hasil
 * Analisis" — hasilnya dibuka karena diminta, bukan karena layar berpindah
 * duluan sebelum sempat dibaca.
 */

/** Ambang munculnya tiap centang. Yang terakhir < 94 supaya semua sempat tampil. */
const STEPS = [
  { at: 8, label: 'Membaca foto kendaraan' },
  { at: 34, label: 'Mengenali bagian yang rusak' },
  { at: 58, label: 'Menilai tingkat keparahan' },
  { at: 80, label: 'Menghitung perkiraan biaya' },
];

/** Batas merayapnya cincin selama jawaban belum tiba. */
const CREEP_CEILING = 94;
/**
 * Tetapan laju rayapan (per detik). Makin kecil, makin lambat mendekati
 * langit-langit. 0.2 memberi tetapan waktu ~5 detik: sekitar 60% jarak dalam 5
 * detik, 85% dalam 10 detik — cukup terasa bergerak tanpa buru-buru mentok.
 */
const CREEP_RATE = 0.2;
/** Lama naik dari posisi rayapan ke 100% setelah jawaban tiba. */
const FINISH_MS = 1400;
/** Lama satu label sisi ditampilkan sebelum berganti. */
const FRAME_MS = 1900;
/** Laju putar kendaraan (radian per detik) saat memindai. */
const SPIN_RATE = 0.9;
/** Setelah selesai kendaraannya tetap berputar, tapi setengah laju. */
const SPIN_RATE_DONE = 0.35;

type Phase = 'scanning' | 'finishing' | 'ready' | 'error';

/**
 * Menghormati "kurangi animasi" di setelan sistem.
 *
 * Putaran kendaraan itu hiasan, jadi dimatikan. Cincin persentase TIDAK ikut
 * dimatikan — ia membawa informasi, bukan hiasan, dan mematikannya membuat
 * layar ini terlihat menggantung.
 */
function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
  );
}

/** Melandai di ujung — berhenti mulus di 100%, bukan mengerem mendadak. */
function easeOut(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function AnalyzingPage() {
  const navigate = useNavigate();
  const plate = useScanStore((s) => s.plate);
  const sides = useScanStore((s) => s.sides);
  const scanPurpose = useScanStore((s) => s.scanPurpose);
  const setResult = useDamageStore((s) => s.setResult);
  const setAnalyzing = useDamageStore((s) => s.setAnalyzing);

  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState<Phase>('scanning');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [frame, setFrame] = useState(0);
  const [target, setTarget] = useState<string>(ROUTES.damageAnalysis);
  const [angle, setAngle] = useState(0);

  /** Menahan StrictMode agar tidak mengirim foto dua kali di mode pengembangan. */
  const startedRef = useRef(-1);
  /**
   * Penanda "komponen masih hidup", DIPISAH dari efek pengiriman.
   *
   * Versi pertama memakai variabel `active` di dalam efek pengiriman itu
   * sendiri. Di StrictMode React menjalankan efek → cleanup → efek lagi: cleanup
   * yang pertama menyetel `active = false` untuk permintaan yang TERLANJUR
   * terbang, sementara efek kedua berhenti lebih awal karena `startedRef` sudah
   * terisi. Akibatnya jawaban yang datang diabaikan dan halaman menggantung di
   * 94% selamanya. Ref terpisah tidak ikut dimatikan oleh cleanup palsu itu.
   */
  const aliveRef = useRef(true);
  /** Nilai cincin dibaca loop animasi tanpa memicu render ulang tiap frame. */
  const progressRef = useRef(0);
  /** Titik awal dan waktu mulai tahap naik ke 100%. */
  const finishRef = useRef<{ from: number; at: number } | null>(null);
  /** Sudut putar disimpan di ref agar loop tidak bergantung pada render. */
  const angleRef = useRef(0);

  /**
   * Label foto yang benar-benar dikirim. Gambarnya tidak lagi ditampilkan,
   * tapi penghitung "02/05" tetap mengacu ke berkas yang nyata — bukan angka
   * karangan.
   */
  const shots = useMemo(() => {
    const list: string[] = [];
    if (plate.image) list.push('Plat nomor');
    for (const side of sides) {
      if (side.photo) list.push(side.label);
    }
    return list;
  }, [plate.image, sides]);

  useEffect(() => {
    aliveRef.current = true;
    return () => {
      aliveRef.current = false;
    };
  }, []);

  // Masuk langsung ke URL ini (atau refresh) tidak membawa foto apa pun —
  // store pemindaian hanya hidup di memori. Kembalikan ke halaman review.
  useEffect(() => {
    if (!plate.image) navigate(ROUTES.previewVehicle, { replace: true });
  }, [plate.image, navigate]);

  /*
   * Satu loop animasi untuk seluruh gerakan cincin.
   *
   * Versi pertama memakai `setInterval` 110 md: angkanya melompat tujuh kali
   * sedetik dan cincinnya tersendat. Di sini nilainya dihitung per frame dari
   * selisih waktu nyata, jadi gerakannya mulus di layar 60 Hz maupun 120 Hz dan
   * tidak melompat ketika tab sempat tidak aktif.
   */
  useEffect(() => {
    if (phase === 'error') return;

    const reduceMotion = prefersReducedMotion();
    // Sudah selesai DAN putarannya dimatikan berarti tidak ada lagi yang
    // bergerak — jangan biarkan loop berjalan sia-sia menguras baterai.
    if (phase === 'ready' && reduceMotion) return;

    let raf = 0;
    let last = performance.now();

    const tick = (now: number) => {
      // Dibatasi 64 md: kembali dari tab yang lama tidak aktif tidak boleh
      // membuat cincinnya meloncat jauh dalam satu frame.
      const dt = Math.min(64, now - last) / 1000;
      last = now;

      // Kendaraan terus berputar, termasuk setelah selesai — layar yang
      // membeku total terasa seperti aplikasinya berhenti.
      if (!reduceMotion) {
        angleRef.current += (phase === 'ready' ? SPIN_RATE_DONE : SPIN_RATE) * dt;
        setAngle(angleRef.current);
      }

      if (phase === 'ready') {
        raf = requestAnimationFrame(tick);
        return;
      }

      if (phase === 'scanning') {
        const p = progressRef.current;
        // Mendekati langit-langit dengan laju melandai — makin dekat, makin
        // pelan. Rumus eksponensial ini tidak bergantung pada frame rate.
        progressRef.current = p + (CREEP_CEILING - p) * (1 - Math.exp(-CREEP_RATE * dt));
      } else {
        const finish = finishRef.current;
        if (finish) {
          const t = Math.min(1, (now - finish.at) / FINISH_MS);
          progressRef.current = finish.from + (100 - finish.from) * easeOut(t);
          if (t >= 1) {
            progressRef.current = 100;
            setProgress(100);
            setPhase('ready');
            return;
          }
        }
      }

      setProgress(progressRef.current);
      raf = requestAnimationFrame(tick);
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  // Foto berganti selama masih memindai.
  useEffect(() => {
    if (phase !== 'scanning' || shots.length < 2) return;
    const timer = window.setInterval(() => setFrame((i) => (i + 1) % shots.length), FRAME_MS);
    return () => window.clearInterval(timer);
  }, [phase, shots.length]);

  useEffect(() => {
    if (!plate.image || startedRef.current === attempt) return;
    startedRef.current = attempt;

    setError(null);
    setAnalyzing(true);

    void analyzeDamage({
      plateNumber: plate.number,
      plateImage: plate.image?.blob ?? null,
      sides: sides.map((s) => ({ id: s.id, damaged: s.damaged, image: s.photo?.blob ?? null })),
      purpose: scanPurpose,
    })
      .then((result) => {
        if (!aliveRef.current) return;
        setResult(result, scanSignature(plate.number, plate.image, sides));
        // Hasil bersih pada jalur asuransi berarti kendaraannya layak dibeli
        // polis — alurnya berbeda dari melihat laporan kerusakan.
        setTarget(
          isInsuranceScan(scanPurpose) && result.repair.percentage <= 0
            ? ROUTES.insuranceSearch
            : ROUTES.damageAnalysis,
        );
        finishRef.current = { from: progressRef.current, at: performance.now() };
        setPhase('finishing');
      })
      .catch((err) => {
        if (!aliveRef.current) return;
        setError(extractErrorMessage(err, 'Gagal menganalisis kerusakan.'));
        setPhase('error');
      })
      .finally(() => {
        if (aliveRef.current) setAnalyzing(false);
      });
  }, [attempt, plate, sides, scanPurpose, setResult, setAnalyzing]);

  const openResult = useCallback(() => {
    navigate(target, {
      replace: true,
      state: target === ROUTES.insuranceSearch ? { requiresDamageFreeScan: true } : undefined,
    });
  }, [navigate, target]);

  const retry = useCallback(() => {
    progressRef.current = 0;
    finishRef.current = null;
    setProgress(0);
    setPhase('scanning');
    setAttempt((n) => n + 1);
  }, []);

  const shown = Math.min(100, Math.round(progress));
  const ready = phase === 'ready';
  // `findLastIndex` belum ada di target TS proyek ini. STEPS urut menaik, jadi
  // jumlah langkah yang sudah terlewati sudah cukup untuk menentukan posisinya.
  const passed = STEPS.filter((step) => shown >= step.at).length;
  const activeStep = ready ? STEPS.length : Math.max(0, passed - 1);
  const current = shots[frame % Math.max(1, shots.length)];

  if (phase === 'error') {
    return (
      <PageContainer>
        <div className="flex min-h-dvh flex-col px-6 pt-8 pb-10">
          <Logo className="mx-auto [&_img]:h-9" />
          <div className="flex flex-1 flex-col items-center justify-center text-center">
            <span className="border-danger/35 bg-danger/10 grid size-16 place-items-center rounded-full border">
              <AlertTriangle className="text-danger size-7" />
            </span>
            <h1 className="mt-6 text-xl font-bold text-neutral-900">Analisis belum berhasil</h1>
            <p className="text-13 mt-3 max-w-xs leading-relaxed text-neutral-600">{error}</p>
            <div className="mt-8 flex w-full max-w-xs flex-col gap-3">
              <Button onClick={retry}>Coba lagi</Button>
              <button
                type="button"
                onClick={() => navigate(ROUTES.previewVehicle, { replace: true })}
                className="text-13 py-2 font-medium text-neutral-600"
              >
                Kembali ke foto
              </button>
            </div>
          </div>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="flex min-h-dvh flex-col px-5 pt-7 pb-8">
        <Logo className="mx-auto [&_img]:h-8" />

        <div className="mt-6 flex items-center justify-center gap-2">
          <span className="relative flex size-2">
            {!ready && (
              <span className="bg-deep-blue-500 absolute inline-flex size-full animate-ping rounded-full opacity-70" />
            )}
            <span className="bg-deep-blue-500 relative inline-flex size-2 rounded-full" />
          </span>
          <span className="drive-eyebrow">
            {ready ? 'Analisis selesai' : 'DRIVE sedang membaca'}
          </span>
        </div>

        {/* Kendaraan berputar di atas meja putar — animasi utama layar ini. */}
        <div className="hud-frame relative mt-4 aspect-video w-full overflow-hidden rounded-xl border border-neutral-300 bg-neutral-200">
          {/* Kisi teknis tipis — kesan instrumen, bukan panggung kosong. */}
          <div
            aria-hidden
            className="absolute inset-0 opacity-[0.16]"
            style={{
              backgroundImage:
                'repeating-linear-gradient(0deg,#aded1f 0 1px,transparent 1px 26px),repeating-linear-gradient(90deg,#aded1f 0 1px,transparent 1px 26px)',
            }}
          />
          <ScanTurntable angle={angle} scanning={!ready} className="relative block size-full" />
          {current && (
            <span className="hud-readout text-deep-blue-500 absolute bottom-2.5 left-3 text-[10px] tracking-[0.16em] uppercase">
              {ready ? 'Semua sisi terbaca' : current}
            </span>
          )}
          {shots.length > 0 && (
            <span className="hud-readout absolute right-3 bottom-2.5 text-[10px] text-neutral-700">
              {String(ready ? shots.length : (frame % shots.length) + 1).padStart(2, '0')}/
              {String(shots.length).padStart(2, '0')}
            </span>
          )}
        </div>

        <ScanRing value={progress} label={shown} className="mx-auto mt-7" />

        <ul className="mx-auto mt-7 w-full max-w-xs space-y-3">
          {STEPS.map((step, index) => {
            const isDone = ready || index < activeStep;
            const isActive = !ready && index === activeStep;
            return (
              <li key={step.label} className="flex items-center gap-3">
                <span
                  className={cn(
                    'grid size-5 shrink-0 place-items-center rounded-full border transition-colors duration-300',
                    isDone && 'border-deep-blue-500 bg-deep-blue-500 text-[#10200a]',
                    isActive && 'border-deep-blue-500 text-transparent',
                    !isDone && !isActive && 'border-neutral-400 text-transparent',
                  )}
                >
                  {isActive ? (
                    <span className="bg-deep-blue-500 size-2 animate-pulse rounded-full" />
                  ) : (
                    <Check className="size-3.5" strokeWidth={3} />
                  )}
                </span>
                <span
                  className={cn(
                    'text-13 transition-colors duration-300',
                    isDone || isActive ? 'text-neutral-900' : 'text-neutral-500',
                  )}
                >
                  {step.label}
                </span>
              </li>
            );
          })}
        </ul>

        <div className="mt-auto pt-7">
          {ready ? (
            <Button onClick={openResult} className="animate-fade-in">
              Lihat Hasil Analisis
              <ArrowRight className="ml-1 size-4" />
            </Button>
          ) : (
            <p className="text-11 text-center text-neutral-500">
              Mohon tunggu, jangan tutup halaman ini.
            </p>
          )}
        </div>
      </div>
    </PageContainer>
  );
}

/**
 * Cincin kemajuan pemindaian.
 *
 * Sengaja BUKAN `RadialProgress` milik halaman hasil: gauge itu memetakan
 * angkanya ke skala keparahan hijau→merah dan menuliskan label seperti
 * "Kerusakan Berat". Di layar tunggu, 80% berarti "hampir selesai", bukan
 * "rusak parah" — memakai gauge itu akan menakuti orang tanpa alasan.
 *
 * `value` sengaja pecahan (bukan bulat) supaya busurnya bergerak mulus per
 * frame; angka yang dibaca mata dibulatkan terpisah lewat `label`.
 */
function ScanRing({
  value,
  label,
  className,
}: {
  value: number;
  label: number;
  className?: string;
}) {
  const size = 168;
  const stroke = 11;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - Math.min(100, Math.max(0, value)) / 100);

  return (
    <div className={cn('relative', className)} style={{ width: size, height: size }}>
      {/* Pendar di belakang cincin — sumber cahaya yang sama dengan sistem. */}
      <div className="bg-deep-blue-500/12 absolute inset-5 rounded-full blur-2xl" />
      <svg viewBox={`0 0 ${size} ${size}`} className="relative block size-full -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="#223039"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--color-deep-blue-500)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        <span className="font-display text-[34px] leading-none font-bold text-neutral-900">
          {label}%
        </span>
      </div>
    </div>
  );
}
