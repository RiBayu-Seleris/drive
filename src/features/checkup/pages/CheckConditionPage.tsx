import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/app/routes';
import { cn } from '@/lib/utils/cn';
import { firstScanStepRoute } from '../flow';

const STEPS = [
  {
    image: '/assets/checkup_vehicle/tutorial_1.png',
    step: 'Step 1:',
    title: 'Dokumentasi Kerusakan',
    description: 'Ambil foto mobil dari beberapa sudut agar detail kerusakan terlihat jelas',
  },
  {
    image: '/assets/checkup_vehicle/tutorial_2.png',
    step: 'Step 2:',
    title: 'Analisis Otomatis',
    description:
      'Teknologi AI akan memeriksa foto dan mengidentifikasi jenis serta tingkat kerusakan',
  },
  {
    image: '/assets/checkup_vehicle/tutorial_3.png',
    step: 'Step 3:',
    title: 'Hasil Pemeriksaan',
    description: 'Dapatkan estimasi biaya perbaikan dan rekomendasi bengkel terpercaya',
  },
];

export function CheckConditionPage() {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const current = STEPS[index] ?? STEPS[0]!;
  const isLast = index === STEPS.length - 1;

  // Tutorial → pilih kendaraan → data kendaraan → izin/scan.
  const startScan = () => {
    navigate(firstScanStepRoute());
  };
  const nextStep = () => setIndex((currentIndex) => Math.min(currentIndex + 1, STEPS.length - 1));

  return (
    <PageContainer className="bg-white">
      <div className="relative flex min-h-dvh flex-col bg-white px-5 pt-14 pb-8">
        <button type="button" onClick={() => navigate(ROUTES.home)} className="mx-auto">
          <Logo className="[&_img]:h-11" />
        </button>

        <div className="mt-20 flex min-h-[260px] items-end justify-center">
          <img src={current.image} alt="" className="max-h-[260px] w-full object-contain" />
        </div>

        <section className="relative -mx-5 mt-8 min-h-[300px] px-5 pt-8">
          <img
            src="/assets/checkup_vehicle/tutorial_bg.png"
            alt=""
            className="pointer-events-none absolute inset-x-0 top-0 z-0 h-full w-full object-cover"
          />
          <div className="relative z-10">
            <p className="text-2xl leading-tight font-bold text-[#4B5563]">{current.step}</p>
            <h1 className="mt-2 text-2xl leading-tight font-bold text-[#4B5563]">
              {current.title}
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-[#4B5563]">{current.description}</p>
          </div>

          <div className="relative z-10 mt-10">
            {isLast ? (
              <Button size="lg" onClick={startScan}>
                Mulai!
              </Button>
            ) : (
              <div className="flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={startScan}
                  className="text-deep-blue-500 text-sm font-medium"
                >
                  Skip Tutorial
                </button>
                <Button fullWidth={false} className="min-w-[150px]" onClick={nextStep}>
                  Selanjutnya
                </Button>
              </div>
            )}
          </div>
        </section>

        <div className="relative z-20 mt-auto flex items-center justify-center gap-3">
          {STEPS.map((step, stepIndex) => (
            <button
              key={step.title}
              type="button"
              aria-label={`Tutorial ${stepIndex + 1}`}
              onClick={() => setIndex(stepIndex)}
              className={cn(
                'size-2.5 rounded-full border transition-colors',
                stepIndex === index
                  ? 'bg-deep-blue-500 border-deep-blue-500'
                  : 'border-deep-blue-100 bg-white',
              )}
            />
          ))}
        </div>
      </div>
    </PageContainer>
  );
}
