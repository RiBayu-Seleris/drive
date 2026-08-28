import { ArrowDownToLine, Truck } from 'lucide-react';

function rupiah(n: number): string {
  return 'Rp ' + n.toLocaleString('id-ID');
}

const CIRCLE_CLASS =
  'grid size-11 place-items-center rounded-full border border-neutral-300 bg-neutral-200 text-deep-blue-500';

/** Kartu saldo di Home mitra: label, nominal, dan tombol tarik saldo. */
export function BalanceCard({ amount, onWithdraw }: { amount: number; onWithdraw?: () => void }) {
  return (
    <div className="drive-card rounded-2xl p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-12 text-neutral-500">Saldo saat ini</p>
          {/* Nominal memakai hijau merek, bukan salmon `#e7796a` bawaan desain
              lama — saldo itu kabar baik, bukan peringatan. */}
          <p className="text-deep-blue-500 mt-1 text-[19px] font-bold">{rupiah(amount)}</p>
        </div>
        <div className="flex shrink-0 gap-2.5">
          <span className={CIRCLE_CLASS} aria-hidden>
            <Truck className="size-5" />
          </span>
          <button
            type="button"
            onClick={onWithdraw}
            aria-label="Tarik saldo"
            className={`${CIRCLE_CLASS} transition active:scale-95`}
          >
            <ArrowDownToLine className="size-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
