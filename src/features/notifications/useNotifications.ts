import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { buildPath, ROUTES } from '@/app/routes';
import { formatDate } from '@/lib/utils/format';
import { useAuthStore } from '@/features/auth/store/authStore';
import { getPendingPolicyTransfers } from '@/features/insurance/api';
import { getTowingOrders } from '@/features/towing/api/towingApi';
import { isTowingActive, isTowingSearching, towingStatusLabel } from '@/features/towing/types';
import { claimStatusLabel, getClaims } from '@/features/claim/api';
import { useNotificationReadStore } from './readStore';

export type NotificationTone = 'brand' | 'info' | 'warning';

export interface AppNotification {
  /*
   * Id memuat status, bukan hanya nomor dokumen: klaim yang berpindah dari
   * "Sedang Ditinjau" ke "Disetujui" menghasilkan id baru, jadi ia kembali
   * tampil belum dibaca. Kalau id-nya cuma nomor klaim, kabar terpenting
   * justru datang dalam keadaan sudah dianggap terbaca.
   */
  id: string;
  title: string;
  body: string;
  /** Waktu kejadian, kalau sumbernya punya. */
  at?: string;
  tone: NotificationTone;
  /** Tujuan saat notifikasi ditekan. */
  to: string;
}

/** Klaim yang statusnya sudah menjadi kabar untuk user; sisanya masih berjalan. */
const CLAIM_NEWSWORTHY = new Set(['APPROVED', 'REJECTED', 'COMPLETED']);

function byNewest(a: AppNotification, b: AppNotification): number {
  return new Date(b.at ?? 0).getTime() - new Date(a.at ?? 0).getTime();
}

/**
 * Menyusun notifikasi dari keadaan yang sudah diketahui aplikasi.
 *
 * Sumbernya sengaja memakai queryKey yang sama dengan halaman lain, jadi
 * react-query memakai ulang datanya alih-alih menembak ulang endpoint.
 */
export function useNotifications() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const readIds = useNotificationReadStore((s) => s.ids);
  const setScope = useNotificationReadStore((s) => s.setScope);
  const markRead = useNotificationReadStore((s) => s.markRead);

  // Email dipakai sebagai pemisah akun: `User` tidak membawa id, dan email
  // sudah cukup unik untuk memisahkan tanda-baca antar akun di satu perangkat.
  useEffect(() => {
    setScope(user?.email ?? 'anon');
  }, [setScope, user?.email]);

  const shared = { enabled: isAuthenticated, staleTime: 60_000 };
  const transfers = useQuery({
    queryKey: ['policy-transfers-pending'],
    queryFn: getPendingPolicyTransfers,
    ...shared,
  });
  const towing = useQuery({ queryKey: ['towing-orders'], queryFn: getTowingOrders, ...shared });
  const claims = useQuery({ queryKey: ['claims'], queryFn: getClaims, ...shared });

  const items = useMemo(() => {
    const list: AppNotification[] = [];

    for (const transfer of transfers.data ?? []) {
      list.push({
        id: `transfer:${transfer.policyNumber}`,
        title: 'Polis menunggu diambil alih',
        body: `${transfer.productName} untuk ${transfer.vehiclePlate}. Ambil alih sebelum ${formatDate(transfer.deadlineAt)}, setelah itu polisnya hangus.`,
        at: transfer.startedAt,
        tone: 'brand',
        to: ROUTES.policyTakeover,
      });
    }

    for (const order of towing.data ?? []) {
      if (!isTowingSearching(order.status) && !isTowingActive(order.status)) continue;
      list.push({
        id: `towing:${order.orderCode}:${order.status}`,
        title: towingStatusLabel(order.status),
        body: `Order derek ${order.orderCode}. Ketuk untuk melihat posisinya.`,
        at: order.requestedAt,
        tone: 'info',
        to: buildPath.towingStatus(order.orderCode),
      });
    }

    for (const claim of claims.data ?? []) {
      if (!CLAIM_NEWSWORTHY.has(claim.status)) continue;
      list.push({
        id: `claim:${claim.claimNumber}:${claim.status}`,
        title: `Klaim ${claimStatusLabel(claim.status)}`,
        body: `${claim.claimNumber} · ${claim.vehiclePlate || 'kendaraan Anda'}`,
        at: claim.createdAt,
        tone: claim.status === 'REJECTED' ? 'warning' : 'brand',
        to: ROUTES.claims,
      });
    }

    return list.sort(byNewest);
  }, [transfers.data, towing.data, claims.data]);

  const unreadCount = items.filter((item) => !readIds.includes(item.id)).length;

  return {
    items,
    readIds,
    unreadCount,
    isLoading: transfers.isLoading || towing.isLoading || claims.isLoading,
    markAllRead: () => markRead(items.map((item) => item.id)),
  };
}
