import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { Button } from '@/components/ui/Button';
import { formatCurrency } from '@/lib/utils/format';
import { ROUTES } from '@/app/routes';
import { useDamageStore } from '@/features/damage/store/damageStore';
import { clearPendingPayment } from '../pending';
import type { PaymentContext } from '../types';
import { AppHeader } from '@/components/layout/AppHeader';

function formatReference(value?: string): string {
  const cleaned = value?.trim();
  if (!cleaned) return '-';
  return cleaned.startsWith('#') ? cleaned : `#${cleaned}`;
}

function formatOrderNumber(value?: string): string {
  const cleaned = value?.trim();
  if (!cleaned) return '-';

  const digits = cleaned.replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);

  // Display-only order number: stable 10-digit value from long ticket/reference strings.
  let hash = 0;
  for (let i = 0; i < cleaned.length; i += 1) {
    hash = (hash * 31 + cleaned.charCodeAt(i)) % 10_000_000_000;
  }
  return hash.toString().padStart(10, '0');
}

function formatReceiptDateTime(input?: string): string {
  if (!input) return '-';
  const normalized = input.includes(' ') ? input.replace(' ', 'T') : input;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function formatStatus(status?: string): string {
  switch (status?.toUpperCase()) {
    case 'SUCCEEDED':
    case 'PAID':
    case 'SUCCESS':
    case 'SETTLED':
    case 'COMPLETED':
      return 'Selesai';
    case 'PENDING':
      return 'Menunggu';
    case 'FAILED':
      return 'Gagal';
    case 'EXPIRED':
      return 'Kedaluwarsa';
    default:
      return status || 'Selesai';
  }
}

function displayValue(value?: string): string {
  return value?.trim() || '-';
}

export function PaymentSuccessPage() {
  const navigate = useNavigate();
  const ctx = useLocation().state as PaymentContext | null;
  const unlockReport = useDamageStore((s) => s.unlockReport);

  // Bersihkan sesi tertunda + buka laporan AI bila pembayaran ini untuk detail.
  useEffect(() => {
    clearPendingPayment();
    if (ctx?.paymentType === 'AI_REPORT') unlockReport();
  }, [ctx, unlockReport]);

  const handleContinue = () => {
    navigate(ctx?.redirectRoute ?? ROUTES.home, { replace: true, state: ctx?.redirectState });
  };

  const buttonLabel =
    ctx?.paymentType === 'AI_REPORT'
      ? 'Lihat Hasil Lengkap'
      : ctx?.paymentType === 'TOWING'
        ? 'Kembali ke Status Towing'
        : 'Selesai';
  const receipt = ctx?.receipt;
  const orderNumber = formatOrderNumber(receipt?.orderNumber || ctx?.ticket);
  const transactionId = formatReference(receipt?.transactionId || ctx?.ticket);
  const paymentMethod = displayValue(receipt?.method || ctx?.method);
  const paymentTime = formatReceiptDateTime(receipt?.paidAt);
  const paymentStatus = formatStatus(receipt?.status);
  const total = ctx?.amount ?? 0;

  return (
    <PageContainer className="bg-neutral-200">
      <AppHeader showLogo />
      <div className="flex flex-1 flex-col items-center justify-center gap-5 bg-[#131c24] px-6">
        <div className="mb-4 flex flex-col items-center justify-center gap-2">
          <h1 className="text-20 bg-linear-to-r from-[#df953a] to-[#dfb63a] bg-clip-text font-semibold text-transparent">
            Pembayaran Berhasil
          </h1>
          <p className="text-16 text-[#94a3ae]">Order Number: #{orderNumber}</p>
          <p className="text-20 font-[600] text-[#eef4f8]">{formatCurrency(total)}</p>
        </div>
        <div className="flex w-full flex-col gap-4">
          <h1 className="text-15 font-[600] text-[#eef4f8]">Rincian Transaksi</h1>
          <div className="flex h-auto w-full flex-col items-center justify-center gap-3 rounded-md bg-[#131c24] px-2 py-4 text-left text-[14px]">
            <TransactionRow label="Status" value={paymentStatus} />
            <TransactionRow label="Metode Pembayaran" value={paymentMethod} />
            <TransactionRow label="Waktu" value={paymentTime} />
            <TransactionRow label="ID Transaksi" value={transactionId} />
            <TransactionRow label="Total" value={formatCurrency(total)} strong />
          </div>
        </div>
      </div>
      <div className="px-6 pb-8">
        <Button size="lg" onClick={handleContinue}>
          {buttonLabel}
        </Button>
      </div>
    </PageContainer>
  );
}

function TransactionRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: string;
  strong?: boolean;
}) {
  return (
    <div className="flex h-auto w-full flex-row justify-between gap-3">
      <div className="flex h-auto min-w-0 flex-1 items-center justify-start">
        <p className={strong ? 'font-[600] text-[#aebbc4]' : ''}>{label}</p>
      </div>
      <div className="flex h-auto min-w-0 flex-1 items-center justify-end">
        <p
          className={
            strong ? 'truncate text-right font-[600] text-[#aebbc4]' : 'truncate text-right'
          }
        >
          {value}
        </p>
      </div>
    </div>
  );
}
