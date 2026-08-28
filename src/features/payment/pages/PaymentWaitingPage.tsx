import { useCallback, useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { AlertTriangle, Copy, ExternalLink, RefreshCw } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/Button';
import { Spinner } from '@/components/ui/Spinner';
import { toast } from '@/components/feedback/toast';
import { extractErrorMessage } from '@/lib/api/client';
import { formatCurrency } from '@/lib/utils/format';
import { env } from '@/config/env';
import { ROUTES } from '@/app/routes';
import { getInvoice } from '../api';
import { clearPendingPayment, loadPendingPayment } from '../pending';
import type { Invoice, PaymentContext } from '../types';

const POLL_INTERVAL_MS = 5_000;
const SUCCESS_LOADING_DELAY_MS = 3_500;

export function PaymentWaitingPage() {
  const navigate = useNavigate();
  const locationState = useLocation().state as PaymentContext | null;
  // Pulihkan dari sesi tertunda bila halaman dibuka ulang tanpa state.
  const [ctx] = useState<PaymentContext | null>(() => locationState ?? loadPendingPayment());

  useEffect(() => {
    if (!ctx) navigate(ROUTES.home, { replace: true });
  }, [ctx, navigate]);

  if (!ctx) return null;
  return env.useMockServices ? <MockWaiting ctx={ctx} /> : <RealWaiting ctx={ctx} />;
}

/** Mode demo: tidak memanggil gateway, langsung sukses setelah jeda singkat. */
function MockWaiting({ ctx }: { ctx: PaymentContext }) {
  const navigate = useNavigate();
  useEffect(() => {
    const timer = window.setTimeout(() => {
      clearPendingPayment();
      navigate(ROUTES.paymentSuccess, { replace: true, state: buildSuccessContext(ctx, null) });
    }, SUCCESS_LOADING_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [ctx, navigate]);

  return (
    <PageContainer>
      <AppHeader title="Menunggu Pembayaran" showBack={false} />
      <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
        <Spinner className="size-10" />
        <p className="text-16 font-semibold text-neutral-900">Memproses pembayaran…</p>
        <p className="text-12 text-neutral-700">
          Mohon tunggu, kami sedang mengonfirmasi pembayaran Anda. Jangan tutup halaman ini.
        </p>
      </div>
    </PageContainer>
  );
}

function remainingSeconds(expiryTime: string): number {
  if (!expiryTime) return 0;
  const expiry = new Date(expiryTime).getTime();
  if (Number.isNaN(expiry)) return 0;
  return Math.max(0, Math.floor((expiry - Date.now()) / 1000));
}

function formatClock(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(2, '0');
  const seconds = (totalSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function isSuccessStatus(status: string): boolean {
  return ['SUCCEEDED', 'PAID', 'SUCCESS', 'SETTLED', 'COMPLETED'].includes(status.toUpperCase());
}

function formatReceiptMethod(invoice: Invoice | null, fallback?: string): string | undefined {
  if (!invoice) return fallback;
  const method = invoice.paymentMethod.toUpperCase();
  const channel = invoice.channelCode || invoice.vaBank;
  if (method === 'QRIS') return 'QRIS';
  if (method === 'VA')
    return channel ? `Virtual Account ${channel.replace(/^VA_/, '')}` : 'Virtual Account';
  if (method === 'EWALLET') return fallback || channel || 'E-Wallet';
  return fallback || method || undefined;
}

function buildSuccessContext(ctx: PaymentContext, invoice: Invoice | null): PaymentContext {
  const receiptTime = invoice?.updatedAt || invoice?.createdAt || new Date().toISOString();
  const reference = invoice?.inferenceTicket || ctx.ticket;
  const transactionId = invoice?.transactionId || reference;
  return {
    ...ctx,
    amount: invoice?.chargeAmount || ctx.amount,
    method: formatReceiptMethod(invoice, ctx.method),
    receipt: {
      orderNumber: reference,
      transactionId,
      status: invoice?.status || 'SUCCEEDED',
      method: formatReceiptMethod(invoice, ctx.method),
      channelCode: invoice?.channelCode,
      paidAt: receiptTime,
    },
  };
}

/** Mode backend: polling status invoice + instruksi pembayaran (QRIS/VA/e-wallet). */
function RealWaiting({ ctx }: { ctx: PaymentContext }) {
  const navigate = useNavigate();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [remaining, setRemaining] = useState(0);
  const [isCompleting, setIsCompleting] = useState(false);
  const stoppedRef = useRef(false);
  const completionTimerRef = useRef<number | null>(null);

  const goSuccess = useCallback(
    (latestInvoice: Invoice | null) => {
      const successContext = buildSuccessContext(ctx, latestInvoice);

      clearPendingPayment();
      setIsCompleting(true);
      if (completionTimerRef.current !== null) {
        window.clearTimeout(completionTimerRef.current);
      }
      completionTimerRef.current = window.setTimeout(() => {
        navigate(ROUTES.paymentSuccess, { replace: true, state: successContext });
      }, SUCCESS_LOADING_DELAY_MS);
    },
    [ctx, navigate],
  );

  useEffect(() => {
    return () => {
      if (completionTimerRef.current !== null) {
        window.clearTimeout(completionTimerRef.current);
      }
    };
  }, []);

  const fetchInvoice = useCallback(async () => {
    if (stoppedRef.current || !ctx.ticket) return;
    try {
      const data = await getInvoice(ctx.ticket, ctx.paymentType);
      setInvoice(data);
      setError(null);
      setRemaining(remainingSeconds(data.expiryTime));
      const status = data.status.toUpperCase();
      if (isSuccessStatus(status)) {
        stoppedRef.current = true;
        goSuccess(data);
      } else if (status === 'FAILED' || status === 'EXPIRED') {
        stoppedRef.current = true;
        clearPendingPayment();
      }
    } catch (err) {
      setError(extractErrorMessage(err, 'Gagal memeriksa status pembayaran.'));
    }
  }, [ctx, goSuccess]);

  // Muat awal + polling status tiap 5 detik.
  useEffect(() => {
    void fetchInvoice();
    const poll = window.setInterval(() => void fetchInvoice(), POLL_INTERVAL_MS);
    return () => window.clearInterval(poll);
  }, [fetchInvoice]);

  // Hitung mundur kedaluwarsa per detik.
  useEffect(() => {
    if (!invoice?.expiryTime) return;
    const tick = window.setInterval(
      () => setRemaining(remainingSeconds(invoice.expiryTime)),
      1_000,
    );
    return () => window.clearInterval(tick);
  }, [invoice?.expiryTime]);

  const handleCheckNow = async () => {
    setIsChecking(true);
    await fetchInvoice();
    setIsChecking(false);
  };

  const handleCreateNew = () => {
    clearPendingPayment();
    navigate(ROUTES.payment, {
      replace: true,
      state: {
        payment_type: ctx.paymentType,
        redirect_route: ctx.redirectRoute,
        redirect_state: ctx.redirectState,
        ticket: ctx.ticket,
		policy_number: ctx.policyNumber,
        amount: ctx.amount,
        item_name: ctx.itemName,
      },
    });
  };

  const copyVa = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success('Nomor VA disalin.');
    } catch {
      toast.error('Tidak dapat menyalin.');
    }
  };

  const status = invoice?.status.toUpperCase() ?? 'PENDING';
  const isExpired =
    status === 'EXPIRED' ||
    (remaining === 0 && Boolean(invoice?.expiryTime) && status === 'PENDING');
  const isFailed = status === 'FAILED';
  const isTerminal = isExpired || isFailed;
  const method = (invoice?.paymentMethod ?? '').toUpperCase();

  if (isCompleting) {
    return (
      <PageContainer>
        <AppHeader title="Menunggu Pembayaran" showBack={false} />
        <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 text-center">
          <Spinner className="text-deep-blue-500 size-10" />
          <p className="text-16 font-semibold text-neutral-900">Pembayaran terkonfirmasi</p>
          <p className="text-12 text-neutral-700">Menyiapkan halaman berhasil...</p>
        </div>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <AppHeader title="Instruksi Pembayaran" showBack={false} />
      <div className="flex flex-1 flex-col gap-4 px-5 py-5">
        {/* Status / hitung mundur */}
        <div className="drive-card rounded-xl border border-neutral-300 p-5 text-center">
          {!invoice ? (
            <div className="flex flex-col items-center gap-3 py-4">
              <Spinner className="size-8" />
              <p className="text-12 text-neutral-700">Memuat instruksi pembayaran…</p>
            </div>
          ) : (
            <>
              <p className="text-14 font-semibold text-neutral-800">
                {isExpired
                  ? 'Waktu pembayaran sudah habis'
                  : isFailed
                    ? 'Pembayaran gagal diproses'
                    : 'Selesaikan pembayaran sebelum waktu habis'}
              </p>
              <p
                className={`mt-3 text-3xl font-bold ${isTerminal ? 'text-[#e76a6a]' : 'text-deep-blue-500'}`}
              >
                {isTerminal ? status : formatClock(remaining)}
              </p>
            </>
          )}
        </div>

        {/* Instruksi metode */}
        {invoice && !isTerminal && method === 'QRIS' && invoice.qrString && (
          <div className="drive-card flex flex-col items-center rounded-xl border border-neutral-300 p-5">
            <p className="text-14 font-bold text-neutral-900">Bayar dengan QRIS</p>
            <p className="text-12 mt-1 text-center text-neutral-600">
              Scan kode di bawah dari aplikasi e-wallet atau m-banking
            </p>
            <div className="mt-4 rounded-lg border border-neutral-300 p-3">
              <QRCodeSVG value={invoice.qrString} size={200} />
            </div>
            <p className="text-deep-blue-500 mt-4 text-lg font-bold">
              {formatCurrency(invoice.chargeAmount || ctx.amount)}
            </p>
          </div>
        )}

        {invoice && !isTerminal && method === 'VA' && invoice.vaNumber && (
          <div className="drive-card rounded-xl border border-neutral-300 p-5">
            <p className="text-14 font-bold text-neutral-900">
              Transfer ke Virtual Account {invoice.vaBank || ''}
            </p>
            <p className="text-12 mt-1 text-neutral-600">
              Bayar lewat ATM, m-banking, atau internet banking ke nomor berikut
            </p>
            <div className="mt-4 flex items-center gap-3 rounded-lg border border-neutral-300 bg-neutral-100 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-11 text-neutral-600">Nomor Virtual Account</p>
                <p className="text-18 font-bold tracking-wider text-neutral-900">
                  {invoice.vaNumber}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void copyVa(invoice.vaNumber)}
                aria-label="Salin nomor VA"
                className="text-deep-blue-500"
              >
                <Copy className="size-5" />
              </button>
            </div>
            <div className="mt-3 flex justify-between">
              <span className="text-13 font-bold text-neutral-900">Total Pembayaran</span>
              <span className="text-deep-blue-500 text-16 font-bold">
                {formatCurrency(invoice.chargeAmount || ctx.amount)}
              </span>
            </div>
          </div>
        )}

        {error && (
          <div className="border-warning/25 bg-warning/10 flex items-start gap-2 rounded-lg border p-3">
            <AlertTriangle className="text-warning mt-0.5 size-5 shrink-0" />
            <p className="text-12 text-neutral-700">{error}</p>
          </div>
        )}

        {/* Ringkasan */}
        <div className="drive-card rounded-xl border border-neutral-300 p-4">
          <p className="text-14 font-bold text-neutral-900">Ringkasan Pembayaran</p>
          <div className="mt-3 flex flex-col gap-2">
            <SummaryRow label="Status" value={invoice?.status ?? 'PENDING'} />
            <SummaryRow label="Metode" value={ctx.method ?? invoice?.channelCode ?? '-'} />
            <SummaryRow label="Total" value={formatCurrency(invoice?.chargeAmount || ctx.amount)} />
            <SummaryRow label="Referensi" value={ctx.ticket} />
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 flex flex-col gap-3 border-t border-neutral-300 bg-neutral-100 px-5 py-4">
        {isTerminal ? (
          <Button size="lg" onClick={handleCreateNew}>
            Buat Pembayaran Baru
          </Button>
        ) : (
          <>
            {method !== 'QRIS' && method !== 'VA' && invoice?.action.startsWith('https') && (
              <a href={invoice.action} target="_blank" rel="noreferrer" className="block">
                <Button size="lg" leftIcon={<ExternalLink className="size-5" />}>
                  Buka Halaman Pembayaran
                </Button>
              </a>
            )}
            <div className="flex gap-3">
              <Button
                fullWidth={false}
                className="flex-1"
                variant="outline"
                isLoading={isChecking}
                leftIcon={<RefreshCw className="size-4" />}
                onClick={() => void handleCheckNow()}
              >
                Cek Status
              </Button>
              <Button
                fullWidth={false}
                className="flex-1"
                variant="ghost"
                onClick={handleCreateNew}
              >
                Batalkan
              </Button>
            </div>
          </>
        )}
      </div>
    </PageContainer>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-12 text-neutral-600">{label}</span>
      <span className="text-12 truncate text-right font-semibold text-neutral-900">{value}</span>
    </div>
  );
}
