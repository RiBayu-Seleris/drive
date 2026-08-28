import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import type { LucideIcon } from 'lucide-react';

/** Ikon lucide maupun ikon DRIVE sama-sama menerima props SVG. */
type IconComponent = LucideIcon | ((props: { className?: string }) => JSX.Element);
import {
  Camera,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  Cpu,
  FileText,
  Gauge,
  Hospital,
  LayoutGrid,
  LifeBuoy,
  Mail,
  MessageCircle,
  MessagesSquare,
  Phone,
  PhoneCall,
  Receipt,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Star,
  Truck,
  WalletCards,
  Wrench,
  Zap,
} from 'lucide-react';
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

// Ikon garis menggantikan SVG raster lama (mobil biru-oranye merek AutoClaim).
// Ikon vektor ikut warna tema, jadi rebrand berikutnya tidak perlu aset baru.
const SERVICE_MENU = [
  { icon: ScanLine, label: 'Cek Kondisi Kendaraan', to: ROUTES.checkCondition },
  { icon: ClipboardList, label: 'Hasil Checkup', to: ROUTES.recentActivity },
  { icon: Wrench, label: 'Cari Bengkel', to: ROUTES.workshopList },
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

// Isi lama adalah salin-tempel template asuransi JIWA ("perlu medical
// check-up?", "beli DRIVE") — tidak nyambung dengan alat inspeksi kendaraan.
// Diganti pertanyaan yang benar-benar dijawab oleh sistem ini.
const ADVANTAGES = [
  {
    title: 'DRIVE ini sebenarnya apa?',
    content:
      'Kami membaca kondisi mobil Anda dari foto: apa yang rusak, di bagian mana, dan seberapa parah. Hasilnya dipakai untuk mengajukan klaim, atau untuk membeli polis.',
  },
  {
    title: 'Mobil saya perlu disurvei petugas?',
    content:
      'Tidak. Anda sendiri yang memotret, dipandu langkah demi langkah lewat aplikasi. Tidak ada janji temu, tidak ada yang perlu ditunggu.',
  },
  {
    title: 'Kapan asuransinya mulai jalan?',
    content:
      'Begitu premi masuk. Kalau produk yang Anda pilih punya masa tunggu, hitungannya dimulai dari hari pembayaran diterima — bukan dari hari Anda memesan.',
  },
  {
    title: 'Hasil pindaian berlaku berapa lama?',
    content:
      'Hasil menggambarkan kondisi mobil pada saat difoto, jadi ada masa berlakunya. Kalau sudah lewat, potret ulang dulu sebelum polis bisa diterbitkan.',
  },
];

const SUPPORT = [
  { icon: MessageCircle, title: 'WhatsApp', desc: 'Respon Cepat' },
  { icon: MessagesSquare, title: 'Chat', desc: 'Respon Cepat' },
  { icon: Mail, title: 'Email', desc: '24/7' },
  { icon: Phone, title: 'Telepon', desc: 'Respon Cepat' },
] as const;

// Menggantikan carousel promo lama yang ketiga slide-nya memakai berkas gambar
// yang SAMA PERSIS (car_promo2.png x3) dan masih berlogo AutoClaim.
// Isinya kini kemampuan DRIVE seperti di poster rebrand.
const PROMO_SLIDES = [
  {
    id: 'cap-damage',
    icon: Camera,
    title: 'Baret sampai penyok',
    desc: 'Goresan tipis, penyok, retak, kaca pecah — semuanya kami catat.',
  },
  {
    id: 'cap-part',
    icon: Cpu,
    title: 'Bagian mana yang kena',
    desc: 'Bemper, fender, pintu, lampu. Bukan sekadar "ada rusak di depan".',
  },
  {
    id: 'cap-severity',
    icon: Gauge,
    title: 'Seberapa parah',
    desc: 'Ringan, sedang, atau berat. Ukurannya sama untuk semua mobil.',
  },
  {
    id: 'cap-cost',
    icon: Receipt,
    title: 'Kira-kira habis berapa',
    desc: 'Perkiraan biaya per bagian, jauh sebelum Anda sampai bengkel.',
  },
] as const;

const HOW_IT_WORKS = [
  {
    title: 'Potret mobilnya',
    desc: 'Ikuti panduannya, sisi per sisi. Tidak perlu jago memotret.',
  },
  {
    title: 'Kami baca fotonya',
    desc: 'Kerusakan ditandai satu per satu, lengkap dengan tingkat parahnya.',
  },
  {
    title: 'Hasilnya keluar',
    desc: 'Rincian kerusakan, kisaran biaya, dan bengkel yang bisa Anda datangi.',
  },
] as const;

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
  const [activePolicy, setActivePolicy] = useState(0);
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
    if (activePolicy >= policyVehicles.length) setActivePolicy(0);
  }, [activePolicy, policyVehicles.length]);

  const showPolicy = (index: number) => {
    if (policyVehicles.length === 0) return;
    setActivePolicy((index + policyVehicles.length) % policyVehicles.length);
  };

  const prepareStandardScan = () => {
    useScanStore.getState().reset();
    useScanStore.getState().setScanPurpose('standard');
    useDamageStore.getState().reset();
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
    <div className="relative w-full bg-neutral-200 pb-24">
      {/*
        HERO SINEMATIK.
        Sebelumnya kepala halaman cuma strip gelap setinggi 248px berisi teks.
        Sebuah foto dengan peluruhan gradien memberi kedalaman yang tidak bisa
        dicapai warna rata — dan foto ini sudah ada di aset (51 KB), jadi tidak
        menambah beban unduh yang berarti.
      */}
      <header className="relative h-[336px] w-full overflow-hidden">
        <img
          src="/assets/home/home.webp"
          alt=""
          fetchPriority="high"
          className="absolute inset-0 size-full object-cover object-[62%_center]"
        />
        {/* Peluruhan ke bawah: foto melebur ke warna halaman, tanpa garis potong. */}
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,12,17,0.55)_0%,rgba(7,12,17,0.35)_30%,rgba(15,23,32,0.92)_76%,#0f1720_100%)]" />
        {/* Sapuan hijau merek dari kiri atas — sumber cahaya yang sama dengan kartu. */}
        <div className="absolute inset-0 bg-[radial-gradient(100%_68%_at_16%_6%,rgba(173,237,31,0.3),transparent_58%)]" />
        <div className="drive-header drive-fade-b absolute inset-0 opacity-35" />

        <div className="relative flex h-full flex-col px-gutter pt-7">
          <Link to={ROUTES.home} className="mx-auto">
            <Logo className="[&_img]:h-9" />
          </Link>

          {/* Pembacaan status: menegaskan ada mesin yang bekerja di belakang. */}
          <div className="mx-auto mt-3 flex items-center gap-2 rounded-full border border-[#22313c] bg-[#0b1218]/80 px-3 py-1">
            <span className="bg-deep-blue-500 size-1.5 rounded-full shadow-[0_0_8px_2px_rgba(173,237,31,0.6)]" />
            <span className="hud-readout text-deep-blue-500 text-[9.5px] tracking-[0.18em] uppercase">
              Siap memindai
            </span>
          </div>

          <div className="mt-auto pb-[76px]">
            {!isAuthenticated ? (
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <span className="drive-eyebrow">Selamat datang</span>
                  <p className="drive-title mt-2 text-[27px] leading-[1.12] text-neutral-900 max-[380px]:text-[23px]">
                    Foto mobilnya.
                    <br />
                    Sisanya biar kami.
                  </p>
                </div>
                <Link
                  to={buildPath.loginWithRedirect(ROUTES.home)}
                  className="drive-card flex shrink-0 items-center gap-1 px-3.5 py-2 text-[12px] font-semibold text-neutral-900"
                >
                  Masuk
                  <ChevronRight className="text-deep-blue-500 size-4" aria-hidden />
                </Link>
              </div>
            ) : (
              <div className="flex items-center gap-3.5">
                <img
                  src="/assets/home/avatar.png"
                  alt=""
                  className="border-deep-blue-500/45 size-13 shrink-0 rounded-full border-2 bg-neutral-200 object-cover"
                />
                <div className="min-w-0">
                  <span className="drive-eyebrow">Selamat datang kembali</span>
                  <p className="drive-title mt-1 truncate text-[23px] text-neutral-900">
                    {user?.fullname ?? 'Pengguna'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/*
        Kartu aksi utama sengaja MENIMPA tepi bawah foto (-mt). Tumpang tindih
        inilah yang membuat halaman terbaca berlapis; tanpa itu ia kembali jadi
        tumpukan blok yang berhenti dan mulai di garis yang sama.
      */}
      <div className="relative z-20 -mt-[62px] px-gutter">
        <Link
          to={ROUTES.checkCondition}
          onClick={prepareStandardScan}
          className="drive-hero hud-frame relative flex items-center gap-4 overflow-hidden p-5"
        >
          <span className="hud-sweep" aria-hidden />
          <span className="drive-chip-solid relative flex size-14 shrink-0 items-center justify-center rounded-2xl">
            <ScanLine className="size-7 text-[#10200a]" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="drive-eyebrow">Mulai di sini</span>
            <span className="drive-title mt-1 block text-[19px] leading-tight text-neutral-900">
              Periksa Mobil Anda
            </span>
            <span className="mt-1 block text-[11.5px] leading-relaxed text-neutral-600">
              Cukup beberapa foto. Tidak sampai lima menit.
            </span>
          </span>
          <ChevronRight className="text-deep-blue-500 size-6 shrink-0" aria-hidden />
        </Link>
      </div>

      <div className="relative z-10 flex w-full flex-col">
        {isAuthenticated && (
          <div className="mt-5 px-gutter">
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
                      'h-2 rounded-full transition-all',
                      activePolicy === index
                        ? 'bg-deep-blue-500 w-7'
                        : 'w-2 bg-neutral-400',
                    )}
                    aria-label={`Lihat polis ${index + 1}`}
                    aria-current={activePolicy === index ? 'true' : undefined}
                    onClick={() => showPolicy(index)}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        <section className="mt-5 px-gutter pb-7">
          <div className="grid grid-cols-4 items-stretch gap-2">
            {SERVICE_MENU.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                onClick={item.to === ROUTES.checkCondition ? prepareStandardScan : undefined}
                className="drive-card flex flex-col items-center gap-2.5 px-2 py-3.5"
              >
                <span className="drive-chip flex size-10 items-center justify-center rounded-xl">
                  <item.icon className="text-deep-blue-500 size-5" aria-hidden />
                </span>
                <p className="text-center text-[10px] leading-tight font-medium text-neutral-800">
                  {renderServiceLabel(item.label)}
                </p>
              </Link>
            ))}
            {/*
              Ubin ini bercabang, jadi labelnya ikut bercabang.

              Tamu → langsung ke halaman Bantuan Darurat. Label "Bantuan
              Darurat" tepat, dan warna merah memang pantas.

              Sudah masuk → membuka bottom sheet berisi LIMA kelompok dan 12
              item: Deteksi, Layanan Asuransi, DRIVE, Bantuan Darurat, dan
              Kontak. Yang darurat cuma 3 dari 12. Menamainya "Bantuan Darurat"
              membuat user yang mencari "Cari Bengkel" atau "Klaim" tidak akan
              pernah menduga keduanya ada di balik tombol itu — dan warna merah
              justru menahannya menekan, karena terbaca sebagai tombol darurat.
            */}
            <button
              type="button"
              className="drive-card flex flex-col items-center gap-2.5 px-2 py-3.5"
              onClick={() => (isAuthenticated ? setSheetOpen(true) : navigate(ROUTES.emergency))}
              aria-haspopup={isAuthenticated ? 'dialog' : undefined}
            >
              <span
                className={cn(
                  'flex size-10 items-center justify-center rounded-xl',
                  isAuthenticated ? 'drive-chip' : 'drive-chip-danger',
                )}
              >
                {isAuthenticated ? (
                  <LayoutGrid className="text-deep-blue-500 size-5" aria-hidden />
                ) : (
                  <LifeBuoy className="text-danger size-5" aria-hidden />
                )}
              </span>
              <p className="text-center text-[10px] leading-tight font-medium text-neutral-800">
                {isAuthenticated ? (
                  'Lainnya'
                ) : (
                  <>
                    Bantuan <br />
                    Darurat
                  </>
                )}
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
                        index === 0 && 'bg-[#131c24]/50',
                      )}
                    >
                      {index === 0 && (
                        <div className="absolute top-2 right-2 size-2 rounded-full bg-[#df3a4e]" />
                      )}
                      <div className="flex w-full flex-col gap-y-3">
                        <h3 className="text-xs font-semibold text-[#eef4f8]">{item.title}</h3>
                        <p className="text-xs text-neutral-600">&quot;{item.description}&quot;</p>
                        <div className="flex items-center justify-between text-xs text-neutral-500">
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
                        <div className="flex size-8 items-center justify-center rounded-full bg-[#131c24] text-[#e7716a]">
                          <WalletCards className="size-4" />
                        </div>
                        <div className="flex-1">
                          <p className="text-[12px] font-semibold text-[#eef4f8]">
                            {paymentLabel(item.title)}
                          </p>
                          <div className="mt-2 flex items-center gap-2 text-xs text-neutral-500">
                            <p>{formatDate(item.createdAt)}</p>
                            <p>{formatTime(item.createdAt)}</p>
                          </div>
                        </div>
                        <p className="text-[12px] font-semibold text-[#e7716a]">
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

        {/*
          Dulu carousel satu kartu penuh layar dengan titik indikator. Untuk
          empat kartu pendek itu boros ruang dan menyembunyikan tiga di antaranya.
          Baris geser ber-snap menampilkan kartu berikutnya "mengintip", yang
          sekaligus memberi tahu pengguna bahwa masih ada lanjutannya.
        */}
        <section className="bg-neutral-100 pt-7 pb-6">
          <div className="px-gutter">
            <span className="drive-eyebrow">Yang kami lihat</span>
            <h2 className="drive-title mt-1.5 text-[19px] text-neutral-900">
              Tidak ada yang terlewat
            </h2>
          </div>
          <div className="drive-rail mt-4 pb-1">
            {PROMO_SLIDES.map((slide, index) => (
              <article key={slide.id} className="drive-card relative w-[228px] p-4">
                <span className="hud-readout absolute top-3.5 right-4 text-[10px] text-neutral-500">
                  {String(index + 1).padStart(2, '0')}
                </span>
                <span className="drive-chip flex size-11 items-center justify-center rounded-xl">
                  <slide.icon className="text-deep-blue-500 size-5" aria-hidden />
                </span>
                <h3 className="drive-title mt-3 text-[14px] text-neutral-900">{slide.title}</h3>
                <p className="mt-1.5 text-[11.5px] leading-relaxed text-neutral-600">
                  {slide.desc}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mb-6 bg-neutral-100 px-gutter pt-2 pb-4">
          <span className="drive-eyebrow">Kenapa kami</span>
          <h2 className="drive-title mt-1.5 mb-4 text-[19px] text-neutral-900">
            Alasan orang bertahan
          </h2>
          <div className="grid grid-cols-3 gap-3">
            <WhyItem icon={Sparkles} text="Gampang dibandingkan" />
            <WhyItem icon={ShieldCheck} text="Tidak ada yang ditutupi" />
            <WhyItem icon={Zap} text="Beli dari rumah" />
          </div>
        </section>

        <section className="mb-5 px-gutter">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <span className="drive-eyebrow">Sering ditanya</span>
              <h2 className="drive-title mt-1.5 text-[19px] text-neutral-900">
                Barangkali ini juga
              </h2>
            </div>
          </div>
          <div className="space-y-3">
            {ADVANTAGES.map((item, index) => (
              <div key={item.title} className="drive-card">
                <button
                  type="button"
                  className="flex w-full items-center justify-between px-3 py-3"
                  onClick={() => setActiveAdvantage(activeAdvantage === index ? null : index)}
                >
                  <p className="text-left text-[12px] text-[#aebbc4]">{item.title}</p>
                  <ChevronDown
                    className={cn(
                      'size-5 text-[#7c8b96] transition-transform duration-300',
                      activeAdvantage === index && 'rotate-180',
                    )}
                  />
                </button>
                {activeAdvantage === index && (
                  <div className="px-4 pb-3">
                    <p className="text-[10px] leading-relaxed text-neutral-500">{item.content}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        <section className="flex w-full flex-col gap-y-2 px-gutter">
          <span className="drive-eyebrow">Cara kerja</span>
          <div className="mt-1.5 flex w-full flex-col gap-y-1.5">
            <p className="drive-title text-[22px] leading-tight text-neutral-900">
              Tiga langkah, selesai
            </p>
            <p className="text-[12px] leading-relaxed text-neutral-600">
              Tidak ada formulir panjang. Tidak ada antre.
            </p>
          </div>
        </section>
        {/*
          Menggantikan howtoU.webp — gambar raster berlogo AutoClaim yang
          teksnya ikut tercetak di dalamnya, sehingga tidak bisa diterjemahkan,
          tidak terbaca pembaca layar, dan tidak ikut berubah saat rebrand.
        */}
        <ol className="mt-5 mb-6 flex w-full flex-col gap-y-2 px-gutter">
          {HOW_IT_WORKS.map((step, index) => (
            <li key={step.title} className="drive-card flex items-start gap-3.5 p-4">
              <span className="drive-chip-solid hud-readout mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-[12px] font-bold text-[#10200a]">
                {index + 1}
              </span>
              <span className="min-w-0">
                <span className="drive-title block text-[14px] text-neutral-900">{step.title}</span>
                <span className="block text-[11px] leading-relaxed text-neutral-600">
                  {step.desc}
                </span>
              </span>
            </li>
          ))}
        </ol>

        <section className="bg-neutral-100 px-gutter py-4">
          <span className="drive-eyebrow">Bantuan</span>
          <h2 className="drive-title mt-1.5 mb-4 text-[16px] text-neutral-900">
            Ada yang mau ditanya?
          </h2>
          <div className="grid grid-cols-4 gap-2">
            {SUPPORT.map((item) => (
              <div key={item.title} className="drive-card w-full px-1 py-3 text-center">
                <div className="drive-chip mx-auto mb-2 flex size-10 items-center justify-center rounded-xl">
                  <item.icon className="text-deep-blue-500 size-5" aria-hidden />
                </div>
                <p className="text-[10px] font-semibold text-[#eef4f8]">{item.title}</p>
                <p className="text-[10px] font-normal text-neutral-600">{item.desc}</p>
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
    <div className="drive-edge relative h-[166px] w-full shrink-0 overflow-hidden rounded-xl">
      <div className="absolute inset-0 bg-[radial-gradient(130%_110%_at_100%_0%,rgba(173,237,31,0.2),transparent_62%)]" />
      <img
        src="/assets/home/car.webp"
        alt=""
        className="absolute top-0 right-0 h-auto w-[240px] opacity-70"
      />
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
    <div className="drive-edge relative h-[166px] w-full overflow-hidden rounded-xl">
      <div className="absolute inset-0 bg-[radial-gradient(130%_110%_at_100%_0%,rgba(173,237,31,0.14),transparent_62%)]" />
      <img
        src="/assets/home/car.webp"
        alt=""
        className="absolute top-0 right-0 h-auto w-[240px] opacity-40"
      />
      <div className="absolute top-4 left-4 flex max-w-[62%] flex-col gap-3">
        <PolicyInfo label="No. Polis" value="-" />
        <PolicyInfo label="Jenis Kendaraan" value="-" />
        <button
          type="button"
          onClick={onOpenVehicles}
          className="bg-deep-blue-500 mt-1 w-fit rounded-lg px-3 py-2 text-[11px] font-semibold text-[#10200a]"
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
    <section className={cn('bg-neutral-100 px-gutter', className)}>
      <div className="mb-4 flex items-center justify-between pt-4">
        <h2 className="text-[15px] font-semibold text-neutral-800">{title}</h2>
        {action && (
          <button type="button" onClick={onAction} className="cursor-pointer text-xs text-deep-blue-500">
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
  return <p className="py-6 text-center text-xs text-neutral-500">{text}</p>;
}

function WhyItem({ icon: Icon, text }: { icon: IconComponent; text: string }) {
  return (
    <div className="drive-card rounded-xl px-2 py-3.5 text-center">
      <div className="drive-chip mx-auto mb-2.5 flex size-11 items-center justify-center rounded-2xl">
        <Icon className="text-deep-blue-500 size-5" aria-hidden />
      </div>
      <p className="text-[10.5px] leading-snug font-medium text-neutral-700">{text}</p>
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
        className="fixed bottom-0 left-1/2 z-[9999] flex w-full max-w-md flex-col rounded-t-[24px] bg-neutral-100 shadow-[0_-4px_20px_rgba(0,0,0,0.26)]"
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
          <div className="h-1 w-12 rounded-full bg-neutral-300" />
        </div>
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-[26px] py-4 pb-[calc(16px+env(safe-area-inset-bottom))]">
          <SheetGroup title="Deteksi">
            <SheetItem
              icon={ScanLine}
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
              icon={ClipboardList}
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
              icon={Wrench}
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
              icon={ShieldCheck}
              label="Asuransi"
              align="center"
              onClick={() => go(ROUTES.insuranceSearch)}
            />
            <SheetItem
              icon={FileText}
              label="Klaim"
              onClick={() => go(ROUTES.claims)}
            />
          </SheetGroup>

          <SheetGroup title="DRIVE">
            <SheetItem
              icon={Star}
              label={
                <>
                  Rating
                  <br />
                  DRIVE
                </>
              }
              align="center"
              onClick={() => go(ROUTES.rating)}
            />
          </SheetGroup>

          <SheetGroup title="Bantuan Darurat">
            {/* Telepon 112 dulu hanya ada di halaman Bantuan Darurat, yang cuma
                terbuka untuk tamu — user yang sudah login justru kehilangan
                akses ke nomor darurat saat isinya dipindah ke sheet ini. */}
            <SheetItem
              icon={PhoneCall}
              tone="danger"
              label="Hubungi Darurat"
              align="center"
              onClick={() => closeSheet(() => window.location.assign('tel:112'))}
            />
            <SheetItem
              icon={Hospital}
              tone="danger"
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
              icon={Truck}
              tone="danger"
              label="Towing"
              onClick={() => go(ROUTES.emergencyTowing)}
            />
          </SheetGroup>

          <SheetGroup title="Kontak" compact>
            <SheetItem
              icon={MessagesSquare}
              label="Chat"
              align="center"
              onClick={() => closeSheet()}
            />
            <SheetItem icon={Phone} label="Telepon" onClick={callPhone} />
            <SheetItem
              icon={MessageCircle}
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
      <h3 className="mb-4 text-[16px] leading-none font-semibold text-neutral-900">{title}</h3>
      <div className="grid grid-cols-3 items-center justify-between gap-x-4">{children}</div>
    </div>
  );
}

function SheetItem({
  icon: Icon,
  label,
  align = 'center',
  tone = 'brand',
  onClick,
}: {
  icon: IconComponent;
  label: ReactNode;
  align?: 'start' | 'center' | 'end';
  /** `danger` untuk tindakan darurat supaya beda tegas dari menu biasa. */
  tone?: 'brand' | 'danger';
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
      <div className="drive-chip flex size-[52px] items-center justify-center rounded-xl">
        <Icon
          className={cn('size-6', tone === 'danger' ? 'text-danger' : 'text-deep-blue-500')}
          aria-hidden
        />
      </div>
      <p className="mt-2 h-8 max-w-[82px] text-center text-[12px] leading-[1.25] text-[#eef4f8]">
        {label}
      </p>
    </button>
  );
}
