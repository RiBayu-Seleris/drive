import { useNavigate } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import { cn } from '@/lib/utils/cn';
import { useNotifications } from '../useNotifications';

/** Lonceng di beranda; angkanya = notifikasi yang belum dibuka di perangkat ini. */
export function NotificationBell({ className }: { className?: string }) {
  const navigate = useNavigate();
  const { unreadCount } = useNotifications();

  return (
    <button
      type="button"
      onClick={() => navigate(ROUTES.notifications)}
      aria-label={unreadCount > 0 ? `Notifikasi, ${unreadCount} belum dibaca` : 'Notifikasi'}
      className={cn(
        'relative grid size-10 shrink-0 place-items-center rounded-full border border-[#22313c] bg-[#0b1218]/80 text-neutral-900 backdrop-blur transition active:scale-95',
        className,
      )}
    >
      <Bell className="size-[18px]" aria-hidden />
      {unreadCount > 0 && (
        <span className="absolute -top-1 -right-1 grid min-w-[18px] place-items-center rounded-full bg-[#aded1f] px-1 text-[10px] leading-[18px] font-bold text-[#10200a]">
          {unreadCount > 9 ? '9+' : unreadCount}
        </span>
      )}
    </button>
  );
}
