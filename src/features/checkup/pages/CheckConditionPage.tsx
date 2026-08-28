import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/Button';
import { TutorialAnalyze, TutorialCapture, TutorialReport } from '@/components/brand/TutorialArt';
import { ROUTES } from '@/app/routes';
import { cn } from '@/lib/utils/cn';
import { firstScanStepRoute } from '../flow';

/**
 * Tutorial sebelum pemindaian.
 *
 * Susunan lama: logo di atas, ilustrasi mengambang di tengah, kartu teks di
 * bawah. Ilustrasinya menggantung tanpa wadah, jadi terbaca sebagai gambar
 * tempelan alih-alih bagian dari alat.
 *
 * Sekarang ilustrasi duduk di dalam PANEL PEMBIDIK — berkurung sudut, berkisi,
 * dan disapu garis pindai — supaya halaman ini terasa seperti sedang menatap
 * layar alat, bukan membaca brosur. Kartu penjelasan menimpa tepi bawah panel,
 * mengikuti bahasa berlapis yang dipakai beranda dan halaman masuk.
 */
const STEPS = [
  {
    art: TutorialCapture,
    title: 'Potret kerusakannya',
    description: 'Ambil dari beberapa sudut. Yang penting bagian yang rusak kelihatan jelas.',
  },
  {
    art: TutorialAnalyze,
    title: 'Kami baca fotonya',
    description: 'Bagian yang rusak ditandai satu per satu, lengkap dengan tingkat parahnya.',
  },
  {
    art: TutorialReport,
    title: 'Hasilnya keluar',
    description: 'Rincian kerusakan, kisaran biaya, dan bengkel yang bisa Anda datangi.',
  },
];

export function CheckConditionPage() {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const current = STEPS[index] ?? STEPS[0]!;
  const isLast = index === STEPS.length - 1;
  const Art = current.art;

  // Tutorial → pilih kendaraan → data kendaraan → izin/scan.
  const startScan = () => {
    navigate(firstScanStepRoute());
  };
  const nextStep = () => setIndex((currentIndex) => Math.min(currentIndex + 1, STEPS.length - 1));

  return (
    <PageContainer className="bg-neutral-200">
      <div className="drive-header drive-fade-b pointer-events-none absolute inset-x-0 top-0 h-[340px]" />

      <div className="relative flex min-h-dvh flex-col px-gutter pt-7 pb-9">
        <div className="flex shrink-0 items-center justify-between">
          <button type="button" onClick={() => navigate(ROUTES.home)}>
            <Logo className="[&_img]:h-9" />
          </button>
          <button
            type="button"
            onClick={startScan}
            className="hud-readout text-[10.5px] tracking-[0.14em] text-neutral-600 uppercase"
          >
            Lewati
          </button>
        </div>

        {/* Panel pembidik */}
        <div className="my-auto">
        <div className="drive-card hud-frame relative mt-7 overflow-hidden">
          <div className="drive-header absolute inset-0 opacity-45" />
          <span className="hud-sweep" aria-hidden />

          {/* Status alat: nomor langkah + ruas kemajuan */}
          <div className="relative flex items-center gap-3 border-b border-[#1e2a34] py-3 pr-5 pl-10">
            <span className="hud-readout text-deep-blue-500 text-[11px]">
              {String(index + 1).padStart(2, '0')}
              <span className="text-neutral-500">/{String(STEPS.length).padStart(2, '0')}</span>
            </span>
            <div className="flex flex-1 gap-1.5">
              {STEPS.map((step, stepIndex) => (
                <button
                  key={step.title}
                  type="button"
                  aria-label={`Langkah ${stepIndex + 1}`}
                  aria-current={stepIndex === index ? 'step' : undefined}
                  onClick={() => setIndex(stepIndex)}
                  className={cn(
                    'h-1 flex-1 rounded-full transition-colors',
                    stepIndex <= index ? 'bg-deep-blue-500' : 'bg-neutral-400',
                  )}
                />
              ))}
            </div>
          </div>

          <div className="relative flex h-[268px] items-center justify-center px-6 pb-6">
            <Art />
          </div>

        </div>

        {/* Kartu penjelasan menimpa tepi bawah panel */}
        <section className="drive-card-accent relative z-10 -mt-5 mx-2 shrink-0 p-5">
          <h1 className="drive-title text-[23px] leading-tight text-neutral-900">
            {current.title}
          </h1>
          <p className="mt-2.5 text-[13px] leading-relaxed text-neutral-600">
            {current.description}
          </p>

          <div className="mt-6">
            {isLast ? (
              <Button size="lg" onClick={startScan}>
                Mulai Sekarang
              </Button>
            ) : (
              <Button size="lg" onClick={nextStep}>
                Selanjutnya
              </Button>
            )}
          </div>
        </section>

        </div>
      </div>
    </PageContainer>
  );
}
