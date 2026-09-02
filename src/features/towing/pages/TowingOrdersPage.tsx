import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, MapPin, Truck } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { AppHeader } from '@/components/layout/AppHeader';
import { Card } from '@/components/ui/Card';
import { Badge, type BadgeProps } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/Spinner';
import { EmptyState, ErrorState } from '@/components/feedback/StateViews';
import { formatCurrency, formatDateTime } from '@/lib/utils/format';
import { buildPath } from '@/app/routes';
import { getTowingOrders } from '../api/towingApi';
import { isTowingActive, isTowingSearching, towingStatusLabel, type TowingOrder } from '../types';

function statusTone(status: string): BadgeProps['tone'] {
  if (status === 'COMPLETED' || status === 'DROPPED_OFF') return 'green';
  if (status === 'CANCELED' || status === 'CANCELLED') return 'neutral';
  if (isTowingSearching(status) || isTowingActive(status)) return 'blue';
  return 'yellow';
}

/** Daftar pesanan derek: yang berjalan di atas, riwayat di bawahnya. */
export function TowingOrdersPage() {
  const navigate = useNavigate();
  const query = useQuery({ queryKey: ['towing-orders'], queryFn: getTowingOrders });

  const orders = query.data ?? [];
  const running = orders.filter(
    (order) => isTowingSearching(order.status) || isTowingActive(order.status),
  );
  const history = orders.filter((order) => !running.includes(order));

  return (
    <PageContainer>
      <AppHeader title="Pesanan Derek" />
      <div className="flex flex-1 flex-col gap-4 px-5 py-5">
        {query.isLoading && <LoadingState label="Memuat pesanan…" />}
        {query.isError && <ErrorState onRetry={() => void query.refetch()} />}

        {!query.isLoading && !query.isError && orders.length === 0 && (
          <EmptyState
            icon={<Truck className="size-7" />}
            title="Belum ada pesanan derek"
            description="Pesanan derek yang Anda buat akan tersimpan di sini."
          />
        )}

        {running.length > 0 && (
          <Section title="Sedang berjalan">
            {running.map((order) => (
              <OrderRow
                key={order.orderCode}
                order={order}
                onOpen={() => navigate(buildPath.towingStatus(order.orderCode))}
              />
            ))}
          </Section>
        )}

        {history.length > 0 && (
          <Section title="Riwayat">
            {history.map((order) => (
              <OrderRow
                key={order.orderCode}
                order={order}
                onOpen={() => navigate(buildPath.towingStatus(order.orderCode))}
              />
            ))}
          </Section>
        )}
      </div>
    </PageContainer>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-12 font-semibold text-neutral-700">{title}</p>
      {children}
    </div>
  );
}

function OrderRow({ order, onOpen }: { order: TowingOrder; onOpen: () => void }) {
  // Tujuan lebih berguna daripada titik jemput saat menengok riwayat: yang
  // diingat orang adalah "mobil saya dibawa ke bengkel mana".
  const destination = order.workshopName || order.dropoffAddress || 'Tujuan tidak tercatat';

  return (
    <button type="button" onClick={onOpen} className="text-left">
      <Card className="flex items-center gap-3">
        <span className="bg-deep-blue-50 text-deep-blue-600 grid size-10 shrink-0 place-items-center rounded-full">
          <Truck className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="text-13 truncate font-semibold text-neutral-900">{order.orderCode}</p>
            <Badge tone={statusTone(order.status)}>{towingStatusLabel(order.status)}</Badge>
          </div>
          <p className="text-11 mt-1 flex items-center gap-1 truncate text-neutral-700">
            <MapPin className="size-3.5 shrink-0" />
            {destination}
          </p>
          <p className="text-11 mt-0.5 text-neutral-600">
            {formatDateTime(order.completedAt || order.requestedAt)}
            {order.userPayable > 0 && ` · ${formatCurrency(order.userPayable)}`}
          </p>
        </div>
        <ChevronRight className="size-5 shrink-0 text-neutral-600" />
      </Card>
    </button>
  );
}
