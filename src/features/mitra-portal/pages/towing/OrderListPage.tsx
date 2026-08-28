import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertTriangle, ChevronDown, Clock, MapPin, RefreshCw } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/Spinner';
import { toast } from '@/components/feedback/toast';
import { confirm } from '@/components/feedback/confirm';
import { extractErrorMessage } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';
import { MitraShell } from '../../components/MitraShell';
import { MapPreview } from '../../components/MapPreview';
import {
  fleetTypeLabel,
  getMitraTowingOrders,
  reassignReasonLabel,
  rejectMitraTowingOrder,
  subscribeMitraTowingOrderChanges,
  towingStatusLabel,
  type MitraTowingOrder,
} from '../../api';

type OrderTab = 'order' | 'history';

/** Label ramah untuk towing_type order (chip kartu order masuk). */
const TOWING_TYPE_LABELS: Record<string, string> = {
  TOWING_ONLY: 'Derek Saja',
  WORKSHOP_TOWING: 'Derek ke Bengkel',
};

function timeLabel(value: string): string {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

/** Ikon paket (kotak + pita) meniru glyph pill di desain history order. */
function PackageGlyph({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" className={className}>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <path d="M9.5 3.5v7l2.5-2 2.5 2v-7" />
      <path d="M8 17h4" strokeLinecap="round" />
    </svg>
  );
}

/** Daftar order derek: tab "Order Towing" (masuk) + "History Order" (riwayat). */
export function OrderListPage() {
  const navigate = useNavigate();
  const [orders, setOrders] = useState<MitraTowingOrder[]>([]);
  const [tab, setTab] = useState<OrderTab>('order');
  const [loading, setLoading] = useState(true);
  const [rejectingId, setRejectingId] = useState<number | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await getMitraTowingOrders({ limit: 100 });
      setOrders(res.data);
    } catch (error) {
      if (!silent) {
        toast.error(extractErrorMessage(error, 'Gagal memuat order towing.'));
        setOrders([]);
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    return subscribeMitraTowingOrderChanges({
      onChange: () => void load(true),
    });
  }, [load]);

  const incoming = useMemo(() => orders.filter((o) => o.status === 'OFFERED'), [orders]);
  const reassignNeeded = useMemo(
    () => orders.filter((o) => o.status === 'NEEDS_REASSIGN'),
    [orders],
  );
  const history = useMemo(
    () => orders.filter((o) => o.status !== 'OFFERED' && o.status !== 'NEEDS_REASSIGN'),
    [orders],
  );

  const handleReject = async (order: MitraTowingOrder) => {
    const ok = await confirm({
      title: 'Tolak Order',
      message: `Tolak order ${order.orderCode || `#${order.id}`} dan teruskan ke provider lain?`,
      confirmText: 'Tolak',
      tone: 'danger',
    });
    if (!ok) return;
    setRejectingId(order.id);
    try {
      await rejectMitraTowingOrder(order.id);
      setOrders((current) => current.filter((item) => item.id !== order.id));
      toast.success('Order ditolak dan akan diteruskan.');
      void load(true);
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Gagal menolak order.'));
    } finally {
      setRejectingId(null);
    }
  };

  return (
    <MitraShell>
      <AppHeader
        showLogo
        rightSlot={
          <button
            type="button"
            onClick={() => void load()}
            aria-label="Muat ulang order"
            className="text-deep-blue-500 grid size-9 place-items-center rounded-full bg-neutral-200"
          >
            <RefreshCw className={cn('size-4', loading && 'animate-spin')} />
          </button>
        }
      />

      {/* Pill Order Towing / History Order (desain history.svg) */}
      <div className="flex items-center gap-3 px-5 pt-4">
        <TabPill
          active={tab === 'order'}
          activeClass="bg-[#aded1f] text-[#10200a]"
          idleClass="bg-[#aded1f]/10 text-[#c2f347]"
          iconClass={tab === 'order' ? 'bg-neutral-200 text-[#e7796a]' : 'bg-[#aded1f] text-[#10200a]'}
          count={incoming.length + reassignNeeded.length}
          onClick={() => setTab('order')}
        >
          Order Towing
        </TabPill>
        <TabPill
          active={tab === 'history'}
          activeClass="bg-[#df4e3a] text-white"
          idleClass="bg-[#df4e3a]/10 text-[#e7796a]"
          iconClass={tab === 'history' ? 'bg-neutral-200 text-[#e7796a]' : 'bg-[#df4e3a] text-white'}
          count={history.length}
          onClick={() => setTab('history')}
        >
          History Order
        </TabPill>
      </div>

      {loading ? (
        <div className="grid flex-1 place-items-center">
          <LoadingState label="Memuat order towing…" />
        </div>
      ) : tab === 'order' ? (
        incoming.length === 0 && reassignNeeded.length === 0 ? (
          <EmptyState
            title="Belum ada order masuk"
            body="Order dari user akan muncul di sini setelah auto-dispatch menawarkan ke mitra ini."
          />
        ) : (
          <div className="mt-4 space-y-4 px-5">
            {reassignNeeded.length > 0 && (
              <div className="space-y-3">
                <h2 className="text-danger text-14 flex items-center gap-1.5 font-bold">
                  <AlertTriangle className="size-4" /> Perlu Penugasan Ulang
                </h2>
                {reassignNeeded.map((order) => (
                  <ReassignCard
                    key={order.id}
                    order={order}
                    onReassign={() => navigate(ROUTES.mitraPenugasan, { state: { order } })}
                  />
                ))}
              </div>
            )}
            {incoming.map((order) => (
              <OrderCard
                key={order.id}
                order={order}
                rejecting={rejectingId === order.id}
                onDetail={() => navigate(ROUTES.mitraOrderTracking, { state: { order } })}
                onAccept={() => navigate(ROUTES.mitraPenugasan, { state: { order } })}
                onReject={() => void handleReject(order)}
              />
            ))}
          </div>
        )
      ) : history.length === 0 ? (
        <EmptyState title="Belum ada riwayat" body="Order yang sudah ditangani tampil di sini." />
      ) : (
        <div className="mt-4 px-5">
          <div className="drive-card rounded-2xl p-4">
            <h2 className="text-16 font-bold text-neutral-900">Aktifitas Terkini</h2>
            <div className="mt-2">
              {history.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => navigate(ROUTES.mitraOrderTracking, { state: { order } })}
                  className="flex w-full items-center gap-3 border-b border-neutral-300 py-3 text-left last:border-0"
                >
                  <span className="bg-green-cust/12 text-green-cust grid size-9 shrink-0 place-items-center rounded-full">
                    <ChevronDown className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="text-14 block truncate font-semibold text-neutral-900">
                      {towingStatusLabel(order.status)} - {order.pickupAddress || 'Lokasi jemput'}
                    </span>
                    <span className="text-12 block text-neutral-500">
                      {timeLabel(order.requestedAt) || order.orderCode}
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </MitraShell>
  );
}

function TabPill({
  active,
  activeClass,
  idleClass,
  iconClass,
  count,
  onClick,
  children,
}: {
  active: boolean;
  activeClass: string;
  idleClass: string;
  iconClass: string;
  count: number;
  onClick: () => void;
  children: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-1 items-center gap-2.5 rounded-full p-2 pr-4 transition',
        active ? `${activeClass} shadow-md` : idleClass,
      )}
    >
      <span className={cn('relative grid size-9 shrink-0 place-items-center rounded-full', iconClass)}>
        <PackageGlyph className="size-5" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 grid size-4 place-items-center rounded-full bg-[#df3a3a] text-[9px] font-bold text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </span>
      <span className="text-14 truncate font-semibold">{children}</span>
    </button>
  );
}

/** Kartu order yang dikembalikan sopir (menolak / armada tidak layak). */
function ReassignCard({
  order,
  onReassign,
}: {
  order: MitraTowingOrder;
  onReassign: () => void;
}) {
  return (
    <div className="drive-card border-danger/30 rounded-2xl border p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="bg-danger/10 text-danger text-10 rounded-md px-2.5 py-1 font-bold tracking-wide uppercase">
          {reassignReasonLabel(order.reassignReason)}
        </span>
        <p className="text-deep-blue-600 text-14 font-bold">{order.orderCode || `#${order.id}`}</p>
      </div>

      <p className="text-16 mt-2 font-bold text-neutral-900">
        {order.userFullname || 'Permintaan towing'}
      </p>
      <p className="text-12 mt-1 flex items-start gap-1.5 text-neutral-600">
        <MapPin className="text-deep-blue-500 mt-0.5 size-4 shrink-0" />
        {order.pickupAddress}
      </p>

      {order.reassignNote && (
        <div className="text-12 mt-3 rounded-lg bg-neutral-50 p-3 text-neutral-700">
          <span className="font-semibold text-neutral-500">Catatan sopir: </span>
          {order.reassignNote}
        </div>
      )}

      <Button className="mt-3" onClick={onReassign}>
        Tugaskan Ulang
      </Button>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="px-5 py-16 text-center">
      <div className="bg-deep-blue-50 text-deep-blue-500 mx-auto grid size-12 place-items-center rounded-full">
        <Clock className="size-6" />
      </div>
      <p className="text-14 mt-3 font-semibold text-neutral-900">{title}</p>
      <p className="text-12 mt-1 text-neutral-500">{body}</p>
    </div>
  );
}

/** Kartu order masuk sesuai desain "list request order". */
function OrderCard({
  order,
  onDetail,
  onAccept,
  onReject,
  rejecting,
}: {
  order: MitraTowingOrder;
  onDetail: () => void;
  onAccept: () => void;
  onReject: () => void;
  rejecting: boolean;
}) {
  const typeLabel = order.fleetType
    ? fleetTypeLabel(order.fleetType)
    : TOWING_TYPE_LABELS[order.towingType] || 'Towing';
  const requestedTime = order.requestedAt
    ? new Intl.DateTimeFormat('id-ID', { hour: '2-digit', minute: '2-digit' }).format(
        new Date(order.requestedAt),
      )
    : '';

  return (
    <div className="drive-card rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <span className="text-10 rounded-md bg-neutral-200 px-2.5 py-1 font-bold tracking-wide text-neutral-600 uppercase">
          {typeLabel}
        </span>
        <div className="text-right">
          <p className="text-deep-blue-600 text-14 font-bold">{order.orderCode || `#${order.id}`}</p>
          {requestedTime && <p className="text-[11px] text-neutral-500">{requestedTime}</p>}
        </div>
      </div>

      <p className="text-18 mt-2 font-bold text-neutral-900">
        {order.userFullname || 'Permintaan towing'}
      </p>
      <p className="text-14 mt-1.5 flex items-start gap-1.5 text-neutral-700">
        <MapPin className="text-deep-blue-500 mt-0.5 size-4 shrink-0" />
        {order.pickupAddress}
      </p>

      <MapPreview className="mt-3 h-36" />

      <Button className="mt-3" onClick={onAccept}>
        Terima
      </Button>
      <div className="mt-1 grid grid-cols-2">
        <button
          type="button"
          onClick={onDetail}
          className="text-12 py-2 font-semibold text-neutral-500"
        >
          Lihat Detail
        </button>
        <button
          type="button"
          onClick={onReject}
          disabled={rejecting}
          className="text-danger text-12 py-2 font-semibold disabled:opacity-60"
        >
          {rejecting ? 'Menolak…' : 'Tolak Order'}
        </button>
      </div>
    </div>
  );
}
