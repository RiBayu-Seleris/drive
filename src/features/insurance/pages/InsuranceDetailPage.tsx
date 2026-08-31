import { useLocation, useNavigate } from 'react-router-dom';
import { BadgeCheck, Info, ShieldCheck, Zap } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/Button';
import { EmptyState } from '@/components/feedback/StateViews';
import { cn } from '@/lib/utils/cn';
import { formatCurrency } from '@/lib/utils/format';
import { ROUTES } from '@/app/routes';
import type { InsuranceProduct } from '../api';
import { useLiveInsuranceProduct } from '../useInsuranceProducts';
import {
  activationLabel,
  activationNote,
  annualPremiumOf,
  benefitIcon,
  coverageLabel,
  providerInitials,
} from '../productUi';

type InsuranceRouteState =
  | InsuranceProduct
  | { product?: InsuranceProduct; requiresDamageFreeScan?: boolean }
  | null;

function isInsuranceRouteWrapper(
  state: Exclude<InsuranceRouteState, null>,
): state is { product?: InsuranceProduct; requiresDamageFreeScan?: boolean } {
  return 'product' in state || 'requiresDamageFreeScan' in state;
}

function routeProduct(state: InsuranceRouteState): InsuranceProduct | null {
  if (!state) return null;
  if (isInsuranceRouteWrapper(state)) return state.product ?? null;
  return state;
}

function routeRequiresDamageFreeScan(state: InsuranceRouteState): boolean {
  return Boolean(state && 'requiresDamageFreeScan' in state && state.requiresDamageFreeScan);
}

export function InsuranceDetailPage() {
  const navigate = useNavigate();
  const state = useLocation().state as InsuranceRouteState;
  const product = useLiveInsuranceProduct(routeProduct(state));
  const requiresDamageFreeScan = routeRequiresDamageFreeScan(state);

  if (!product) {
    return (
      <PageContainer>
        <AppHeader title="Detail Asuransi" />
        <EmptyState
          title="Produk tidak ditemukan"
          action={
            <Button fullWidth={false} onClick={() => navigate(ROUTES.insuranceSearch)}>
              Lihat Produk
            </Button>
          }
        />
      </PageContainer>
    );
  }

  const facts = [
    { label: 'AKTIVASI', value: activationLabel(product) },
    { label: 'DURASI', value: '1 Tahun' },
    { label: 'PERTANGGUNGAN', value: coverageLabel(product) },
    { label: 'PROSES KLAIM', value: 'Digital' },
  ];

  return (
    <PageContainer className="bg-neutral-200">
      <AppHeader showLogo />

      <header className="bg-gradient-to-br from-[#131c24] to-[#16240a] px-4 pt-5 pb-7">
        <div className="flex items-start justify-between gap-3">
          <span className="text-12 inline-flex items-center gap-1.5 rounded-full bg-[#aded1f] text-on-brand px-3.5 py-2 font-semibold">
            <ShieldCheck className="size-4" />
            {coverageLabel(product)}
          </span>
          <span className="text-deep-blue-600 rounded-lg bg-neutral-100 px-4 py-2.5 text-sm font-bold shadow-sm">
            {providerInitials(product.provider)}
          </span>
        </div>

        <h1 className="mt-4 text-[24px] leading-tight font-bold text-[#c2f347]">{product.name}</h1>
        <p className="text-14 mt-2 flex items-center gap-2 text-[#eef4f8]">
          <BadgeCheck className="size-5 shrink-0 text-[#c2f347]" />
          {product.provider}
        </p>
      </header>

      <div className="flex flex-1 flex-col px-4 pb-8">
        <div className="drive-card mt-4 grid grid-cols-2 rounded-xl shadow-[0_2px_12px_rgb(32_41_68_/_0.06)]">
          {facts.map((fact, index) => (
            <div
              key={fact.label}
              className={cn(
                'px-4 py-3.5',
                index % 2 === 0 && 'border-r border-neutral-400',
                index >= 2 && 'border-t border-neutral-400',
              )}
            >
              <p className="text-10 font-medium tracking-wide text-[#eef4f8]">{fact.label}</p>
              <p className="text-16 mt-1 font-semibold text-[#c2f347]">{fact.value}</p>
            </div>
          ))}
        </div>

        {product.description && (
          <p className="text-13 mt-5 leading-relaxed text-[#eef4f8]">{product.description}</p>
        )}

        {product.benefits.length > 0 && (
          <>
            <div className="mt-6 flex items-baseline justify-between gap-3">
              <h2 className="text-18 font-semibold text-[#eef4f8]">Cakupan Perlindungan</h2>
              {product.policyWordingUrl && (
                <a
                  href={product.policyWordingUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-13 shrink-0 font-medium text-[#c2f347] underline-offset-2 hover:underline"
                >
                  Lihat Polis
                </a>
              )}
            </div>

            <div className="mt-3.5 flex flex-col gap-3">
              {product.benefits.map((benefit) => {
                const Icon = benefitIcon(benefit);
                return (
                  <div
                    key={benefit}
                    className="drive-card flex items-center gap-3.5 rounded-xl p-3.5 shadow-[0_2px_12px_rgb(32_41_68_/_0.05)]"
                  >
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-xl border border-neutral-400 bg-neutral-200">
                      <Icon className="size-6 text-[#e7906a]" />
                    </span>
                    <p className="text-14 leading-snug text-[#eef4f8]">{benefit}</p>
                  </div>
                );
              })}
            </div>
          </>
        )}

        {product.terms.length > 0 && (
          <div className="mt-6 rounded-xl border border-dashed border-neutral-500 bg-[#131c24]/70 p-4">
            <h2 className="text-16 flex items-center gap-2.5 font-semibold text-[#eef4f8]">
              <Info className="size-5 shrink-0 text-[#c2f347]" />
              Syarat &amp; Ketentuan
            </h2>
            <ul className="mt-3.5 flex flex-col gap-3">
              {product.terms.map((term) => (
                <li key={term} className="text-13 flex gap-3 leading-relaxed text-[#eef4f8]">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-[#aded1f]" />
                  <span className="min-w-0 flex-1">{term}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="pb-safe sticky bottom-0 border-t border-neutral-300 bg-neutral-100 px-4">
        <div className="my-5 flex flex-col items-center justify-between gap-1.5">
          <div className="flex h-auto w-full flex-row items-center justify-between gap-3">
            <div className="flex h-auto w-full flex-col items-start justify-center">
              <p className="text-12 text-[#eef4f8]">Premi Tahunan</p>
              <p className="text-20 font-bold text-[#c2f347]">
                {formatCurrency(annualPremiumOf(product))}
              </p>
            </div>
            <div className="flex h-auto w-full items-center justify-end">
              <Button
                fullWidth={false}
                className="h-10 rounded-full px-6"
                onClick={() =>
                  navigate(ROUTES.insurancePurchase, {
                    state: { product, requiresDamageFreeScan },
                  })
                }
              >
                Pilih Paket Ini
              </Button>
            </div>
          </div>
          <div className="flex h-auto w-full items-end justify-end">
            <p className="text-11 flex items-center gap-1 text-right text-[#c2f347]">
              <Zap className="size-3.5 shrink-0" />
              {activationNote(product)}
            </p>
          </div>
        </div>
      </div>
    </PageContainer>
  );
}
