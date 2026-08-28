import { useNavigate } from 'react-router-dom';
import { Hospital, PhoneCall, Siren, Truck, type LucideIcon } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { Logo } from '@/components/brand/Logo';
import { ROUTES } from '@/app/routes';
import { cn } from '@/lib/utils/cn';

/**
 * Ikon tiap layanan kini vektor, bukan stiker PNG.
 *
 * call.png / hospital.png / derek.png adalah klipart penuh warna (ungu, biru,
 * kuning) yang tidak punya hubungan dengan palet mana pun, dan `emergency_bg.png`
 * adalah ilustrasi berlatar PUTIH — di tema gelap ia jadi bidang menyilaukan
 * setinggi separuh layar. Semuanya dibuang.
 *
 * Warna dipakai untuk MEMBEDAKAN tingkat urgensi, bukan sekadar hiasan:
 * merah hanya untuk panggilan darurat 112, sisanya hijau merek.
 */
type Option = {
  icon: LucideIcon;
  title: string;
  desc: string;
  tone: 'danger' | 'brand';
} & ({ href: string } | { to: string });

const PRIMARY: Option = {
  icon: PhoneCall,
  title: 'Telepon 112',
  desc: 'Polisi dan medis, tersambung langsung',
  tone: 'danger',
  href: 'tel:112',
};

const SECONDARY: Option[] = [
  {
    icon: Hospital,
    title: 'Rumah sakit terdekat',
    desc: 'Kami tunjukkan yang paling dekat, sekalian arahnya',
    tone: 'brand',
    to: ROUTES.emergencyHospitals,
  },
  {
    icon: Truck,
    title: 'Panggil derek',
    desc: 'Mitra resmi, bukan derek sembarangan',
    tone: 'brand',
    to: ROUTES.emergencyTowing,
  },
];

function OptionCard({ item, wide = false }: { item: Option; wide?: boolean }) {
  const Icon = item.icon;
  const danger = item.tone === 'danger';
  const navigate = useNavigate();

  const content = (
    <div
      className={cn(
        'relative flex h-full p-4 text-left',
        // Kurung bidik hanya pada kartu lebar. Di kartu sempit ia jatuh tepat
        // di atas ikon, karena keduanya sama-sama mulai dari sudut kiri atas.
        wide && 'hud-frame',
        wide ? 'items-center gap-4' : 'flex-col gap-3',
        danger ? 'drive-card border-danger/45' : 'drive-card-accent',
      )}
    >
      <span
        className={cn(
          'flex size-11 shrink-0 items-center justify-center rounded-xl',
          danger ? 'drive-chip-danger' : 'drive-chip',
        )}
      >
        <Icon className={cn('size-6', danger ? 'text-danger' : 'text-deep-blue-500')} aria-hidden />
      </span>
      <span className="min-w-0">
        <span
          className={cn(
            'block text-[13px] font-semibold',
            danger ? 'text-danger' : 'text-deep-blue-600',
          )}
        >
          {item.title}
        </span>
        <span className="mt-0.5 block text-[11px] leading-relaxed text-neutral-600">
          {item.desc}
        </span>
      </span>
    </div>
  );

  if ('href' in item) {
    return (
      <a href={item.href} className="block">
        {content}
      </a>
    );
  }
  return (
    <button type="button" onClick={() => navigate(item.to)} className="block h-full text-left">
      {content}
    </button>
  );
}

export function EmergencyPage() {
  const navigate = useNavigate();

  return (
    <PageContainer>
      <div className="min-h-dvh bg-neutral-200 px-gutter pt-8 pb-10">
        <button type="button" onClick={() => navigate(ROUTES.home)} className="block w-full">
          <Logo className="mx-auto [&_img]:h-[30px]" />
        </button>

        {/* Penanda darurat: lingkaran berpendar, bukan ilustrasi berlatar putih. */}
        <div className="mt-9 flex justify-center">
          <span className="border-danger/35 bg-danger/10 relative flex size-28 items-center justify-center rounded-full border">
            <span className="bg-danger/12 absolute inset-3 rounded-full" />
            <Siren className="text-danger relative size-12" aria-hidden />
          </span>
        </div>

        <h1 className="drive-title mt-7 text-center text-[25px] text-neutral-900">
          Butuh bantuan sekarang?
        </h1>
        <p className="mt-2 text-center text-[13px] leading-relaxed text-neutral-600">
          Tenang dulu. Pilih yang Anda perlukan di bawah ini.
        </p>

        <div className="mt-8 flex flex-col gap-3">
          <OptionCard item={PRIMARY} wide />
          <div className="grid grid-cols-2 gap-3">
            {SECONDARY.map((item) => (
              <OptionCard key={item.title} item={item} />
            ))}
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
