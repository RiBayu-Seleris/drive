import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldCheck, Truck, TriangleAlert } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { AppHeader } from '@/components/layout/AppHeader';
import { PageContainer } from '@/components/layout/PageContainer';
import { EmptyState } from '@/components/feedback/StateViews';
import { LoadingState } from '@/components/ui/Spinner';
import { cn } from '@/lib/utils/cn';
import { formatRelativeTime } from '@/lib/utils/format';
import { useNotifications, type AppNotification } from '../useNotifications';

const TONE_STYLE: Record<AppNotification['tone'], { chip: string; icon: LucideIcon }> = {
  brand: { chip: 'bg-[#1a2a0d] text-[#aded1f]', icon: ShieldCheck },
  info: { chip: 'bg-[#122130] text-[#6fb7ff]', icon: Truck },
  warning: { chip: 'bg-[#2a1c12] text-[#e7a76a]', icon: TriangleAlert },
};

export function NotificationsPage() {
  const navigate = useNavigate();
  const { items, readIds, unreadCount, isLoading, markAllRead } = useNotifications();

  // Dibuka = dibaca. Ditandai setelah daftarnya siap supaya yang datang saat
  // halaman masih memuat tidak ikut tertandai diam-diam.
  useEffect(() => {
    if (!isLoading && items.length > 0) markAllRead();
    // markAllRead berubah tiap render; yang menentukan cuma isi daftarnya.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, items.map((item) => item.id).join('|')]);

  return (
    <PageContainer>
      <AppHeader title="Notifikasi" />
      <div className="flex flex-1 flex-col gap-3 px-5 py-5">
        {isLoading && items.length === 0 && <LoadingState label="Memuat notifikasi…" />}

        {!isLoading && items.length === 0 && (
          <EmptyState
            title="Belum ada notifikasi"
            description="Kabar tentang polis, klaim, dan derek Anda akan muncul di sini."
          />
        )}

        {items.map((item) => {
          const tone = TONE_STYLE[item.tone];
          const Icon = tone.icon;
          const unread = !readIds.includes(item.id);
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => navigate(item.to)}
              className={cn(
                'flex items-start gap-3 rounded-xl border bg-neutral-200 p-4 text-left transition active:scale-[0.99]',
                unread ? 'border-[#aded1f]/45' : 'border-[#22313c]',
              )}
            >
              <span className={cn('grid size-10 shrink-0 place-items-center rounded-full', tone.chip)}>
                <Icon className="size-5" aria-hidden />
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className="text-14 font-semibold text-neutral-900">{item.title}</span>
                  {unread && <span className="size-1.5 shrink-0 rounded-full bg-[#aded1f]" />}
                </span>
                <span className="text-12 mt-1 block leading-relaxed text-neutral-700">
                  {item.body}
                </span>
                {item.at && (
                  <span className="text-11 mt-1.5 block text-neutral-600">
                    {formatRelativeTime(item.at)}
                  </span>
                )}
              </span>
            </button>
          );
        })}

        {unreadCount > 0 && <span className="sr-only">{unreadCount} notifikasi belum dibaca</span>}
      </div>
    </PageContainer>
  );
}
