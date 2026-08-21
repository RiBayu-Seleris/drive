import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AppHeader } from '@/components/layout/AppHeader';
import { PageContainer } from '@/components/layout/PageContainer';
import { EmptyState, ErrorState } from '@/components/feedback/StateViews';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { LoadingState } from '@/components/ui/Spinner';
import { buildPath } from '@/app/routes';
import { getInsurancePolicies, type InsurancePolicy } from '../api';

/*
 * Status polis dibaca berurutan dari yang paling menentukan: status polis dulu
 * (SCHEDULED/ACTIVE/REJECTED/EXPIRED bersifat final), baru underwriting, baru
 * pembayaran.
 * Tanpa cabang REJECTED yang eksplisit, polis ditolak jatuh ke cabang terakhir
 * dan tampil sebagai "Menunggu pembayaran" — padahal ia tidak bisa dibayar.
 */
type PolicyTone = 'neutral' | 'blue' | 'green' | 'yellow' | 'red';

function policyTone(policy: InsurancePolicy): PolicyTone {
  if (policy.status === 'SCHEDULED') return 'blue';
  if (policy.status === 'ACTIVE') return 'green';
  if (policy.status === 'REJECTED') return 'red';
  if (policy.status === 'EXPIRED' || policy.status === 'CANCELLED') return 'neutral';
  if (policy.underwritingStatus === 'SURVEY_REQUIRED') return 'yellow';
  if (policy.paymentStatus === 'PAID') return 'blue';
  return 'yellow';
}

function policyLabel(policy: InsurancePolicy): string {
  // Polis sah dan preminya sudah dibayar; yang belum hanya tanggal mulainya.
  if (policy.status === 'SCHEDULED') return 'Menunggu tanggal aktif';
  if (policy.status === 'ACTIVE') return 'Aktif';
  if (policy.status === 'REJECTED') return 'Ditolak';
  if (policy.status === 'EXPIRED') return 'Berakhir';
  if (policy.status === 'CANCELLED') return 'Dibatalkan';
  if (policy.underwritingStatus === 'SURVEY_REQUIRED') return 'Menunggu survei';
  if (policy.paymentStatus === 'PAID') return 'Sedang diproses';
  return 'Menunggu pembayaran';
}

export function InsurancePoliciesPage() {
  const navigate = useNavigate();
  const query = useQuery({ queryKey: ['insurance-policies'], queryFn: getInsurancePolicies });

  return (
    <PageContainer>
      <AppHeader title="Polis Saya" />
      <div className="flex flex-1 flex-col gap-3 px-5 py-5">
        {query.isLoading && <LoadingState label="Memuat polis…" />}
        {query.isError && <ErrorState title="Polis tidak dapat dimuat" />}
        {query.data?.length === 0 && (
          <EmptyState
            title="Belum ada polis"
            description="Polis yang Anda ajukan akan muncul di sini."
          />
        )}
        {query.data?.map((policy) => (
          <button
            key={policy.policyNumber}
            type="button"
            onClick={() => navigate(buildPath.insurancePolicyDetail(policy.policyNumber))}
            className="text-left"
          >
            <Card className="space-y-2 transition active:bg-neutral-50">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-14 font-semibold text-neutral-900">{policy.productName}</p>
                  <p className="text-12 text-neutral-600">{policy.provider}</p>
                </div>
                <Badge tone={policyTone(policy)}>{policyLabel(policy)}</Badge>
              </div>
              <div className="text-12 flex justify-between text-neutral-700">
                <span>{policy.vehiclePlate}</span>
                <span>{policy.policyNumber}</span>
              </div>
            </Card>
          </button>
        ))}
      </div>
    </PageContainer>
  );
}
