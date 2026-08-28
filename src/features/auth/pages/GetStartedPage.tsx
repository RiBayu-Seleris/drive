import { useNavigate } from 'react-router-dom';
import { ROUTES } from '@/app/routes';
import { useAppStore } from '@/app/appStore';

export function GetStartedPage() {
  const navigate = useNavigate();
  const markOnboardingSeen = useAppStore((s) => s.markOnboardingSeen);

  const handleStart = () => {
    markOnboardingSeen();
    navigate(ROUTES.home, { replace: true });
  };

  return (
    <main className="mx-auto min-h-dvh w-full max-w-[480px] bg-neutral-200">
      <div className="relative flex min-h-dvh w-full flex-col justify-end overflow-hidden px-6 pb-12 text-white sm:pb-24">
        <img
          src="/assets/home/home.webp"
          alt="Mobil Porsche"
          fetchPriority="high"
          className="absolute inset-0 z-0 size-full object-cover"
        />
        <div className="absolute inset-0 z-10 bg-gradient-to-b from-transparent via-[#070c11]/55 to-[#070c11]" />

        <div className="relative z-20 mb-8 max-w-sm sm:mb-12">
          <h1 className="text-[30px] leading-tight font-semibold text-white">
            Insurance Claims
            <br />
            in Minutes
          </h1>
          <p className="mt-4 text-[16px] font-light text-white">
            AI technology that instantly analyzes
            <br />
            your car&apos;s damage
          </p>
        </div>

        <div className="relative z-40 w-full">
          <button
            type="button"
            onClick={handleStart}
            className="h-14 w-full rounded-lg bg-gradient-to-r from-[#c2f347] to-[#83bd04] text-lg font-semibold text-[#10200a] shadow-[0_0_28px_-8px_rgba(173,237,31,0.75)] transition-colors hover:opacity-90"
          >
            Start Now!
          </button>
        </div>
      </div>
    </main>
  );
}
