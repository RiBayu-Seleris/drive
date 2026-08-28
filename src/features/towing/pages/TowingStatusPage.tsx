import type { ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { QRCodeSVG } from 'qrcode.react';
import {
  MapPin,
  Truck,
  Phone,
  MessageCircle,
  Star,
  CircleDot,
  Loader2,
  CreditCard,
  Ticket,
  PackageCheck,
  CheckCircle2,
  Clock3,
} from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { AppHeader } from '@/components/layout/AppHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { LoadingState } from '@/components/ui/Spinner';
import { ErrorState } from '@/components/feedback/StateViews';
import { confirm } from '@/components/feedback/confirm';
import { toast } from '@/components/feedback/toast';
import { extractErrorMessage } from '@/lib/api/client';
import { formatCurrency, formatDateTime } from '@/lib/utils/format';
import { cn } from '@/lib/utils/cn';
import { MapView, type MapMarker, type MapPoint } from '@/components/map/MapView';
import { ROUTES, buildPath } from '@/app/routes';
import { getInvoice } from '@/features/payment/api';
import {
  getTowingOrder,
  getTowingTracking,
  getTowingSettlementTicket,
  cancelTowingOrder,
} from '../api/towingApi';
import {
  towingStatusLabel,
  isTowingActive,
  isTowingSearching,
  isTowingCancelable,
  type SettlementFlag,
  type TowingOrder,
} from '../types';

function valid(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);
}

export function TowingStatusPage() {
  const { code = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['towing-order', code],
    queryFn: () => getTowingOrder(code),
    refetchInterval: (query) => {
      const status = query.state.data?.status ?? '';
      return isTowingActive(status) || isTowingSearching(status) ? 8000 : false;
    },
  });

  const active = isTowingActive(data?.status ?? '');

  const { data: tracking } = useQuery({
    queryKey: ['towing-tracking', code],
    queryFn: () => getTowingTracking(code),
    enabled: active,
    refetchInterval: active ? 8000 : false,
  });

  const { data: settlementTicket } = useQuery({
    queryKey: ['towing-settlement-ticket', code],
    queryFn: () => getTowingSettlementTicket(code),
    enabled: Boolean(data?.claimNumber && code),
    retry: false,
    refetchInterval: (query) => {
      const flag = query.state.data?.flags.find((item) => item.flagType === 'TOWING');
      return flag && flag.status !== 'SETTLED' ? 8000 : false;
    },
  });

  const isTowingPaymentStep = Boolean(
    data &&
      ['DROPPED_OFF', 'COMPLETED'].includes(data.status) &&
      data.userPayable > 0,
  );
  const { data: payment } = useQuery({
    queryKey: ['towing-payment', data?.inferenceTicket],
    queryFn: () => getInvoice(data!.inferenceTicket, 'TOWING'),
    enabled: isTowingPaymentStep && Boolean(data?.inferenceTicket),
    retry: false,
  });

  const cancelMutation = useMutation({
    mutationFn: () => cancelTowingOrder(code),
    onSuccess: (result) => {
      toast.success(
        result.fee > 0
          ? `Order dibatalkan. Biaya pembatalan ${formatCurrency(result.fee)}.`
          : 'Order dibatalkan.',
      );
      void queryClient.invalidateQueries({ queryKey: ['towing-order', code] });
    },
    onError: (error) => toast.error(extractErrorMessage(error, 'Order gagal dibatalkan.')),
  });

  const handleCancel = async () => {
    const ok = await confirm({
      title: 'Batalkan towing?',
      message:
        'Permintaan towing akan dihentikan. Pembatalan hanya bisa dilakukan selama masih mencari sopir.',
      confirmText: 'Ya, batalkan',
      tone: 'danger',
    });
    if (ok) cancelMutation.mutate();
  };

  if (isLoading) {
    return (
      <PageContainer>
        <AppHeader showLogo />
        <LoadingState label="Memuat status towing…" />
      </PageContainer>
    );
  }
  if (isError || !data) {
    return (
      <PageContainer>
        <AppHeader showLogo />
        <ErrorState onRetry={() => void refetch()} />
      </PageContainer>
    );
  }

  const pickup: MapPoint | null = valid(data.pickupLatitude, data.pickupLongitude)
    ? { lat: data.pickupLatitude, lng: data.pickupLongitude }
    : null;
  const driver: MapPoint | null =
    tracking?.hasLocation && valid(tracking.driverLatitude, tracking.driverLongitude)
      ? { lat: tracking.driverLatitude, lng: tracking.driverLongitude }
      : null;
  const markers: MapMarker[] = [];
  if (driver) markers.push({ ...driver, label: 'Sopir', variant: 'driver' });
  if (pickup) markers.push({ ...pickup, label: 'Penjemputan', variant: 'origin' });
  const center = driver ?? pickup;

  const distanceKm = tracking?.distanceKm ?? 0;
  const etaMinutes = distanceKm > 0 ? Math.max(1, Math.round(distanceKm * 2.4)) : 0;
  const destination = data.workshopName || data.dropoffAddress || 'Tujuan';
  const price = data.userPayable > 0 ? data.userPayable : data.quotedPrice;
  const paymentStatus = payment?.status.toUpperCase() ?? '';
  const towingFlag =
    settlementTicket?.flags.find(
      (flag) => flag.flagType === 'TOWING' && flag.referenceCode === data.orderCode,
    ) ?? settlementTicket?.flags.find((flag) => flag.flagType === 'TOWING');
  const towingPaid = paymentStatus === 'SUCCEEDED' || towingFlag?.status === 'SETTLED';

  const handlePayTowing = () => {
    if (!data.inferenceTicket) {
      toast.error('Referensi pembayaran towing tidak ditemukan.');
      return;
    }
    navigate(ROUTES.payment, {
      state: {
        payment_type: 'TOWING',
        redirect_route: buildPath.towingStatus(data.orderCode),
        ticket: data.inferenceTicket,
        amount: data.userPayable,
        item_name: 'Biaya Towing',
      },
    });
  };

  return (
    <PageContainer className="bg-neutral-200">
      <AppHeader showLogo />

      {active && center && (
        <div className="relative shrink-0">
          <MapView
            center={center}
            markers={markers}
            polyline={driver && pickup ? [driver, pickup] : undefined}
            fitToMarkers={markers.length > 1}
            className="h-56 rounded-none"
          />
          <div className="drive-card absolute inset-x-4 top-3 rounded-xl p-3 shadow-md">
            <RoutePoint icon={<CircleDot className="text-deep-blue-500 size-4" />} text={data.pickupAddress || 'Lokasi penjemputan'} />
            <div className="my-1 ml-2 h-3 border-l border-dashed border-neutral-500" />
            <RoutePoint icon={<MapPin className="text-danger size-4" />} text={destination} />
          </div>
        </div>
      )}

      <div className="flex flex-1 flex-col gap-4 px-5 py-5">
        {isTowingSearching(data.status) ? (
          <Card className="flex flex-col items-center gap-3 py-8 text-center">
            <Loader2 className="text-deep-blue-500 size-9 animate-spin" />
            <p className="text-14 font-semibold text-neutral-900">Mencari derek terdekat…</p>
            <p className="text-12 text-neutral-600">{towingStatusLabel(data.status)}</p>
            <p className="text-10 text-neutral-500">Kode order: {data.orderCode}</p>
          </Card>
        ) : active ? (
          <>
            <div className="flex items-center gap-3">
              <Truck className="text-deep-blue-500 size-8 shrink-0" />
              <p className="text-14 font-semibold text-neutral-900">
                {towingStatusLabel(data.status)}, tunggu yaaa…
              </p>
            </div>

            <div className="flex items-center justify-between rounded-xl bg-neutral-200 px-4 py-3">
              <span className="text-success inline-flex items-center gap-2 text-14 font-medium">
                <Truck className="size-5" /> Towing
              </span>
              {price > 0 && (
                <span className="text-14 font-semibold text-neutral-900">{formatCurrency(price)}</span>
              )}
            </div>

            {data.driverName && <DriverCard order={data} />}

            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="STATUS" value={data.driverVerified ? 'VERIFIED' : towingStatusLabel(data.status)} />
              <Stat label="KENDARAAN" value={data.fleetPlateNumber || '-'} />
              <Stat
                label="BERGABUNG"
                value={data.driverJoinedYears > 0 ? `${data.driverJoinedYears} Tahun` : '-'}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <InfoBox label="Jarak" value={distanceKm > 0 ? `${distanceKm.toFixed(1)} km` : '-'} />
              <InfoBox label="Waktu" value={etaMinutes > 0 ? `${etaMinutes} mnt` : '-'} />
            </div>
          </>
        ) : (
          <Card className="flex flex-col items-center gap-2 py-8 text-center">
            <Badge tone={data.status === 'CANCELED' ? 'red' : 'green'}>
              {towingStatusLabel(data.status)}
            </Badge>
            <p className="text-10 text-neutral-500">Kode order: {data.orderCode}</p>
          </Card>
        )}

        {data.dropoffProofPhoto && <HandoverCard order={data} />}

        {towingFlag && (
          <SettlementTicketCard flag={towingFlag} fallbackCode={data.orderCode} />
        )}

        {isTowingPaymentStep && (
          <Card className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <span className="bg-deep-blue-50 text-deep-blue-500 grid size-10 shrink-0 place-items-center rounded-full">
                <CreditCard className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-14 font-semibold text-neutral-900">Pembayaran Towing</p>
                <p className="text-12 mt-1 text-neutral-600">
                  Total yang perlu dibayar: {formatCurrency(data.userPayable)}
                </p>
              </div>
              {towingPaid && <Badge tone="green">Lunas</Badge>}
            </div>
            {!towingPaid && (
              <Button
                leftIcon={<CreditCard className="size-5" />}
                disabled={!data.inferenceTicket}
                onClick={handlePayTowing}
              >
                Bayar Biaya Towing
              </Button>
            )}
            {!data.inferenceTicket && (
              <p className="text-11 text-danger">
                Pembayaran online belum tersedia karena referensi klaim tidak ditemukan.
              </p>
            )}
          </Card>
        )}

        {isTowingCancelable(data.status) && (
          <div className="mt-auto pt-4">
            <Button
              variant="outline"
              className="border-danger text-danger"
              isLoading={cancelMutation.isPending}
              onClick={handleCancel}
            >
              Batalkan Order
            </Button>
          </div>
        )}
      </div>
    </PageContainer>
  );
}

function SettlementTicketCard({
  flag,
  fallbackCode,
}: {
  flag: SettlementFlag;
  fallbackCode: string;
}) {
  const code = flag.referenceCode || fallbackCode || flag.claimNumber;
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="bg-deep-blue-50 text-deep-blue-500 grid size-10 shrink-0 place-items-center rounded-full">
          <Ticket className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-14 font-semibold text-neutral-900">Tiket Klaim Towing</p>
          <p className="text-12 mt-1 text-neutral-600">Tunjukkan kode ini ke sopir saat towing selesai.</p>
        </div>
        <Badge tone={flag.status === 'SETTLED' ? 'green' : flag.status === 'AWAITING_PAYMENT' ? 'yellow' : 'blue'}>
          {flag.status === 'SETTLED' ? 'Lunas' : flag.status === 'AWAITING_PAYMENT' ? 'Bayar sisa' : 'Aktif'}
        </Badge>
      </div>
      <div className="drive-card flex items-center gap-4 rounded-xl p-3">
        {code && <QRCodeSVG value={code} size={92} marginSize={1} />}
        <div className="min-w-0 flex-1">
          <p className="text-10 font-semibold text-neutral-500">KODE TIKET</p>
          <p className="break-all text-16 font-bold text-neutral-900">{code || '-'}</p>
          <p className="text-11 mt-2 text-neutral-600">
            Asuransi {formatCurrency(flag.insuranceAmount)} · Sisa {formatCurrency(flag.userPayable)}
          </p>
        </div>
      </div>
    </Card>
  );
}

function RoutePoint({ icon, text }: { icon: ReactNode; text: string }) {
  return (
    <div className="flex items-center gap-2">
      {icon}
      <span className="truncate text-12 text-neutral-800">{text}</span>
    </div>
  );
}

function DriverCard({ order }: { order: TowingOrder }) {
  return (
    <Card className="flex items-center gap-3">
      <div className="bg-deep-blue-100 text-deep-blue-600 flex size-12 shrink-0 items-center justify-center rounded-full text-16 font-semibold">
        {order.driverName.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-14 font-semibold text-neutral-900">{order.driverName}</p>
          {order.driverRating > 0 && (
            <span className="text-warning inline-flex items-center gap-0.5 text-12 font-medium">
              <Star className="size-3.5 fill-current" /> {order.driverRating.toFixed(1)}
            </span>
          )}
        </div>
        {order.driverTotalTrips > 0 && (
          <p className="text-10 text-neutral-600">{order.driverTotalTrips.toLocaleString('id-ID')}+ Perjalanan</p>
        )}
      </div>
      {order.driverPhone && (
        <div className="flex gap-2">
          <a
            href={`https://wa.me/${order.driverPhone.replace(/\D/g, '')}`}
            target="_blank"
            rel="noreferrer"
            aria-label="Chat sopir"
            className="text-deep-blue-500 flex size-9 items-center justify-center rounded-full bg-deep-blue-50"
          >
            <MessageCircle className="size-5" />
          </a>
          <a
            href={`tel:${order.driverPhone}`}
            aria-label="Telepon sopir"
            className="text-deep-blue-500 flex size-9 items-center justify-center rounded-full bg-deep-blue-50"
          >
            <Phone className="size-5" />
          </a>
        </div>
      )}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-neutral-200 py-2">
      <p className="text-10 text-neutral-600">{label}</p>
      <p className={cn('truncate text-12 font-semibold text-neutral-900')}>{value}</p>
    </div>
  );
}

function InfoBox({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-neutral-400 px-4 py-3">
      <p className="text-10 text-neutral-600">{label}</p>
      <p className="text-14 font-semibold text-neutral-900">{value}</p>
    </div>
  );
}

/**
 * Bukti serah-terima kendaraan di tujuan.
 *
 * Dua lapis: foto sopir muncul begitu kendaraan diturunkan, lalu konfirmasi
 * bengkel menyusul. User sengaja tidak dibuat menunggu konfirmasi bengkel —
 * dia sudah tahu mobilnya sampai sejak foto ini ada.
 */
function HandoverCard({ order }: { order: TowingOrder }) {
  const received = Boolean(order.vehicleReceivedAt);

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-full bg-success/20 text-success">
          <PackageCheck className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-14 font-semibold text-neutral-900">Kendaraan sudah sampai</p>
          <p className="text-12 mt-1 text-neutral-600">
            Diturunkan di {order.workshopName || order.dropoffAddress || 'lokasi tujuan'}
            {order.droppedOffAt ? ` • ${formatDateTime(order.droppedOffAt)}` : ''}
          </p>
        </div>
      </div>

      {/* Dua sudut serong; keduanya ditampilkan agar pemilik bisa memeriksa
          seluruh sisi bodi, bukan hanya satu tampak. */}
      <div className="grid grid-cols-2 gap-2">
        <img
          src={order.dropoffProofPhoto}
          alt="Bukti serah terima, sudut depan-kiri"
          className="aspect-[4/3] w-full rounded-xl object-cover"
          loading="lazy"
        />
        {order.dropoffProofPhotoRear && (
          <img
            src={order.dropoffProofPhotoRear}
            alt="Bukti serah terima, sudut belakang-kanan"
            className="aspect-[4/3] w-full rounded-xl object-cover"
            loading="lazy"
          />
        )}
      </div>

      <div
        className={cn(
          'text-12 flex items-start gap-2 rounded-lg px-3 py-2.5',
          received ? 'bg-success/15 text-success' : 'bg-warning/10 text-neutral-700',
        )}
      >
        {received ? (
          <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" />
        ) : (
          <Clock3 className="text-warning mt-0.5 size-4 shrink-0" />
        )}
        <span>
          {received
            ? `Bengkel sudah mengonfirmasi penerimaan kendaraan${
                order.vehicleReceivedAt ? ` • ${formatDateTime(order.vehicleReceivedAt)}` : ''
              }.`
            : 'Menunggu konfirmasi penerimaan dari bengkel.'}
        </span>
      </div>
    </Card>
  );
}
