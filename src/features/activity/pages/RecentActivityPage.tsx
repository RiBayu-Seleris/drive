import { useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Heart,
  LockKeyhole,
  Search,
  ShieldCheck,
  SquarePlus,
  WalletCards,
} from 'lucide-react';
import LeftSVG from '/assets/history-checkup/left.svg';
import RightSVG from '/assets/history-checkup/right.svg';
import { useMutation, useQuery } from '@tanstack/react-query';
import { PageContainer } from '@/components/layout/PageContainer';
import { AppHeader } from '@/components/layout/AppHeader';
import { Skeleton } from '@/components/ui/Skeleton';
import { EmptyState, ErrorState } from '@/components/feedback/StateViews';
import { toast } from '@/components/feedback/toast';
import { ROUTES } from '@/app/routes';
import { fetchDamageDetail } from '@/features/damage/api/damageApi';
import { useDamageStore } from '@/features/damage/store/damageStore';
import { getActivities, getPaymentHistory } from '../api';
import type { Activity, PaymentHistory } from '../types';

type Tab = 'payment' | 'activity';

const MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

const ACTIVITY_ICONS = [Search, ShieldCheck, SquarePlus, Heart, LockKeyhole] as const;

function dateParts(date: Date) {
  const prev = new Date(date);
  prev.setDate(prev.getDate() - 1);
  const next = new Date(date);
  next.setDate(next.getDate() + 1);
  return {
    prev,
    current: date,
    next,
    month: MONTHS[date.getMonth()] ?? '',
    year: date.getFullYear(),
  };
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function isAfterToday(date: Date): boolean {
  return startOfDay(date).getTime() > startOfDay(new Date()).getTime();
}

function formatQueryDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function formatDateOnly(input: string): string {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(date);
}

function formatTimeOnly(input: string): string {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  }).format(date);
}

function formatSignedIDR(value: number): string {
  const amount = Math.abs(Math.round(value));
  const formatted = amount.toLocaleString('id-ID');
  return value < 0 ? `-Rp ${formatted}` : `Rp ${formatted}`;
}

function getInitialTab(state: unknown): Tab {
  const tab =
    state && typeof state === 'object' && 'tab' in state
      ? (state as { tab?: unknown }).tab
      : undefined;
  return tab === 'payment' || tab === 'activity' ? tab : 'activity';
}

export function RecentActivityPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const setDamageResult = useDamageStore((state) => state.setResult);
  const setDamageViewMode = useDamageStore((state) => state.setViewMode);
  const [activeTab, setActiveTab] = useState<Tab>(() => getInitialTab(location.state));
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const parts = useMemo(() => dateParts(currentDate), [currentDate]);
  const selectedDate = useMemo(() => formatQueryDate(currentDate), [currentDate]);
  const nextDateDisabled = isAfterToday(parts.next);

  const activities = useQuery({
    queryKey: ['activities', selectedDate],
    queryFn: () => getActivities(selectedDate),
  });
  const payments = useQuery({
    queryKey: ['payment-history', selectedDate],
    queryFn: () => getPaymentHistory(selectedDate),
  });

  const openActivity = useMutation({
    mutationFn: fetchDamageDetail,
    onSuccess: (result) => {
      setDamageViewMode('history');
      setDamageResult(result);
      navigate(ROUTES.damageAnalysis, { state: { source: 'recent_activity' } });
    },
    onError: () => toast.error('Gagal membuka hasil checkup.'),
  });

  const moveDay = (offset: number) => {
    setCurrentDate((date) => {
      const next = new Date(date);
      next.setDate(next.getDate() + offset);
      return isAfterToday(next) ? new Date() : next;
    });
  };

  return (
    <PageContainer>
      <AppHeader showLogo />
      <main className="min-h-screen bg-[#131c24]">
        <section className="relative bg-gradient-to-b from-[#0f1720] to-[#131c24] px-8 py-7">
          <div className="pointer-events-none absolute -bottom-11 -left-3 h-auto w-auto">
            <img src={LeftSVG} alt="" srcSet="" />
          </div>
          <div className="pointer-events-none absolute -right-3 -bottom-11 h-auto w-auto">
            <img src={RightSVG} alt="" srcSet="" />
          </div>

          <div className="relative mx-auto mb-6 grid w-fit grid-cols-2 rounded-[20px] bg-neutral-100 p-1 shadow-[0_2px_8px_rgb(15_23_42_/_0.12)]">
            <HistoryTabButton
              active={activeTab === 'payment'}
              onClick={() => setActiveTab('payment')}
            >
              History
              <br />
              Pembayaran
            </HistoryTabButton>
            <HistoryTabButton
              active={activeTab === 'activity'}
              onClick={() => setActiveTab('activity')}
            >
              Aktifitas
              <br />
              Terkini
            </HistoryTabButton>
          </div>

          <div className="relative flex items-center justify-between">
            <button
              type="button"
              onClick={() => moveDay(-1)}
              className="bg-deep-blue-500 flex size-7 items-center justify-center rounded-full text-[#10200a] shadow-sm"
              aria-label="Tanggal sebelumnya"
            >
              <ChevronLeft className="size-5" />
            </button>

            <div className="text-deep-blue-500 min-w-0 px-3 text-center">
              <div className="grid grid-cols-[54px_82px_54px] items-end justify-center gap-3">
                <CalendarSideDate date={parts.prev} month={parts.month} year={parts.year} />
                <div>
                  <div className="text-[58px] leading-none font-bold">
                    {String(parts.current.getDate()).padStart(2, '0')}
                  </div>
                </div>
                <CalendarSideDate
                  date={parts.next}
                  month={parts.month}
                  year={parts.year}
                  disabled={nextDateDisabled}
                />
              </div>
              <div className="mt-0 text-[18px] font-medium">
                {parts.month} {parts.year}
              </div>
            </div>

            <button
              type="button"
              onClick={() => moveDay(1)}
              disabled={nextDateDisabled}
              className={[
                'flex size-7 items-center justify-center rounded-full text-white shadow-sm',
                nextDateDisabled ? 'bg-neutral-300 text-neutral-500' : 'bg-deep-blue-500',
              ].join(' ')}
              aria-label="Tanggal berikutnya"
            >
              <ChevronRight className="size-5" />
            </button>
          </div>
        </section>

        <section className="mt-1 bg-[#131c24] px-5 pb-10">
          {activeTab === 'payment' ? (
            <PaymentPanel
              items={payments.data ?? []}
              loading={payments.isLoading}
              error={payments.isError}
              onRetry={() => void payments.refetch()}
            />
          ) : (
            <ActivityPanel
              items={activities.data ?? []}
              loading={activities.isLoading}
              error={activities.isError}
              opening={openActivity.isPending}
              onRetry={() => void activities.refetch()}
              onOpen={(ticket) => openActivity.mutate(ticket)}
            />
          )}
        </section>
      </main>
    </PageContainer>
  );
}

function HistoryTabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        'h-12 w-[96px] rounded-[18px] text-center text-[11px] leading-tight font-medium transition-colors',
        active ? 'bg-deep-blue-500 text-[#10200a] shadow-md' : 'bg-neutral-100 text-neutral-900',
      ].join(' ')}
    >
      {children}
    </button>
  );
}

function CalendarSideDate({
  date,
  month,
  year,
  disabled = false,
}: {
  date: Date;
  month: string;
  year: number;
  disabled?: boolean;
}) {
  return (
    <div className={['pb-1 text-center', disabled ? 'opacity-40' : ''].join(' ')}>
      <div className="text-[16px] leading-none font-semibold opacity-80">
        {String(date.getDate()).padStart(2, '0')}
      </div>
      <div className="mt-1 text-[7px] leading-tight opacity-80">
        {month} {year}
      </div>
    </div>
  );
}

function ActivityPanel({
  items,
  loading,
  error,
  opening,
  onRetry,
  onOpen,
}: {
  items: Activity[];
  loading: boolean;
  error: boolean;
  opening: boolean;
  onRetry: () => void;
  onOpen: (ticket: string) => void;
}) {
  return (
    <div className="drive-card rounded-xl px-3 py-5 shadow-[0_8px_22px_rgb(15_23_42_/_0.08)]">
      <h1 className="mb-4 text-[14px] font-semibold text-neutral-900">Aktifitas Terkini</h1>
      {loading ? (
        <ActivitySkeleton />
      ) : error ? (
        <ErrorState onRetry={onRetry} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<Search className="size-7" />}
          title="Belum ada aktifitas"
          description="Aktifitas pada tanggal ini akan tampil di sini."
        />
      ) : (
        <div>
          {items.map((item, index) => (
            <ActivityRow
              key={`${item.ticket || item.createdAt}-${index}`}
              item={item}
              index={index}
              disabled={!item.ticket || opening}
              isLast={index === items.length - 1}
              onOpen={() => {
                if (!item.ticket) {
                  toast.error('Ticket checkup tidak ditemukan.');
                  return;
                }
                onOpen(item.ticket);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ActivityRow({
  item,
  index,
  disabled,
  isLast,
  onOpen,
}: {
  item: Activity;
  index: number;
  disabled: boolean;
  isLast: boolean;
  onOpen: () => void;
}) {
  const Icon = ACTIVITY_ICONS[index % ACTIVITY_ICONS.length] ?? Search;
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onOpen}
      className="w-full text-left disabled:cursor-not-allowed disabled:opacity-70"
    >
      <div className="flex gap-3">
        <div className="bg-deep-blue-50 text-deep-blue-500 border-deep-blue-100 mt-1 flex size-8 shrink-0 items-center justify-center rounded-full border">
          <Icon className="size-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[14px] leading-snug font-medium text-neutral-900">{item.title}</p>
          <p className="mt-1 text-[11px] text-neutral-700">{formatDateOnly(item.createdAt)}</p>
          {!isLast && <div className="mt-3 h-px w-full bg-neutral-300" />}
        </div>
      </div>
    </button>
  );
}

function PaymentPanel({
  items,
  loading,
  error,
  onRetry,
}: {
  items: PaymentHistory[];
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  return (
    <div className="bg-neutral-100 px-0 py-5">
      <h1 className="mb-4 px-1 text-[14px] font-semibold text-neutral-900">History Pembayaran</h1>
      {loading ? (
        <PaymentSkeleton />
      ) : error ? (
        <ErrorState onRetry={onRetry} />
      ) : items.length === 0 ? (
        <EmptyState
          icon={<WalletCards className="size-7" />}
          title="Belum ada pembayaran"
          description="Pembayaran pada tanggal ini akan tampil di sini."
        />
      ) : (
        <div>
          {items.map((item, index) => (
            <PaymentRow key={`${item.id}-${index}`} item={item} index={index} />
          ))}
        </div>
      )}
    </div>
  );
}

function PaymentRow({ item, index }: { item: PaymentHistory; index: number }) {
  const isInsurance = index % 2 === 0;
  const amount = item.amount > 0 ? -item.amount : item.amount;
  return (
    <div className="mb-4 flex items-center gap-3">
      <div
        className={[
          'flex size-8 shrink-0 items-center justify-center rounded-full',
          isInsurance ? 'bg-[#131c24] text-[#e7716a]' : 'bg-[#131c24] text-[#e7946a]',
        ].join(' ')}
      >
        <WalletCards className="size-4" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-medium text-neutral-900">{item.title}</p>
        <div className="mt-1 grid grid-cols-2 text-[10px] text-neutral-600">
          <span>{formatDateOnly(item.createdAt)}</span>
          <span className="text-right">{formatTimeOnly(item.createdAt)}</span>
        </div>
      </div>
      <p className="w-[74px] shrink-0 text-right text-[11px] font-semibold text-[#e7716a]">
        {formatSignedIDR(amount)}
      </p>
    </div>
  );
}

function ActivitySkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="flex gap-3">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-full rounded" />
            <Skeleton className="h-3 w-28 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

function PaymentSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className="flex items-center gap-3">
          <Skeleton className="size-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-40 rounded" />
            <Skeleton className="h-3 w-32 rounded" />
          </div>
          <Skeleton className="h-4 w-16 rounded" />
        </div>
      ))}
    </div>
  );
}
