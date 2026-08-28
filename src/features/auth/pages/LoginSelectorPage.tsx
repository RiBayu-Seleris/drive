import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { Logo } from '@/components/brand/Logo';
import { Button } from '@/components/ui/Button';
import { ROUTES } from '@/app/routes';
import { cn } from '@/lib/utils/cn';

interface LoginOption {
  title: string;
  path: string;
  cta: string;
  cardImage: string;
  desc: string;
}

const CARD_WIDTH = 315;
const CARD_GAP = 16;
const CARD_STEP = CARD_WIDTH + CARD_GAP;
const LOOP_SET_COUNT = 9;

const LOGIN_OPTIONS: LoginOption[] = [
  {
    title: 'User',
    path: ROUTES.loginUser,
    cta: 'Masuk sebagai User',
    cardImage: '/assets/auth/login-cards/user-img.svg',
    desc: 'Aplikasi untuk pengguna, pesan layanan, lacak perjalanan, dan kelola pembayaran dengan mudah.',
  },
  {
    title: 'Mitra',
    path: ROUTES.loginMitra,
    cta: 'Masuk sebagai Mitra',
    cardImage: '/assets/auth/login-cards/mitra-img.svg',
    desc: 'Dashboard mitra kelola armada, pantau performa sopir, dan kelola transaksi pelanggan.',
  },
  {
    title: 'Sopir',
    path: ROUTES.loginSopir,
    cta: 'Masuk sebagai Sopir',
    cardImage: '/assets/auth/login-cards/sopir-img.svg',
    desc: 'Aplikasi untuk sopir terima order, navigasi rute, dan kelola pendapatan dalam satu tempat.',
  },
];

const MIDDLE_SET_INDEX = Math.floor(LOOP_SET_COUNT / 2);
const LOOP_START_INDEX = MIDDLE_SET_INDEX * LOGIN_OPTIONS.length;
const LOOPED_LOGIN_OPTIONS = Array.from({ length: LOOP_SET_COUNT }, (_, setIndex) =>
  LOGIN_OPTIONS.map((option, optionIndex) => ({
    option,
    slideIndex: setIndex * LOGIN_OPTIONS.length + optionIndex,
    key: `${option.path}-${setIndex}`,
  })),
).flat();

function normalizeIndex(index: number): number {
  const length = LOGIN_OPTIONS.length;
  return ((index % length) + length) % length;
}

function centerSlideIndex(logicalIndex: number): number {
  return LOOP_START_INDEX + normalizeIndex(logicalIndex);
}

function jumpTrackTo(track: HTMLDivElement, left: number): void {
  const previousBehavior = track.style.scrollBehavior;
  track.style.scrollBehavior = 'auto';
  track.scrollLeft = left;
  track.style.scrollBehavior = previousBehavior;
}

function withRedirect(path: string, redirectTo?: string): string {
  return redirectTo ? `${path}?redirect=${encodeURIComponent(redirectTo)}` : path;
}

export function LoginSelectorPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get('redirect') ?? undefined;
  const trackRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef<number | null>(null);
  const settleTimerRef = useRef<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [activeSlideIndex, setActiveSlideIndex] = useState(LOOP_START_INDEX);
  const selected = (LOGIN_OPTIONS[selectedIndex] ?? LOGIN_OPTIONS[0])!;

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    jumpTrackTo(track, LOOP_START_INDEX * CARD_STEP);
  }, []);

  useEffect(() => {
    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
      if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
    };
  }, []);

  const updateActiveSlide = (slideIndex: number) => {
    setActiveSlideIndex(slideIndex);
    setSelectedIndex(normalizeIndex(slideIndex));
  };

  const recenterIfNeeded = () => {
    const track = trackRef.current;
    if (!track) return;
    const current = Math.round(track.scrollLeft / CARD_STEP);
    const edgeBuffer = LOGIN_OPTIONS.length * 2;
    const shouldRecenter =
      current < edgeBuffer || current >= LOOPED_LOGIN_OPTIONS.length - edgeBuffer;
    if (!shouldRecenter) return;

    const centered = centerSlideIndex(current);
    updateActiveSlide(centered);
    jumpTrackTo(track, centered * CARD_STEP);
  };

  const scrollToSlide = (slideIndex: number, behavior: ScrollBehavior = 'smooth') => {
    updateActiveSlide(slideIndex);
    trackRef.current?.scrollTo({ left: slideIndex * CARD_STEP, behavior });
  };

  const handleScroll = () => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    frameRef.current = requestAnimationFrame(() => {
      const left = trackRef.current?.scrollLeft ?? 0;
      updateActiveSlide(Math.round(left / CARD_STEP));
      if (settleTimerRef.current !== null) window.clearTimeout(settleTimerRef.current);
      settleTimerRef.current = window.setTimeout(recenterIfNeeded, 140);
    });
  };

  const submit = () => {
    navigate(withRedirect(selected.path, redirectTo));
  };

  return (
    <PageContainer className="bg-neutral-200">
      <div className="flex min-h-dvh flex-col px-4 pt-6 pb-6">
        <div className="flex justify-center">
          <Logo className="[&_img]:h-12" />
        </div>

        <div className="mt-4 flex flex-col items-center justify-center gap-y-2 text-center">
          <p className="text-[24px] leading-tight font-[600] text-[#c2f347]">Pilih Aplikasi Anda</p>
          <div className="flex h-auto w-full items-center justify-center">
            <p className="text-[14px] leading-normal font-[400] text-[#aebbc4]">
              Masuk sesuai akses akun yang sudah Anda miliki di DRIVE.
            </p>
          </div>
        </div>

        <div className="mt-4">
          <div
            ref={trackRef}
            onScroll={handleScroll}
            className="-mx-4 flex snap-x snap-mandatory [scrollbar-width:none] gap-4 overflow-x-auto px-[calc((100%_-_19.6875rem)/2)] py-2 [&::-webkit-scrollbar]:hidden"
            aria-label="Pilih jenis login"
          >
            {LOOPED_LOGIN_OPTIONS.map(({ option, slideIndex, key }) => {
              const isSelected = slideIndex === activeSlideIndex;
              return (
                <div
                  key={key}
                  // type="button"
                  onClick={() => scrollToSlide(slideIndex)}
                  className={cn(
                    'relative aspect-[380/454] min-w-[315px] snap-center overflow-hidden rounded-[20px] bg-neutral-100 p-0 transition',
                    isSelected ? '' : 'opacity-50',
                  )}
                  aria-label={`Masuk sebagai ${option.title}`}
                  aria-current={isSelected ? 'true' : undefined}
                  tabIndex={isSelected ? 0 : -1}
                >
                  <img
                    src={option.cardImage}
                    alt={`Login ${option.title}`}
                    className="h-full w-full rounded-[20px] object-cover"
                    draggable={false}
                  />
                  <div className="absolute bottom-0 left-0 flex h-auto w-full flex-col gap-y-3 px-4 pb-6">
                    <div className="flex h-auto w-full flex-col gap-y-1">
                      <p className="text-md font-medium text-white">DRIVE</p>
                      <p className="text-4xl font-medium text-white">{option.title}</p>
                    </div>
                    <p className="text-[12px] font-medium text-white">{option.desc}</p>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-2 flex flex-row items-center justify-center gap-4">
            {/* <button
              type="button"
              onClick={() => scrollBySlide(-1)}
              className="border-deep-blue-100 text-deep-blue-500 flex size-7 items-center justify-center rounded-full border bg-neutral-100"
              aria-label="Pilihan sebelumnya"
            >
              <ChevronLeft className="size-5" aria-hidden />
            </button> */}
            <div className="flex items-center gap-x-2" aria-hidden>
              {LOGIN_OPTIONS.map((option, index) => (
                <span
                  key={option.path}
                  className={cn(
                    'h-3 rounded-full transition-all',
                    index === selectedIndex ? 'w-14 bg-[#aded1f]' : 'w-3 bg-[#0f1720]',
                  )}
                />
              ))}
            </div>
            {/* <button
              type="button"
              onClick={() => scrollBySlide(1)}
              className="border-deep-blue-100 text-deep-blue-500 flex size-7 items-center justify-center rounded-full border bg-neutral-100"
              aria-label="Pilihan berikutnya"
            >
              <ChevronRight className="size-5" aria-hidden />
            </button> */}
          </div>
          <div className="mt-5 flex h-auto w-full flex-col items-center justify-center gap-y-1.5 text-center">
            <p className="text-[20px] font-[500] text-[#eef4f8]">DRIVE {selected.title}</p>
            <p className="text-[14px] font-[400] text-[#eef4f8]">DRIVE {selected.desc}</p>
          </div>
        </div>

        <div className="mt-auto pt-6">
          <Button type="button" size="lg" onClick={submit}>
            {selected.cta}
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
