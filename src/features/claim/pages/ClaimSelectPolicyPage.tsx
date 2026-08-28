import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Camera, CheckCircle2, ShieldCheck, Zap } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LoadingState } from '@/components/ui/Spinner';
import { ErrorState, EmptyState } from '@/components/feedback/StateViews';
import { formatCurrency } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { ROUTES } from '@/app/routes';
import { getInsurancePolicies, type InsurancePolicy } from '@/features/insurance/api';
import { useDamageStore } from '@/features/damage/store/damageStore';
import { useAuthStore } from '@/features/auth/store/authStore';
import { STORAGE_KEYS } from '@/config/constants';
import { storage } from '@/lib/storage/storage';
import { useScanStore } from '@/features/vehicle-scan/store/scanStore';
import { useClaimDraftStore } from '../store/claimDraftStore';

const HERO_IMAGE = '/assets/home/car.png';
const SOON_EXPIRE_DAYS = 30;

const normalizePlate = (value: string | null | undefined) =>
  (value ?? '').replace(/[^a-z0-9]/gi, '').toUpperCase();

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function formatPlate(value: string | null | undefined): string {
  const plate = (value ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
  return plate || '-';
}

function parsePolicyDate(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function daysUntil(date: Date | null): number | null {
  if (!date) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return Math.ceil((end.getTime() - today.getTime()) / 86_400_000);
}

function formatShortDate(value: string | undefined): string {
  const date = parsePolicyDate(value);
  if (!date) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

type PolicyViewState = 'active' | 'soon' | 'scheduled' | 'expired' | 'inactive';

/**
 * Polis sudah dibayar tapi masa tunggu produknya belum lewat.
 *
 * Status diperiksa DAN tanggalnya juga: status bisa tertinggal SCHEDULED sampai
 * worker di gateway menaikkannya, dan sebaliknya status ACTIVE tanpa cek tanggal
 * pernah membuat polis terbaca siap diklaim sejak menit pembayaran.
 *
 * Polis PENDING sengaja tidak masuk sini walau tanggal mulainya di depan —
 * preminya memang belum dibayar, jadi tempatnya di 'inactive'.
 */
function isWaitingToStart(policy: InsurancePolicy): boolean {
  const status = policy.status.toUpperCase();
  if (status === 'SCHEDULED') return true;
  if (status !== 'ACTIVE') return false;
  const startsAt = parsePolicyDate(policy.startedAt);
  return startsAt !== null && startsAt.getTime() > Date.now();
}

function policyViewState(policy: InsurancePolicy): PolicyViewState {
  if (isWaitingToStart(policy)) return 'scheduled';
  if (policy.status.toUpperCase() !== 'ACTIVE') return 'inactive';
  const remainingDays = daysUntil(parsePolicyDate(policy.endedAt));
  if (remainingDays !== null && remainingDays < 0) return 'expired';
  if (remainingDays !== null && remainingDays <= SOON_EXPIRE_DAYS) return 'soon';
  return 'active';
}

function policyRank(policy: InsurancePolicy): number {
  switch (policyViewState(policy)) {
    case 'soon':
      return 0;
    case 'active':
      return 1;
    case 'scheduled':
      return 2;
    case 'expired':
      return 3;
    case 'inactive':
      return 4;
  }
}

function coverageLabel(policy: InsurancePolicy): string {
  const raw = `${policy.coverageType} ${policy.productName}`.toLowerCase();
  if (raw.includes('comprehensive') || raw.includes('komprehensif') || raw.includes('all risk')) {
    return 'Komprehensif';
  }
  if (raw.includes('tlo')) return 'TLO';
  return policy.coverageType || '-';
}

function vehicleTitle(vehicleInfo: { brandModel: string }, policies: InsurancePolicy[]): string {
  if (vehicleInfo.brandModel.trim()) return vehicleInfo.brandModel.trim();
  const policy = policies.find((item) => item.vehicleBrand || item.vehicleModel);
  const fromPolicy = [policy?.vehicleBrand, policy?.vehicleModel].filter(Boolean).join(' ');
  return fromPolicy || 'Kendaraan Anda';
}

function providerName(policy: InsurancePolicy): string {
  return policy.provider || policy.productName.split(' ')[0] || 'Asuransi';
}

export function ClaimSelectPolicyPage() {
  const navigate = useNavigate();
  const setPolicy = useClaimDraftStore((state) => state.setPolicy);
  const setPolicyOwnedByOther = useClaimDraftStore((state) => state.setPolicyOwnedByOther);
  const vehiclePlate = useScanStore((state) => state.plate.number);
  const vehicleInfo = useScanStore((state) => state.vehicleInfo);
  const damageResult = useDamageStore((state) => state.result);
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['insurance-policies'],
    queryFn: getInsurancePolicies,
  });

  const matchingPolicies = useMemo(
    () =>
      (data ?? [])
        .filter(
          (policy) =>
            !vehiclePlate || normalizePlate(policy.vehiclePlate) === normalizePlate(vehiclePlate),
        )
        .sort((a, b) => policyRank(a) - policyRank(b)),
    [data, vehiclePlate],
  );
  /*
   * Dua angka, dua arti — dan selama ini cuma yang kedua dipakai.
   *
   * `data`             = seluruh polis milik akun ini
   * `matchingPolicies` = yang plat nomornya cocok dengan mobil yang dipindai
   *
   * Keduanya bisa kosong karena sebab yang sangat berbeda. User yang punya
   * tiga polis lalu memindai mobil keempat sebelumnya dibilang "Belum ada
   * polis" — pernyataan tentang AKUN, padahal masalahnya ada pada MOBIL.
   * Reaksi wajarnya mengira polisnya hilang.
   */
  const hasAnyPolicy = (data ?? []).length > 0;
  const displayPlate = formatPlate(vehiclePlate || matchingPolicies[0]?.vehiclePlate);
  const damagePercent = clampPercent(damageResult?.repair.percentage ?? 0);
  const hasScanResult = Boolean(damageResult);
  /*
   * Hasil pemindaian bisa ada di DUA tempat, dan tombolnya harus tahu keduanya.
   *
   * Hasil lengkapnya cuma disimpan di memori — hilang begitu halaman dimuat
   * ulang. Yang bertahan hanyalah nomor tiketnya di penyimpanan browser, dan
   * itu pun hanya berguna bagi user yang sudah masuk: halaman hasil bisa
   * mengambil ulang datanya dari server memakai tiket itu.
   *
   * Tanpa memperhitungkannya, user yang me-refresh halaman akan melihat
   * "Mulai AI Scan" padahal hasilnya masih bisa dipulihkan — dan menekannya
   * justru MENGHAPUS tiket itu, sehingga hasil yang tadinya bisa diselamatkan
   * benar-benar hilang.
   */
  const recoverableTicket = useAuthStore((state) => state.isAuthenticated)
    ? storage.getString(STORAGE_KEYS.guestInferenceTicket)
    : '';
  const scanAvailable = hasScanResult || Boolean(recoverableTicket);

  return (
    <PageContainer>
      <AppHeader showLogo className="h-[86px] shadow-[0_8px_24px_rgb(32_41_68_/_0.08)]" />

      <div className="flex flex-1 flex-col px-5 pt-5 pb-8">
        <section className="relative h-[184px] overflow-hidden rounded-lg bg-[#aded1f] shadow-[0_14px_28px_rgb(32_41_68_/_0.12)]">
          <div className="absolute inset-0 bg-[linear-gradient(135deg,#eef2f7_0%,#8795a8_44%,#263143_100%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.04),rgba(0,0,0,0.64))]" />
          <img
            src={HERO_IMAGE}
            alt=""
            className="absolute right-[-76px] bottom-[-8px] h-[150px] max-w-none object-contain opacity-95"
          />

          {/*
            Dulu tombol ini selalu menuju halaman HASIL, padahal namanya
            "AI Scan" yang terbaca sebagai "mulai pindai". Halaman hasil bersifat
            buntu: tanpa hasil tersimpan ia melempar user ke Beranda dengan toast
            "Hasil analisis tidak tersedia" — jadi tombol yang menjanjikan
            memindai justru mengeluarkan user dari alur klaim.

            Sekarang tujuannya mengikuti keadaan: ada hasil → lihat hasilnya,
            belum ada → mulai pindai. Namanya pun ikut menyesuaikan supaya
            janjinya sama dengan yang terjadi.
          */}
          <button
            type="button"
            className="absolute top-4 right-4 inline-flex h-11 items-center gap-2 rounded-full bg-[#dfa73a] px-5 text-sm font-semibold text-white shadow-[0_10px_24px_rgb(246_163_0_/_0.28)]"
            onClick={() => {
              if (scanAvailable) {
                navigate(ROUTES.damageAnalysis);
                return;
              }
              useScanStore.getState().reset();
              useScanStore.getState().setScanPurpose('standard');
              useDamageStore.getState().reset();
              navigate(ROUTES.checkCondition);
            }}
          >
            <Camera className="size-4" />
            {scanAvailable ? 'Lihat Hasil AI' : 'Mulai AI Scan'}
          </button>

          <div className="absolute right-5 bottom-5 left-5 flex items-end justify-between gap-4">
            <div className="min-w-0">
              <h2 className="truncate text-[22px] leading-tight font-semibold text-white">
                {vehicleTitle(vehicleInfo, matchingPolicies)}
              </h2>
              <span className="mt-2 inline-flex h-9 max-w-full items-center rounded-full border border-white/20 bg-black/35 px-4 text-[13px] font-semibold tracking-[0.08em] text-white shadow-[inset_0_1px_0_rgb(255_255_255_/_0.24)] backdrop-blur-sm">
                {displayPlate}
              </span>
            </div>
            <button
              type="button"
              className="mb-2 shrink-0 text-sm font-medium text-white/92"
              onClick={() => document.getElementById('claim-policy-list')?.scrollIntoView()}
            >
              Lihat Polis &gt;
            </button>
          </div>
        </section>

        <section id="claim-policy-list" className="mt-7">
          <h1 className="text-[22px] leading-none font-semibold text-neutral-900">Polis Aktif</h1>
          <p className="mt-3 text-[15px] leading-relaxed text-neutral-600">
            Daftar paket perlindungan yang dimiliki
          </p>

          <AiScanSummary damagePercent={damagePercent} hasResult={hasScanResult} />

          {isLoading ? (
            <div className="mt-5">
              <LoadingState />
            </div>
          ) : isError ? (
            <div className="mt-5">
              <ErrorState onRetry={() => void refetch()} />
            </div>
          ) : matchingPolicies.length === 0 ? (
            <div className="mt-5">
              <EmptyState
                icon={<ShieldCheck className="size-7" />}
                title={hasAnyPolicy ? 'Mobil ini belum diasuransikan' : 'Belum ada polis'}
                description={
                  hasAnyPolicy
                    ? 'Polis Anda yang lain tidak terdaftar untuk plat ini. Klaim hanya bisa diajukan lewat polis mobil yang bersangkutan.'
                    : 'Anda belum punya polis sama sekali. Beli dulu supaya bisa mengajukan klaim.'
                }
                action={
                  <Button fullWidth={false} onClick={() => navigate(ROUTES.insuranceSearch)}>
                    Beli Asuransi
                  </Button>
                }
              />

              {/*
                Jalan keluar untuk mobil yang sudah berpindah tangan: polisnya
                masih atas nama pemilik lama, tapi yang mengajukan pemilik baru.
                Backend menerima klaim tanpa nomor polis — bukan ditolak,
                melainkan dilempar ke telaah manual (POLICY_REQUIRED). Sebelum
                ini alurnya buntu: satu-satunya tombol adalah "Beli Asuransi".

                Kalimatnya sengaja menyebut syarat DAN konsekuensinya, supaya
                tidak jadi pintu belakang yang dicoba sembarang orang lalu
                membanjiri antrean telaah.
              */}
              <Card className="mt-5 space-y-2">
                <p className="text-13 font-semibold text-neutral-900">
                  Mobil ini polisnya atas nama orang lain?
                </p>
                <p className="text-12 leading-relaxed text-neutral-600">
                  Ajukan klaim dengan melampirkan dokumen pemilik polis. Klaim akan ditinjau
                  petugas, tidak diproses otomatis.
                </p>
                <Button
                  variant="outline"
                  className="mt-1"
                  onClick={() => {
                    setPolicyOwnedByOther(true);
                    navigate(ROUTES.claimDocuments);
                  }}
                >
                  Ajukan Tanpa Polis Saya
                </Button>
              </Card>
            </div>
          ) : (
            <div className="mt-5 flex flex-col gap-5">
              {matchingPolicies.map((policy) => (
                <PolicyCard
                  key={policy.id}
                  policy={policy}
                  onClaim={() => {
                    setPolicy(policy);
                    navigate(ROUTES.claimDocuments);
                  }}
                  onBuyAgain={() => navigate(ROUTES.insuranceSearch)}
                />
              ))}
            </div>
          )}
        </section>
      </div>
    </PageContainer>
  );
}

function AiScanSummary({
  damagePercent,
  hasResult,
}: {
  damagePercent: number;
  hasResult: boolean;
}) {
  return (
    <div className="mt-5 rounded-lg border border-neutral-300 bg-neutral-100 px-5 py-4 shadow-[0_12px_24px_rgb(32_41_68_/_0.06)]">
      <div className="flex items-center justify-between gap-3">
        <div className="text-deep-blue-500 flex items-center gap-2">
          <Zap className="size-5" />
          <p className="text-[16px] font-semibold">AI Scan Results</p>
        </div>
        <div
          className={cn(
            'flex items-center gap-2 text-[12px] font-semibold',
            hasResult ? 'text-[#6ae7b5]' : 'text-neutral-600',
          )}
        >
          <span
            className={cn('size-2.5 rounded-full', hasResult ? 'bg-[#3adf9d]' : 'bg-neutral-500')}
          />
          {hasResult ? 'SELESAI' : 'BELUM ADA'}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-4">
        <p className="text-[15px] text-neutral-600">AI Damage Score</p>
        <p className="text-[18px] font-semibold text-neutral-900">{damagePercent}%</p>
      </div>
      <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-neutral-300">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,#ffb000_0%,#ff8a29_52%,#ff5a67_100%)]"
          style={{ width: `${damagePercent}%` }}
        />
      </div>
    </div>
  );
}

function PolicyCard({
  policy,
  onClaim,
  onBuyAgain,
}: {
  policy: InsurancePolicy;
  onClaim: () => void;
  onBuyAgain: () => void;
}) {
  const state = policyViewState(policy);
  const claimable = state === 'active' || state === 'soon';
  const scheduled = state === 'scheduled';
  const provider = providerName(policy);
  const badge = policyBadge(state);

  return (
    <article
      className={cn(
        'rounded-lg border bg-neutral-100 px-5 py-6 shadow-[0_16px_28px_rgb(32_41_68_/_0.07)]',
        claimable ? 'border-transparent' : 'border-neutral-300 bg-neutral-200/45 shadow-none',
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <ProviderMark label={provider} muted={!claimable} />
        <span className={badge.className}>{badge.label}</span>
      </div>

      <div className="mt-7">
        <h2
          className={cn(
            'text-[18px] leading-tight font-semibold',
            claimable ? 'text-deep-blue-500' : 'text-neutral-800',
          )}
        >
          {policy.productName || 'Paket Asuransi'}
        </h2>
        <p className="mt-2 text-[14px] text-neutral-600">No. Polis: {policy.policyNumber || '-'}</p>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-x-5 gap-y-6 border-b border-neutral-300 pb-5">
        <div>
          <dt className="text-[13px] text-neutral-500">
            {scheduled ? 'Mulai Berlaku' : 'Tanggal Berakhir'}
          </dt>
          <dd className="mt-1 text-[15px] font-semibold text-neutral-900">
            {formatShortDate(scheduled ? policy.startedAt : policy.endedAt)}
          </dd>
        </div>
        <div>
          <dt className="text-[13px] text-neutral-500">Cakupan</dt>
          <dd className="mt-1 text-[15px] font-semibold text-neutral-900">
            {coverageLabel(policy)}
          </dd>
        </div>
      </dl>

      <div className="mt-5 flex items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[13px] text-neutral-500">Jumlah Klaim</p>
          <p
            className={cn(
              'mt-1 text-[19px] font-semibold',
              claimable ? 'text-deep-blue-500' : 'text-neutral-800',
            )}
          >
            {formatCurrency(policy.coverageAmount)}
          </p>
        </div>
        {scheduled ? (
          /*
           * Tombolnya dimatikan, bukan diganti "Beli Lagi": preminya sudah
           * dibayar, jadi menawarkan pembelian ulang membuat pemegang polis
           * mengira pembeliannya gagal. Yang belum hanya tanggalnya.
           */
          <div className="shrink-0 text-right">
            <Button
              fullWidth={false}
              disabled
              className="h-12 min-w-[112px] rounded-full px-7 text-[15px]"
            >
              Klaim
            </Button>
            <p className="mt-2 text-[12px] text-neutral-600">
              Bisa diklaim mulai {formatShortDate(policy.startedAt)}
            </p>
          </div>
        ) : (
          <Button
            fullWidth={false}
            className="h-12 min-w-[112px] rounded-full px-7 text-[15px] shadow-[0_10px_22px_rgb(75_97_161_/_0.28)]"
            onClick={claimable ? onClaim : onBuyAgain}
          >
            {claimable ? 'Klaim' : 'Beli Lagi'}
          </Button>
        )}
      </div>
    </article>
  );
}

function policyBadge(state: PolicyViewState): { label: string; className: string } {
  const base = 'inline-flex h-9 shrink-0 items-center rounded-full px-4 text-[11px] font-semibold';
  switch (state) {
    case 'soon':
      return { label: 'SEGERA BERAKHIR', className: cn(base, 'bg-[#131c24] text-[#e7bd6a]') };
    case 'active':
      return { label: 'AKTIF', className: cn(base, 'bg-[#131c24] text-[#6ae7a6]') };
    case 'scheduled':
      return { label: 'BELUM MULAI', className: cn(base, 'bg-[#131c24] text-[#c2f347]') };
    case 'expired':
      return { label: 'PROTEKSI BERAKHIR', className: cn(base, 'bg-neutral-400 text-neutral-800') };
    case 'inactive':
      return { label: 'BELUM AKTIF', className: cn(base, 'bg-neutral-400 text-neutral-800') };
  }
}

function ProviderMark({ label, muted }: { label: string; muted: boolean }) {
  return (
    <div
      className={cn(
        'inline-flex h-11 min-w-[86px] items-center gap-1.5 bg-neutral-100 px-0 text-[16px] font-bold',
        muted ? 'text-neutral-800 opacity-80' : 'text-[#c2f347]',
      )}
    >
      <span className="truncate">{label}</span>
      <CheckCircle2 className="size-5 shrink-0" />
    </div>
  );
}
