import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  BadgeCheck,
  ChevronRight,
  Clock,
  CreditCard,
  ReceiptText,
  ShieldCheck,
  User,
  Wallet,
  Wrench,
  type LucideIcon,
} from 'lucide-react';
import { ROUTES } from '@/app/routes';
import { AppHeader } from '@/components/layout/AppHeader';
import { LoadingState } from '@/components/ui/Spinner';
import { toast } from '@/components/feedback/toast';
import { extractErrorMessage } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';
import { MitraShell } from '../components/MitraShell';
import { getMitraSaldo, type MitraSaldoResult } from '../financeApi';
import type { SaldoTx } from '../types';

function rupiah(value: number): string {
  return 'Rp' + Math.abs(value).toLocaleString('id-ID');
}

const PREVIEW_COUNT = 4;

/** Halaman Saldo mitra — mengikuti desain "Saldo" (total, aksi cepat, transaksi). */
export function SaldoPage() {
  const navigate = useNavigate();
  const [saldo, setSaldo] = useState<MitraSaldoResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    getMitraSaldo()
      .then((res) => {
        if (active) setSaldo(res);
      })
      .catch((error) => toast.error(extractErrorMessage(error, 'Gagal memuat saldo.')))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const transactions = useMemo(() => saldo?.transactions ?? [], [saldo]);
  const list = showAll ? transactions : transactions.slice(0, PREVIEW_COUNT);

  return (
    <MitraShell>
      <AppHeader title="Saldo" />

      {loading ? (
        <LoadingState label="Memuat saldo…" />
      ) : (
        <div className="px-5 py-4">
          {/* Kartu total saldo (navy, sesuai desain) */}
          <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-[#c2f347] to-[#83bd04] p-5 text-on-brand shadow-lg">
            <p className="text-12 text-on-brand/70">Total Saldo</p>
            <p className="mt-1 flex items-baseline gap-1.5">
              <span className="text-14 font-semibold text-on-brand/75">Rp</span>
              <span className="text-3xl font-bold tracking-tight">
                {(saldo?.balance ?? 0).toLocaleString('id-ID')}
              </span>
            </p>
            <span className="text-[11px] mt-4 inline-flex items-center gap-1.5 rounded-full bg-on-brand/12 px-3 py-1.5 font-medium">
              <BadgeCheck className="size-3.5" />
              Akun Terverifikasi
            </span>
          </div>

          {/* Porsi asuransi yang menunggu pencairan (belum bisa ditarik) */}
          {(saldo?.pendingInsurance ?? 0) > 0 && (
            <div className="mt-3 flex items-start gap-3 rounded-2xl border border-warning/30 bg-warning/15 p-3.5">
              <span className="bg-warning/15 text-warning grid size-9 shrink-0 place-items-center rounded-full">
                <Clock className="size-5" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-12 font-semibold text-neutral-900">Menunggu Pencairan Asuransi</p>
                <p className="text-[11px] mt-0.5 text-neutral-600">
                  Dana ditanggung asuransi, masuk saldo setelah dicairkan.
                </p>
              </div>
              <p className="text-14 shrink-0 font-bold text-neutral-900">
                {rupiah(saldo?.pendingInsurance ?? 0)}
              </p>
            </div>
          )}

          {/* Aksi cepat: Tarik Saldo / Riwayat / Akun */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            <SaldoTile
              icon={Wallet}
              label="Tarik Saldo"
              onClick={() => navigate(ROUTES.mitraTarikSaldo)}
            />
            <SaldoTile icon={ReceiptText} label="Riwayat" onClick={() => setShowAll(true)} />
            <SaldoTile icon={User} label="Akun" onClick={() => navigate(ROUTES.mitraAkun)} />
          </div>

          {/* Transaksi terakhir */}
          <div className="mt-6 flex items-center justify-between">
            <h2 className="text-16 text-deep-blue-700 font-bold">Transaksi Terakhir</h2>
            {!showAll && transactions.length > PREVIEW_COUNT && (
              <button
                type="button"
                onClick={() => setShowAll(true)}
                className="text-deep-blue-500 text-12 flex items-center font-semibold"
              >
                Lihat Semua
                <ChevronRight className="size-4" />
              </button>
            )}
          </div>

          <div className="mt-3 space-y-3">
            {list.length === 0 ? (
              <p className="text-12 py-8 text-center text-neutral-500">Belum ada transaksi.</p>
            ) : (
              list.map((tx) => <TxCard key={tx.id} tx={tx} />)
            )}
          </div>
        </div>
      )}
    </MitraShell>
  );
}

function SaldoTile({
  icon: Icon,
  label,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="drive-card flex flex-col items-center gap-2 rounded-2xl py-4 transition active:scale-95"
    >
      <span className="bg-deep-blue-50 text-deep-blue-600 grid size-11 place-items-center rounded-full">
        <Icon className="size-5" />
      </span>
      <span className="text-12 font-medium text-neutral-700">{label}</span>
    </button>
  );
}

function txIcon(tx: SaldoTx): LucideIcon {
  if (/admin/i.test(tx.title)) return Wrench;
  return tx.amount >= 0 ? ShieldCheck : CreditCard;
}

function TxCard({ tx }: { tx: SaldoTx }) {
  const income = tx.amount >= 0;
  const Icon = txIcon(tx);
  return (
    <div className="drive-card flex items-center gap-3 rounded-2xl p-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-neutral-200 text-neutral-600">
        <Icon className="size-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-14 font-semibold text-neutral-900">{tx.title}</p>
        <p className="text-[11px] mt-0.5 text-neutral-500">{tx.date}</p>
      </div>
      <div className="shrink-0 text-right">
        <p className={cn('text-14 font-bold', income ? 'text-green-cust' : 'text-danger')}>
          {income ? '+' : '-'}
          {rupiah(tx.amount)}
        </p>
        <span
          className={cn(
            'text-10 mt-1 inline-block rounded-md px-2 py-0.5 font-bold tracking-wide',
            tx.status === 'berhasil'
              ? 'bg-green-cust/12 text-green-cust'
              : 'bg-neutral-200 text-neutral-500',
          )}
        >
          {tx.status === 'berhasil' ? 'BERHASIL' : 'PROSES'}
        </span>
      </div>
    </div>
  );
}
