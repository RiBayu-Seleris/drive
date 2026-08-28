import { useNavigate } from 'react-router-dom';
import { toast } from '@/components/feedback/toast';
import { cn } from '@/lib/utils/cn';
import type { QuickAction } from '../types';

/** Grid aksi cepat (3 kolom). Aksi tanpa `to` menampilkan toast "segera hadir". */
export function QuickActionGrid({ actions }: { actions: QuickAction[] }) {
  const navigate = useNavigate();
  return (
    <div className="grid grid-cols-3 gap-3">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.key}
            type="button"
            onClick={() =>
              action.to ? navigate(action.to) : toast.info('Fitur ini segera hadir.')
            }
            className="drive-card flex flex-col items-center justify-between gap-2.5 rounded-2xl p-3.5 text-center transition active:scale-95"
          >
            {action.image ? (
              <span className="grid h-14 place-items-center">
                <img src={action.image} alt="" className="max-h-14 w-auto max-w-18" />
              </span>
            ) : (
              Icon && (
                <span className={cn('grid size-12 place-items-center rounded-xl', action.tint)}>
                  <Icon className="size-6" />
                </span>
              )
            )}
            <span className="text-12 leading-tight font-medium text-neutral-600">
              {action.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
