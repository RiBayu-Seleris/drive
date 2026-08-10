import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import { ChevronDown, Mail, WalletCards } from 'lucide-react';
import { Logo } from '@/components/brand/Logo';
import { Skeleton } from '@/components/ui/Skeleton';
import { ROUTES, buildPath } from '@/app/routes';
import { cn } from '@/lib/utils/cn';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useDamageStore } from '@/features/damage/store/damageStore';
import { useScanStore } from '@/features/vehicle-scan/store/scanStore';
import { getVehicles } from '@/features/vehicle/api';
import { hasPolis, type SavedVehicle } from '@/features/vehicle/types';
import { getActivities, getPaymentHistory } from '@/features/activity/api';
import LogoOnly from '/assets/home/logo-only.svg';

const SERVICE_MENU = [
  {
    image: '/assets/home/ajukan_klaim.svg',
    label: 'Cek Kondisi Kendaraan',
    to: ROUTES.checkCondition,
  },
  { image: '/assets/home/lihat_klaim.svg', label: 'Hasil Checkup', to: ROUTES.recentActivity },
  { image: '/assets/home/cari_bengkel.svg', label: 'Cari Bengkel', to: ROUTES.workshopList },
] as const;

const SHEET_MIN_HEIGHT = 25;
const SHEET_INITIAL_HEIGHT = 60;
const SHEET_MAX_HEIGHT = 95;
const SHEET_ANIMATION_MS = 220;

const HOME_LIST_LIMIT = 3;

// Label ramah untuk payment_type dari backend (mis. AI_REPORT, TOWING).
const PAYMENT_LABELS: Record<string, string> = {
  AI_REPORT: 'Pembelian Hasil Checkup',
  TOWING: 'Pembayaran Towing',
  INSURANCE: 'Pembelian Asuransi',
};
const paymentLabel = (type: string): string =>
  PAYMENT_LABELS[type] ?? (type ? type.charAt(0) + type.slice(1).toLowerCase() : 'Pembayaran');

const byNewest = <T extends { createdAt: string }>(a: T, b: T): number =>
  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

const ADVANTAGES = [
  {
    title: 'Siapa yang bisa beli AutoClaim?',
    content:
      'AutoClaim dapat dibeli oleh siapa saja yang memiliki kendaraan bermotor dan ingin proses klaim yang cepat dan transparan.',
  },
  {
    title: 'Kapan proteksi aktif?',
    content:
      'Proteksi AutoClaim aktif setelah pembayaran berhasil dan polis diterbitkan sesuai ketentuan yang berlaku.',
  },
  {
    title: 'Apakah saya perlu medical check-up?',
    content:
      'Tidak. AutoClaim tidak memerlukan medical check-up sehingga proses pembelian menjadi lebih mudah.',
  },
  {
    title: 'Transparan & Cepat',
    content:
      'Seluruh proses klaim dilakukan secara transparan dan cepat melalui sistem digital AutoClaim.',
  },
];

const SUPPORT = [
  { image: '/assets/home/whatsapp.png', title: 'WhatsApp', desc: 'Respon Cepat' },
  { image: '/assets/home/chat.png', title: 'Chat', desc: 'Respon Cepat' },
  { icon: Mail, title: 'Email', desc: '24/7' },
  { image: '/assets/home/phone.png', title: 'Telepon', desc: 'Respon Cepat' },
] as const;

const PROMO_SLIDES = [
  {
    id: 'promo-1',
    image: '/assets/home/car_promo2.png',
    alt: 'Promo AutoClaim 1',
  },
  {
    id: 'promo-2',
    image: '/assets/home/car_promo2.png',
    alt: 'Promo AutoClaim 2',
  },
  {
    id: 'promo-3',
    image: '/assets/home/car_promo2.png',
    alt: 'Promo AutoClaim 3',
  },
] as const;

const PROMO_AUTOPLAY_MS = 4500;
const PROMO_SWIPE_THRESHOLD = 40;

const formatDate = (date: string) => {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return date || '-';
  return parsed.toLocaleDateString('id-ID');
};
const formatTime = (date: string) =>
  new Date(date).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
const formatCurrency = (value: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
  }).format(value);

function renderServiceLabel(label: (typeof SERVICE_MENU)[number]['label']) {
  if (label === 'Cek Kondisi Kendaraan') {
    return (
      <>
        Cek Kondisi
        <br />
        Kendaraan
      </>
    );
  }

  if (label === 'Hasil Checkup') {
    return (
      <>
        Hasil
        <br />
        Checkup
      </>
    );
  }

  return (
    <>
      Cari
      <br />
      Bengkel
    </>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeAdvantage, setActiveAdvantage] = useState<number | null>(null);
  const [activePromo, setActivePromo] = useState(0);
  const [activePolicy, setActivePolicy] = useState(0);
  const promoDragStartRef = useRef<number | null>(null);
  const policyDragStartRef = useRef<number | null>(null);

  const vehiclesQuery = useQuery({
    queryKey: ['vehicles'],
    queryFn: getVehicles,
    enabled: isAuthenticated,
    staleTime: 60_000,
  });
  const policyVehicles = (vehiclesQuery.data ?? []).filter(hasPolis);

  const activitiesQuery = useQuery({
    queryKey: ['home-activities'],
    queryFn: () => getActivities(),
    enabled: isAuthenticated,
    staleTime: 30_000,
  });
  const paymentsQuery = useQuery({
    queryKey: ['home-payments'],
    queryFn: () => getPaymentHistory(),
    enabled: isAuthenticated,
    staleTime: 30_000,
  });
  const recentActivities = [...(activitiesQuery.data ?? [])]
    .sort(byNewest)
    .slice(0, HOME_LIST_LIMIT);
  const recentPayments = [...(paymentsQuery.data ?? [])].sort(byNewest).slice(0, HOME_LIST_LIMIT);

  useEffect(() => {
    if (PROMO_SLIDES.length < 2) return;

    const interval = window.setInterval(() => {
      setActivePromo((current) => (current + 1) % PROMO_SLIDES.length);
    }, PROMO_AUTOPLAY_MS);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (activePolicy >= policyVehicles.length) setActivePolicy(0);
  }, [activePolicy, policyVehicles.length]);

  const showPromo = (index: number) => {
    setActivePromo((index + PROMO_SLIDES.length) % PROMO_SLIDES.length);
  };

  const showPolicy = (index: number) => {
    if (policyVehicles.length === 0) return;
    setActivePolicy((index + policyVehicles.length) % policyVehicles.length);
  };

  const prepareStandardScan = () => {
    useScanStore.getState().reset();
    useScanStore.getState().setScanPurpose('standard');
    useDamageStore.getState().reset();
  };

  const handlePromoDragStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    promoDragStartRef.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePromoDragEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (promoDragStartRef.current === null) return;

    const deltaX = event.clientX - promoDragStartRef.current;
    promoDragStartRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (Math.abs(deltaX) < PROMO_SWIPE_THRESHOLD) return;
    showPromo(activePromo + (deltaX > 0 ? -1 : 1));
  };

  const handlePromoDragCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    promoDragStartRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handlePolicyDragStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    policyDragStartRef.current = event.clientX;
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePolicyDragEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (policyDragStartRef.current === null) return;

    const deltaX = event.clientX - policyDragStartRef.current;
    policyDragStartRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    if (Math.abs(deltaX) < PROMO_SWIPE_THRESHOLD) return;
    showPolicy(activePolicy + (deltaX > 0 ? -1 : 1));
  };

  const handlePolicyDragCancel = (event: ReactPointerEvent<HTMLDivElement>) => {
    policyDragStartRef.current = null;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  return (
    <div className="relative w-full bg-gray-50 pb-20">
      <div className="bg-deep-blue-500 absolute top-0 z-0 flex h-[248px] w-full justify-center">
        <img src="/assets/home/bg-header.png" alt="" className="mt-14 w-full object-fill" />
      </div>

      <div className="relative z-10 flex w-full flex-col pt-7">
        <Link to={ROUTES.home} className="mx-auto mb-[30px]">
          <Logo className="brightness-0 invert [&_img]:h-9" />
        </Link>

        {!isAuthenticated ? (
          <div className="flex w-full flex-row justify-between px-4">
            <div className="flex w-full flex-col gap-y-0.5">
              <p className="text-[16px] font-semibold text-[#F0F1F2] max-[424px]:text-[14px] max-[320px]:text-[12px]">
                Hai, Selamat Datang
              </p>
              <p className="text-[12px] font-medium text-[#F0F1F2] max-[424px]:text-[10px]">
                Auto Claim Indonesia
              </p>
            </div>
            <Link
              to={buildPath.loginWithRedirect(ROUTES.home)}
              className="flex w-full items-center justify-end"
            >
              <span className="text-deep-blue-500 flex items-center justify-center rounded-[6px] bg-[#FAFBFC] px-10 py-2 text-[12px] font-semibold">
                Masuk
              </span>
            </Link>
          </div>
        ) : (
          <>
            <div className="mx-4 flex items-center gap-4">
              <div className="size-13 overflow-hidden rounded-full bg-white p-1">
                <img
                  src="/assets/home/avatar.png"
                  alt=""
                  className="rounded-full bg-neutral-200 object-cover"
                />
              </div>
              <div className="flex min-w-0 flex-col text-neutral-50">
                <p className="truncate text-[14px] font-semibold">
                  Halo, {user?.fullname ?? 'Pengguna'}
                </p>
                <p className="text-xs">Auto Claim Indonesia</p>
              </div>
            </div>

            <div className="mt-6 px-4">
              <div className="overflow-hidden rounded-xl">
                {vehiclesQuery.isLoading ? (
                  <PolicyCardSkeleton />
                ) : policyVehicles.length > 0 ? (
                  <div
                    className="flex touch-pan-y transition-transform duration-500 ease-out"
                    style={{ transform: `translateX(-${activePolicy * 100}%)` }}
                    onPointerDown={handlePolicyDragStart}
                    onPointerUp={handlePolicyDragEnd}
                    onPointerCancel={handlePolicyDragCancel}
                  >
                    {policyVehicles.map((vehicle) => (
                      <PolicyVehicleCard key={vehicle.vehiclePlate} vehicle={vehicle} />
                    ))}
                  </div>
                ) : (
                  <PolicyEmptyCard onOpenVehicles={() => navigate(ROUTES.myVehicles)} />
                )}
              </div>
              {policyVehicles.length > 1 && (
                <div className="mt-3 flex justify-center gap-2">
                  {policyVehicles.map((vehicle, index) => (
                    <button
                      key={vehicle.vehiclePlate}
                      type="button"
                      className={cn(
                        'border-deep-blue-200 size-2 rounded-full border transition-colors',
                        activePolicy === index && 'bg-deep-blue-200',
                      )}
                      aria-label={`Lihat polis ${index + 1}`}
                      aria-current={activePolicy === index ? 'true' : undefined}
                      onClick={() => showPolicy(index)}
                    />
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <section className="mt-6 rounded-t-2xl bg-white p-4">
          <div className="grid grid-cols-4 items-start gap-3">
            {SERVICE_MENU.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                onClick={item.to === ROUTES.checkCondition ? prepareStandardScan : undefined}
                className="flex flex-col items-center gap-2"
              >
                <div className="flex size-12 items-center justify-center">
                  <img src={item.image} alt="" className="size-12 object-contain" />
                </div>
                <p className="text-center text-[10px] leading-tight text-[#4B5563]">
                  {renderServiceLabel(item.label)}
                </p>
              </Link>
            ))}
            <button
              type="button"
              className="flex flex-col items-center gap-2"
              onClick={() => (isAuthenticated ? setSheetOpen(true) : navigate(ROUTES.emergency))}
            >
              <div className="flex size-12 items-center justify-center">
                <img
                  src={isAuthenticated ? '/assets/home/More.svg' : '/assets/home/emergency2.svg'}
                  alt=""
                  className="size-12 object-contain"
                />
              </div>
              <p className="text-center text-[10px] leading-tight text-[#4B5563]">
                Bantuan <br />
                Darurat
              </p>
            </button>
          </div>
        </section>

        {isAuthenticated && (
          <>
            <HomeSection
              title="Aktifitas Terkini"
              action="Lihat semua"
              onAction={() => navigate(ROUTES.recentActivity, { state: { tab: 'activity' } })}
              className="mt-5"
            >
              {activitiesQuery.isLoading ? (
                <HomeListSkeleton />
              ) : recentActivities.length === 0 ? (
                <HomeEmpty text="Belum ada aktifitas" />
              ) : (
                <div className="flex flex-col gap-y-4">
                  {recentActivities.map((item, index) => (
                    <div
                      key={item.ticket || item.createdAt}
                      className={cn(
                        'relative flex flex-col items-start rounded-xl p-4',
                        index === 0 && 'bg-[#F2F4FB]/50',
                      )}
                    >
                      {index === 0 && (
                        <div className="absolute top-2 right-2 size-2 rounded-full bg-[#FF314A]" />
                      )}
                      <div className="flex w-full flex-col gap-y-3">
                        <h3 className="text-xs font-semibold text-[#4B5563]">{item.title}</h3>
                        <p className="text-xs text-gray-600">&quot;{item.description}&quot;</p>
                        <div className="flex items-center justify-between text-xs text-gray-400">
                          <p>{formatDate(item.createdAt)}</p>
                          <p>{formatTime(item.createdAt)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </HomeSection>

            <HomeSection
              title="Riwayat Pembayaran"
              action="Lihat semua"
              onAction={() => navigate(ROUTES.recentActivity, { state: { tab: 'payment' } })}
              className="mt-6"
            >
              {paymentsQuery.isLoading ? (
                <HomeListSkeleton />
              ) : recentPayments.length === 0 ? (
                <HomeEmpty text="Belum ada pembayaran" />
              ) : (
                <div className="space-y-3">
                  {recentPayments.map((item) => {
                    const amount = item.amount > 0 ? -item.amount : item.amount;
                    return (
                      <div
                        key={item.id}
                        className="flex flex-row items-center justify-center gap-3"
                      >
                        <div className="flex size-8 items-center justify-center rounded-full bg-[#FFEBEA] text-[#FF3B30]">
                          <WalletCards className="size-4" />
                        </div>
                        <div className="flex-1">
                          <p className="text-[12px] font-semibold text-[#323B4A]">
                            {paymentLabel(item.title)}
                          </p>
                          <div className="mt-2 flex items-center gap-2 text-xs text-gray-400">
                            <p>{formatDate(item.createdAt)}</p>
                            <p>{formatTime(item.createdAt)}</p>
                          </div>
                        </div>
                        <p className="text-[12px] font-semibold text-[#FF3B30]">
                          {formatCurrency(amount)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </HomeSection>
          </>
        )}

        <div className="overflow-x-hidden bg-white">
          <div className="mx-4 mt-6 mb-5 overflow-hidden rounded-[12px]">
            <div
              className="flex touch-pan-y transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${activePromo * 100}%)` }}
              onPointerDown={handlePromoDragStart}
              onPointerUp={handlePromoDragEnd}
              onPointerCancel={handlePromoDragCancel}
            >
              {PROMO_SLIDES.map((slide) => (
                <img
                  key={slide.id}
                  src={slide.image}
                  className="h-auto w-full shrink-0 rounded-[12px] object-cover"
                  alt={slide.alt}
                  draggable={false}
                />
              ))}
            </div>
          </div>
          <div className="ml-[18px] flex flex-row gap-x-[14px]">
            {PROMO_SLIDES.map((slide, index) => (
              <button
                key={slide.id}
                type="button"
                className={cn(
                  'border-deep-blue-300 size-2.5 rounded-full border transition-colors',
                  activePromo === index && 'bg-deep-blue-300',
                )}
                aria-label={`Lihat promo ${index + 1}`}
                aria-current={activePromo === index ? 'true' : undefined}
                onClick={() => showPromo(index)}
              />
            ))}
          </div>
        </div>

        <section className="mt-8 mb-6 bg-white px-4 py-4">
          <h2 className="mb-4 text-[14px] text-neutral-900">Kenapa Harus AutoClaim?</h2>
          <div className="grid grid-cols-3 gap-4">
            <WhyItem color="from-[#3977FF] to-[#224899]" text="Bandingkan dengan Mudah" />
            <WhyItem color="from-[#6EE031] to-[#66B13E]" text="Informasi Transparan" />
            <WhyItem color="from-[#F5982E] to-[#DE8F35]" text="Pembelian Online & Praktis" />
          </div>
        </section>

        <section className="mb-5 px-4">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-[15px] font-semibold text-neutral-800">Keunggulan Auto Claim</h2>
          </div>
          <div className="space-y-3">
            {ADVANTAGES.map((item, index) => (
              <div key={item.title} className="rounded-xl border border-[#EAECEF] bg-white">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-3"
                  onClick={() => setActiveAdvantage(activeAdvantage === index ? null : index)}
                >
                  <p className="text-left text-[12px] text-[#6B7280]">{item.title}</p>
                  <ChevronDown
                    className={cn(
                      'size-5 text-[#D0D2D6] transition-transform duration-300',
                      activeAdvantage === index && 'rotate-180',
                    )}
                  />
                </button>
                {activeAdvantage === index && (
                  <div className="px-4 pb-3">
                    <p className="text-[10px] leading-relaxed text-gray-500">{item.content}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="flex w-full flex-col gap-y-2 px-4">
          <p className="text-[14px] font-medium text-[#EE793D]">
            Bagaimana Menggunakan Auto Claim?
          </p>
          <div className="flex w-full flex-col gap-y-1">
            <p className="text-[16px] font-semibold text-[#374151]">
              3 Langkah Mudah Akses AutoClaim
            </p>
            <p className="text-[12px] font-normal text-[#6F81B4]">
              Gak perlu ribet, aktifin proteksi hanya dalam 3 langkah mudah!
            </p>
          </div>
        </section>
        <div className="mt-6 mb-5 flex items-center justify-center">
          <img src="/assets/home/howtoU.webp" alt="" />
        </div>

        <section className="bg-white p-4">
          <h2 className="mb-4 text-[14px] font-medium text-[#374151]">
            Butuh bantuan? Hubungi CS kami sekarang
          </h2>
          <div className="grid grid-cols-4 gap-3 divide-x divide-dashed divide-neutral-500 py-2">
            {SUPPORT.map((item) => (
              <div key={item.title} className="w-full text-center">
                <div className="mx-auto mb-2 flex size-10 items-center justify-center rounded-full">
                  {'image' in item ? (
                    <img src={item.image} alt={item.title} className="size-8" />
                  ) : (
                    <item.icon className="size-8 text-orange-600" />
                  )}
                </div>
                <p className="text-[10px] font-semibold text-[#374151]">{item.title}</p>
                <p className="text-[10px] font-normal text-[#FF725E]">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>
      </div>

      {sheetOpen && <EmergencySheet onClose={() => setSheetOpen(false)} />}
    </div>
  );
}

function PolicyVehicleCard({ vehicle }: { vehicle: SavedVehicle }) {
  return (
    <div className="relative h-[166px] w-full shrink-0 overflow-hidden rounded-xl bg-white shadow-[inset_3px_3px_4.1px_rgba(0,0,0,0.15)]">
      <img src="/assets/home/car.webp" alt="" className="absolute top-0 right-0 h-auto w-[266px]" />
      <img src="/assets/home/bg-carousel.png" alt="" className="h-full w-full" />
      <div className="absolute top-4 left-4 flex max-w-[62%] flex-col gap-4">
        <PolicyInfo label="No. Polis" value={vehicle.polisNumber} />
        <PolicyInfo label="Jenis Kendaraan" value={vehicle.vehicleName || vehicle.vehicleType} />
        <PolicyInfo label="Masa Berlaku" value={formatDate(vehicle.polisEnd)} />
      </div>
    </div>
  );
}

function PolicyEmptyCard({ onOpenVehicles }: { onOpenVehicles: () => void }) {
  return (
    <div className="relative h-[166px] w-full overflow-hidden rounded-xl bg-white shadow-[inset_3px_3px_4.1px_rgba(0,0,0,0.15)]">
      <img
        src="/assets/home/car.webp"
        alt=""
        className="absolute top-0 right-0 h-auto w-[266px] opacity-80"
      />
      <img src="/assets/home/bg-carousel.png" alt="" className="h-full w-full" />
      <div className="absolute top-4 left-4 flex max-w-[62%] flex-col gap-3">
        <PolicyInfo label="No. Polis" value="-" />
        <PolicyInfo label="Jenis Kendaraan" value="-" />
        <button
          type="button"
          onClick={onOpenVehicles}
          className="text-deep-blue-500 mt-1 w-fit rounded-lg bg-white/85 px-3 py-2 text-[11px] font-semibold shadow-sm"
        >
          Tambah Kendaraan
        </button>
      </div>
    </div>
  );
}

function PolicyCardSkeleton() {
  return (
    <div className="h-[166px] w-full animate-pulse rounded-xl bg-white/80 shadow-[inset_3px_3px_4.1px_rgba(0,0,0,0.10)]">
      <div className="flex h-full flex-col gap-4 p-4">
        <div className="h-3 w-20 rounded bg-neutral-200" />
        <div className="h-4 w-32 rounded bg-neutral-200" />
        <div className="mt-1 h-3 w-24 rounded bg-neutral-200" />
      </div>
    </div>
  );
}

function PolicyInfo({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col">
      <p className="text-[10px]">{label}</p>
      <p className="truncate text-xs text-neutral-800">{value}</p>
    </div>
  );
}

function HomeSection({
  title,
  action,
  onAction,
  className,
  children,
}: {
  title: string;
  action?: string;
  onAction?: () => void;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section className={cn('bg-white px-4', className)}>
      <div className="mb-4 flex items-center justify-between pt-4">
        <h2 className="text-[15px] font-semibold text-neutral-800">{title}</h2>
        {action && (
          <button type="button" onClick={onAction} className="cursor-pointer text-xs text-blue-600">
            {action}
          </button>
        )}
      </div>
      {children}
    </section>
  );
}

function HomeListSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2].map((item) => (
        <div key={item} className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-3.5 w-40 rounded" />
            <Skeleton className="h-3 w-24 rounded" />
          </div>
          <Skeleton className="h-3.5 w-16 rounded" />
        </div>
      ))}
    </div>
  );
}

function HomeEmpty({ text }: { text: string }) {
  return <p className="py-6 text-center text-xs text-gray-400">{text}</p>;
}

function WhyItem({ color, text }: { color: string; text: string }) {
  return (
    <div className="rounded-xl bg-white p-0 text-center">
      <div
        className={cn(
          'mx-auto mb-3 flex size-10 items-center justify-center rounded-full bg-linear-to-bl',
          color,
        )}
      >
        <img src={LogoOnly} alt="" srcSet="" />
      </div>
      <p className="text-[10px] text-gray-600">{text}</p>
    </div>
  );
}

function EmergencySheet({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const dragRef = useRef<{ y: number; height: number } | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const closeTimerRef = useRef<number | null>(null);
  const [sheetHeight, setSheetHeight] = useState(SHEET_INITIAL_HEIGHT);
  const [isDragging, setIsDragging] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const previousBodyOverflow = document.body.style.overflow;
    const previousHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    animationFrameRef.current = window.requestAnimationFrame(() => setIsVisible(true));

    return () => {
      if (animationFrameRef.current !== null) {
        window.cancelAnimationFrame(animationFrameRef.current);
      }
      if (closeTimerRef.current !== null) {
        window.clearTimeout(closeTimerRef.current);
      }
      document.body.style.overflow = previousBodyOverflow;
      document.documentElement.style.overflow = previousHtmlOverflow;
    };
  }, []);

  const closeSheet = (afterClose?: () => void) => {
    if (closeTimerRef.current !== null) return;
    setIsVisible(false);
    closeTimerRef.current = window.setTimeout(() => {
      onClose();
      afterClose?.();
    }, SHEET_ANIMATION_MS);
  };

  const go = (to: string) => {
    closeSheet(() => navigate(to));
  };

  const goStandardScan = () => {
    closeSheet(() => {
      useScanStore.getState().reset();
      useScanStore.getState().setScanPurpose('standard');
      useDamageStore.getState().reset();
      navigate(ROUTES.checkCondition);
    });
  };

  const goEmergencyInsurance = () => {
    closeSheet(() => {
      useScanStore.getState().reset();
      useScanStore.getState().setScanPurpose('emergency_insurance');
      useDamageStore.getState().reset();
      navigate(ROUTES.checkCondition);
    });
  };

  const callPhone = () => {
    closeSheet(() => {
      window.location.href = 'tel:112';
    });
  };

  const handleDragStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragRef.current = { y: event.clientY, height: sheetHeight };
    setIsDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handleDragMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    const viewportHeight = window.innerHeight || 1;
    const deltaVh = ((dragRef.current.y - event.clientY) / viewportHeight) * 100;
    const nextHeight = Math.min(
      SHEET_MAX_HEIGHT,
      Math.max(SHEET_MIN_HEIGHT, dragRef.current.height + deltaVh),
    );
    setSheetHeight(nextHeight);
  };

  const handleDragEnd = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!dragRef.current) return;
    dragRef.current = null;
    setIsDragging(false);
    event.currentTarget.releasePointerCapture(event.pointerId);

    if (sheetHeight < 32) {
      closeSheet();
      return;
    }

    setSheetHeight(sheetHeight > 70 ? SHEET_MAX_HEIGHT : SHEET_INITIAL_HEIGHT);
  };

  return (
    <>
      <button
        type="button"
        aria-label="Tutup menu"
        className="fixed inset-0 z-[9998] bg-black/30"
        style={{
          opacity: isVisible ? 1 : 0,
          transition: `opacity ${SHEET_ANIMATION_MS}ms ease-out`,
        }}
        onClick={() => closeSheet()}
      />
      <div
        className="fixed bottom-0 left-1/2 z-[9999] flex w-full max-w-md flex-col rounded-t-[24px] bg-white shadow-[0_-4px_20px_rgba(0,0,0,0.26)]"
        style={{
          height: `${sheetHeight}dvh`,
          transform: `translate3d(-50%, ${isVisible ? '0' : '100%'}, 0)`,
          transition: isDragging
            ? 'none'
            : `height 180ms ease-out, transform ${SHEET_ANIMATION_MS}ms cubic-bezier(0.22, 1, 0.36, 1)`,
          willChange: 'height, transform',
        }}
      >
        <div
          className="flex shrink-0 touch-none flex-col items-center pt-3"
          onPointerDown={handleDragStart}
          onPointerMove={handleDragMove}
          onPointerUp={handleDragEnd}
          onPointerCancel={handleDragEnd}
        >
          <div className="h-1 w-12 rounded-full bg-gray-300" />
        </div>
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-[26px] py-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
          <SheetGroup title="Deteksi">
            <SheetItem
              image="/assets/home/ajukan_klaim.svg"
              label={
                <>
                  Cek Kondisi
                  <br />
                  Kendaraan
                </>
              }
              align="center"
              onClick={goStandardScan}
            />
            <SheetItem
              image="/assets/home/lihat_klaim.svg"
              label={
                <>
                  Hasil
                  <br />
                  Checkup
                </>
              }
              onClick={() => go(ROUTES.recentActivity)}
            />
            <SheetItem
              image="/assets/home/cari_bengkel.svg"
              label={
                <>
                  Cari
                  <br />
                  Bengkel
                </>
              }
              align="center"
              onClick={() => go(ROUTES.workshopList)}
            />
          </SheetGroup>

          <SheetGroup title="Layanan Asuransi">
            <SheetItem
              image="/assets/home/ajukan_klaim.svg"
              label="Asuransi"
              align="center"
              onClick={() => go(ROUTES.insuranceSearch)}
            />
            <SheetItem
              image="/assets/home/lihat_klaim.svg"
              label="Klaim"
              onClick={() => go(ROUTES.claims)}
            />
          </SheetGroup>

          <SheetGroup title="AutoClaim">
            <SheetItem
              image="/assets/home/logo-only.svg"
              label={
                <>
                  Rating
                  <br />
                  AutoClaim
                </>
              }
              align="center"
              onClick={() => go(ROUTES.rating)}
            />
          </SheetGroup>

          <SheetGroup title="Bantuan Darurat">
            <SheetItem
              image="/assets/checkup_vehicle/hospital.png"
              label={
                <>
                  Rumah
                  <br />
                  Sakit
                </>
              }
              align="center"
              onClick={() => go(ROUTES.emergencyHospitals)}
            />
            <SheetItem
              image="/assets/checkup_vehicle/derek.png"
              label="Towing"
              onClick={() => go(ROUTES.emergencyTowing)}
            />
            <SheetItem
              image="/assets/home/ajukan_klaim.svg"
              label="Asuransi"
              align="center"
              onClick={goEmergencyInsurance}
            />
          </SheetGroup>

          <SheetGroup title="Kontak" compact>
            <SheetItem
              image="/assets/home/chat.png"
              label="Chat"
              align="center"
              onClick={() => closeSheet()}
            />
            <SheetItem image="/assets/home/phone.png" label="Telepon" onClick={callPhone} />
            <SheetItem
              image="/assets/home/whatsapp.png"
              label="WhatsApp"
              align="center"
              onClick={() => closeSheet()}
            />
          </SheetGroup>
        </div>
      </div>
    </>
  );
}

function SheetGroup({
  title,
  compact = false,
  children,
}: {
  title: string;
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <div className={cn(compact ? 'mb-0' : 'mb-4 last:mb-0')}>
      <h3 className="mb-4 text-[16px] leading-none font-semibold text-gray-900">{title}</h3>
      <div className="grid grid-cols-3 items-center justify-between gap-x-4">{children}</div>
    </div>
  );
}

function SheetItem({
  image,
  label,
  align = 'center',
  onClick,
}: {
  image?: string;
  label: ReactNode;
  align?: 'start' | 'center' | 'end';
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        'flex min-h-[96px] w-full cursor-pointer flex-col rounded-xl py-1',
        align === 'start' && 'items-start',
        align === 'center' && 'items-center',
        align === 'end' && 'items-end',
      )}
      onClick={onClick}
    >
      <div className="flex size-[52px] items-center justify-center rounded-xl bg-[#EFF2FB]">
        {image ? <img src={image} alt="" className="size-9 object-contain" /> : null}
      </div>
      <p className="mt-2 h-8 max-w-[82px] text-center text-[12px] leading-[1.25] text-[#1F2937]">
        {label}
      </p>
    </button>
  );
}
