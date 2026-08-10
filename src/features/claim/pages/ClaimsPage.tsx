import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { FileText, Plus, ChevronRight } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { AppHeader } from '@/components/layout/AppHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, type BadgeProps } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/Spinner';
import { ErrorState, EmptyState } from '@/components/feedback/StateViews';
import { formatDate } from '@/lib/utils/format';
import { ROUTES } from '@/app/routes';
import { getClaims, claimStatusLabel } from '../api';

function statusTone(status: string): BadgeProps['tone'] {
  if (status === 'APPROVED' || status === 'COMPLETED') return 'green';
  if (status === 'REJECTED') return 'red';
  return 'yellow';
}

export function ClaimsPage() {
  const navigate = useNavigate();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['claims'],
    queryFn: getClaims,
  });

  return (
    <PageContainer>
      <AppHeader title="Klaim Saya" />
      <div className="flex flex-1 flex-col px-5 py-5">
        {isLoading ? (
          <LoadingState />
        ) : isError ? (
          <ErrorState onRetry={() => void refetch()} />
        ) : !data || data.length === 0 ? (
          <EmptyState
            icon={<FileText className="size-7" />}
            title="Belum ada klaim"
            description="Ajukan klaim asuransi untuk kerusakan kendaraan Anda."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {data.map((claim) => (
              <button
                key={claim.id}
                type="button"
                onClick={() => navigate(ROUTES.claimStatus, { state: claim })}
              >
                <Card className="flex flex-row items-center gap-3">
                  <div className="bg-deep-blue-50 text-deep-blue-500 flex size-10 shrink-0 items-center justify-center rounded-lg">
                    <FileText className="size-5" />
                  </div>
                  <div className="flex h-auto w-full flex-col items-start justify-between gap-y-3">
                    <div className="flex min-w-0 flex-col gap-y-1 text-left">
                      <p className="text-12 truncate font-semibold text-neutral-900">
                        {claim.claimNumber || `Klaim ${claim.vehiclePlate}`}
                      </p>
                      <p className="text-10 text-neutral-700">{claim.claimType}</p>
                      <p className="text-10 text-neutral-600">{formatDate(claim.createdAt)}</p>
                    </div>
                    <Badge
                      tone={statusTone(claim.status)}
                      className="flex items-start justify-start"
                    >
                      <span className="text-10">{claimStatusLabel(claim.status)}</span>
                    </Badge>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-neutral-600" />
                </Card>
              </button>
            ))}
          </div>
        )}

        <div className="mt-auto pt-6">
          <Button
            size="lg"
            leftIcon={<Plus className="size-5" />}
            onClick={() => navigate(ROUTES.claimSelectPolicy)}
          >
            Ajukan Klaim Baru
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
