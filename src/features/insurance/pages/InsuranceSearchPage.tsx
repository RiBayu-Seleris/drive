import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, Info, Search, ShieldCheck, SlidersHorizontal } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { AppHeader } from '@/components/layout/AppHeader';
import { LoadingState } from '@/components/ui/Spinner';
import { ErrorState, EmptyState } from '@/components/feedback/StateViews';
import { cn } from '@/lib/utils/cn';
import { formatCurrency } from '@/lib/utils/format';
import { ROUTES } from '@/app/routes';
import { type InsuranceProduct } from '../api';
import { useInsuranceProducts } from '../useInsuranceProducts';
import { coverageLabel, providerInitials } from '../productUi';

const SORTS = [
  { value: 'recommended', label: 'Rekomendasi' },
  { value: 'cheapest', label: 'Premi terendah' },
  { value: 'coverage', label: 'Limit klaim tertinggi' },
] as const;

type SortValue = (typeof SORTS)[number]['value'];

const ALL_COVERAGE = 'ALL';

/** Maksimal manfaat yang ditampilkan di kartu ringkas; selebihnya di halaman detail. */
const CARD_BENEFIT_LIMIT = 3;

export function InsuranceSearchPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const requiresDamageFreeScan = Boolean(
    (location.state as { requiresDamageFreeScan?: boolean } | null)?.requiresDamageFreeScan,
  );
  const { data, isLoading, isError, refetch } = useInsuranceProducts();

  const [keyword, setKeyword] = useState('');
  const [coverage, setCoverage] = useState<string>(ALL_COVERAGE);
  const [sort, setSort] = useState<SortValue>('recommended');
  const [sortOpen, setSortOpen] = useState(false);

  // Chip filter mengikuti jenis pertanggungan yang benar-benar tersedia,
  // bukan daftar statis, agar tidak ada chip yang selalu kosong.
  const coverageOptions = useMemo(() => {
    const labels = new Set<string>();
    (data ?? []).forEach((product) => labels.add(coverageLabel(product)));
    return [...labels].sort((a, b) => a.localeCompare(b, 'id'));
  }, [data]);

  const visibleProducts = useMemo(() => {
    const query = keyword.trim().toLowerCase();
    const filtered = (data ?? []).filter((product) => {
      if (coverage !== ALL_COVERAGE && coverageLabel(product) !== coverage) return false;
      if (!query) return true;
      return [product.name, product.provider, product.description, ...product.benefits].some(
        (field) => field.toLowerCase().includes(query),
      );
    });

    if (sort === 'cheapest') {
      return [...filtered].sort((a, b) => a.monthlyPremium - b.monthlyPremium);
    }
    if (sort === 'coverage') {
      return [...filtered].sort((a, b) => b.claimLimit - a.claimLimit);
    }
    return filtered;
  }, [data, keyword, coverage, sort]);

  const openDetail = (product: InsuranceProduct) =>
    navigate(ROUTES.insuranceDetail, { state: { product, requiresDamageFreeScan } });

  return (
    <PageContainer className="bg-neutral-200">
      <AppHeader showLogo />

      <section className="bg-neutral-100 px-4 pt-5 pb-6">
        <h1 className="text-20 leading-tight font-bold tracking-tight text-[#c2f347]">
          Rekomendasi Asuransi untuk Anda
        </h1>
        <p className="text-14 mt-2 leading-relaxed text-[#eef4f8]">
          Pilih perlindungan terbaik yang sesuai dengan kondisi kendaraan Anda.
        </p>

        <div className="relative mt-5 flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-neutral-700" />
            <input
              type="search"
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Cari asuransi atau fitur..."
              aria-label="Cari produk asuransi"
              className="focus:border-deep-blue-500 focus:ring-deep-blue-200 text-14 h-12 w-full rounded-xl border border-neutral-400 bg-[#131c24] pr-4 pl-11 text-neutral-900 transition placeholder:font-light placeholder:text-neutral-700 focus:ring-2 focus:outline-none"
            />
          </div>
          <button
            type="button"
            onClick={() => setSortOpen((open) => !open)}
            aria-label="Urutkan produk"
            aria-expanded={sortOpen}
            className="bg-deep-blue-500 hover:bg-deep-blue-600 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl text-[#10200a] transition"
          >
            <SlidersHorizontal className="size-5" />
          </button>

          {sortOpen && (
            <>
              {/* Penutup transparan agar klik di luar menutup menu urutan. */}
              <button
                type="button"
                aria-label="Tutup menu urutan"
                onClick={() => setSortOpen(false)}
                className="fixed inset-0 z-20 cursor-default"
              />
              <div className="drive-card absolute top-full right-0 z-30 mt-2 w-56 rounded-xl border border-neutral-300 p-1.5 shadow-lg">
                {SORTS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => {
                      setSort(option.value);
                      setSortOpen(false);
                    }}
                    className={cn(
                      'text-13 flex w-full items-center justify-between rounded-lg px-3 py-2.5 text-left transition',
                      sort === option.value
                        ? 'bg-deep-blue-50 text-deep-blue-600 font-semibold'
                        : 'text-neutral-800 hover:bg-neutral-200',
                    )}
                  >
                    {option.label}
                    {sort === option.value && <CheckCircle2 className="size-4" />}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </section>

      <div className="flex flex-1 flex-col px-4 pt-4 pb-8">
        {coverageOptions.length > 1 && (
          <div className="mb-4 flex flex-wrap gap-2.5">
            <CoverageChip
              label="Semua Rekomendasi"
              active={coverage === ALL_COVERAGE}
              onClick={() => setCoverage(ALL_COVERAGE)}
            />
            {coverageOptions.map((label) => (
              <CoverageChip
                key={label}
                label={label}
                active={coverage === label}
                onClick={() => setCoverage(label)}
              />
            ))}
          </div>
        )}

        {isLoading ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : visibleProducts.length === 0 ? (
          <EmptyState
            icon={<ShieldCheck className="size-7" />}
            title={data && data.length > 0 ? 'Tidak ada yang cocok' : 'Belum ada produk'}
            description={
              data && data.length > 0
                ? 'Ubah kata kunci atau filter jenis perlindungan.'
                : 'Produk asuransi belum tersedia saat ini.'
            }
          />
        ) : (
          <div className="flex flex-col gap-4">
            {visibleProducts.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                onSelect={() => openDetail(product)}
              />
            ))}
          </div>
        )}

        <div className="mt-6 flex items-center gap-3.5 rounded-xl bg-[#16240a]/30 px-4 py-4">
          <Info className="size-7 shrink-0 text-[#c2f347]" />
          <div>
            <p className="text-14 font-semibold text-[#eef4f8]">Butuh Bantuan Memilih?</p>
            <p className="text-12 mt-0.5 leading-relaxed text-[#eef4f8]">
              Konsultasikan gratis dengan agen kami untuk paket yang paling sesuai.
            </p>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}

function CoverageChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'text-13 h-8 shrink-0 rounded-full px-4 font-medium transition',
        active ? 'bg-deep-blue-500 text-[#10200a]' : 'bg-[#0f1720] text-[#eef4f8] hover:bg-neutral-400',
      )}
    >
      {label}
    </button>
  );
}

function ProductCard({ product, onSelect }: { product: InsuranceProduct; onSelect: () => void }) {
  const benefits = product.benefits.slice(0, CARD_BENEFIT_LIMIT);

  return (
    <button
      type="button"
      onClick={onSelect}
      className="drive-card w-full rounded-xl p-4 text-left shadow-[0_2px_12px_rgb(32_41_68_/_0.06)] transition hover:shadow-[0_4px_18px_rgb(32_41_68_/_0.1)]"
    >
      <div className="flex items-start gap-3">
        <div className="text-deep-blue-600 flex h-11 w-[62px] shrink-0 items-center justify-center rounded-lg bg-[#131c24] text-sm font-bold">
          {providerInitials(product.provider)}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-14 leading-snug font-semibold text-[#eef4f8]">{product.name}</h2>
            <span className="text-11 shrink-0 rounded-xl bg-[#aded1f]/20 px-2.5 py-1 font-semibold text-[#c2f347]">
              {coverageLabel(product)}
            </span>
          </div>
          <p className="text-12 mt-0.5 text-[#eef4f8]">{product.provider}</p>
        </div>
      </div>

      {benefits.length > 0 && (
        <ul className="mt-3.5 flex flex-col gap-2 pl-[74px]">
          {benefits.map((benefit) => (
            <li key={benefit} className="text-12 flex items-start gap-2.5 text-[#eef4f8]">
              <CheckCircle2 className="mt-px size-4 shrink-0 text-[#c2f347]" />
              <span className="min-w-0 flex-1">{benefit}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3.5 flex items-end justify-between gap-3 border-t border-neutral-400 pt-3.5">
        <div>
          <p className="text-12 text-[#eef4f8]">Mulai dari</p>
          <p className="text-16 font-bold text-[#c2f347]">
            {formatCurrency(product.monthlyPremium)}
            <span className="text-12 ml-1 font-normal text-[#eef4f8]">/bln</span>
          </p>
        </div>
        <span className="bg-deep-blue-500 text-13 flex h-8 items-center rounded-lg px-5 font-semibold text-[#10200a]">
          Pilih
        </span>
      </div>
    </button>
  );
}
