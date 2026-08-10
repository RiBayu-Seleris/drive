import { useLocation, useNavigate } from 'react-router-dom';
import { CheckCircle2, Info, Wrench } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ROUTES } from '@/app/routes';
import { useDamageStore } from '@/features/damage/store/damageStore';
import type { Claim } from '../api';
import { useClaimDraftStore } from '../store/claimDraftStore';

const rupiah = (amount: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);

const parseAmount = (value: string) => Number(value.replace(/[^0-9]/g, '')) || 0;

export function ClaimApprovedPage() {
  const navigate = useNavigate();
  const locationClaim = useLocation().state as Claim | null;
  const storedClaim = useClaimDraftStore((state) => state.submittedClaim);
  const policy = useClaimDraftStore((state) => state.policy);
  const damage = useDamageStore((state) => state.result);
  const claim = locationClaim ?? storedClaim;
  const total = parseAmount(damage?.estimation.totalPrice ?? '0');
  const settlement = claim?.settlementPass;
  const customerPays = settlement
    ? settlement.customerPayable
    : Math.max(0, total - (policy?.coverageAmount ?? total));
  const insurancePays = settlement?.repairCovered
    ? Math.max(0, total - customerPays)
    : Math.min(total, policy?.coverageAmount ?? total);

  return (
    <PageContainer>
      <AppHeader showLogo />
      <div className="flex flex-1 flex-col gap-5 px-5 py-5">
        <div className="text-center">
          <CheckCircle2 className="text-success mx-auto size-12" />
          <h1 className="text-20 mt-3 font-semibold text-neutral-900">Klaim Disetujui</h1>
          <p className="text-13 mt-2 text-neutral-700">
            {claim?.claimNumber} · Pembayaran asuransi dilakukan langsung ke bengkel.
          </p>
        </div>

        {damage?.estimation.items.map((item, index) => (
          <Card key={`${item.part_name}-${index}`} className="flex items-center gap-3">
            {item.damage_image && (
              <img src={item.damage_image} alt="" className="size-14 rounded-md object-cover" />
            )}
            <div className="min-w-0 flex-1">
              <p className="text-14 font-semibold text-neutral-900">{item.part_name}</p>
              <p className="text-12 text-neutral-600">
                {item.change_severity === 'replaced' ? 'Wajib diganti' : 'Bisa diperbaiki'}
              </p>
            </div>
            <strong className="text-12 text-neutral-900">{item.price_estimation}</strong>
          </Card>
        ))}

        <section className="overflow-hidden rounded-lg border border-neutral-300">
          <div className="bg-success px-4 py-3 font-semibold text-white">Rincian Pembayaran</div>
          <div className="space-y-3 p-4 text-sm">
            <Row label="Total estimasi" value={rupiah(total)} />
            <Row label="Ditanggung asuransi" value={rupiah(insurancePays)} />
            <div className="border-t border-dashed border-neutral-300 pt-3">
              <Row label="Sisa pelanggan" value={rupiah(customerPays)} strong />
            </div>
          </div>
        </section>

        <div className="flex items-start gap-2 text-xs text-neutral-700">
          <Info className="text-warning mt-0.5 size-4 shrink-0" />
          Estimasi dapat berubah setelah pemeriksaan langsung di bengkel.
        </div>

        <div className="mt-auto pt-4">
          <Button
            size="lg"
            leftIcon={<Wrench className="size-5" />}
            onClick={() =>
              navigate(ROUTES.estimatedCost, {
                state: {
                  claimNumber: claim?.claimNumber,
                  fromApprovedClaim: true,
                  inferenceTicket: claim?.inferenceTicket,
                  customerPayable: claim?.settlementPass.customerPayable,
                },
              })
            }
          >
            Lihat Estimasi Biaya
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}

function Row({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className={strong ? 'font-semibold text-neutral-900' : 'text-neutral-700'}>
        {label}
      </span>
      <span
        className={strong ? 'text-success text-lg font-bold' : 'font-semibold text-neutral-900'}
      >
        {value}
      </span>
    </div>
  );
}
