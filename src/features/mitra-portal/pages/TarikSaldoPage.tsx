import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Wallet } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingState } from '@/components/ui/Spinner';
import { toast } from '@/components/feedback/toast';
import { extractErrorMessage } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';
import { MitraShell } from '../components/MitraShell';
import {
  createMitraBankAccount,
  getDisbursementBanks,
  getMitraBankAccounts,
  type DisbursementBank,
  getMitraSaldo,
  requestMitraWithdrawal,
} from '../financeApi';
import { WITHDRAW_ADMIN_FEE, WITHDRAW_QUICK_AMOUNTS } from '../data/financeMock';
import type { BankAccount } from '../types';

function rupiah(value: number): string {
  return 'Rp ' + value.toLocaleString('id-ID');
}

function quickLabel(value: number): string {
  if (value >= 1_000_000) return `Rp ${value / 1_000_000}jt`;
  return `Rp ${value / 1_000}rb`;
}

/** Form penarikan saldo ke rekening bank (sesuai desain "Tarik Saldo"). */
export function TarikSaldoPage() {
  const navigate = useNavigate();
  const [balance, setBalance] = useState(0);
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [bankId, setBankId] = useState('');
  const [amount, setAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [addingBank, setAddingBank] = useState(false);
  const [savingBank, setSavingBank] = useState(false);
  const [bankCode, setBankCode] = useState('');
  const [bankNumber, setBankNumber] = useState('');
  const [bankHolder, setBankHolder] = useState('');
  const [bankOptions, setBankOptions] = useState<DisbursementBank[]>([]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    Promise.all([getMitraSaldo(), getMitraBankAccounts()])
      .then(([saldo, bankList]) => {
        if (!active) return;
        setBalance(saldo.balance);
        setBanks(bankList);
        setBankId(bankList[0]?.id ?? '');
      })
      .catch((error) => toast.error(extractErrorMessage(error, 'Gagal memuat data penarikan.')))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const submit = async () => {
    if (amount < 50_000) {
      toast.error('Minimum penarikan Rp 50.000.');
      return;
    }
    if (amount + WITHDRAW_ADMIN_FEE > balance) {
      toast.error('Nominal dan biaya admin melebihi saldo tersedia.');
      return;
    }
    if (!bankId) {
      toast.error('Pilih rekening tujuan dulu.');
      return;
    }
    setSubmitting(true);
    try {
      await requestMitraWithdrawal({ bankAccountId: bankId, amount });
      toast.success('Permintaan tarik saldo dikirim.');
      navigate(ROUTES.mitraSaldo, { replace: true });
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Gagal mengajukan penarikan.'));
    } finally {
      setSubmitting(false);
    }
  };

  // Daftar bank dimuat saat formnya dibuka, bukan saat halaman dibuka:
  // sebagian besar kunjungan ke halaman ini tidak menambah rekening.
  useEffect(() => {
    if (!addingBank || bankOptions.length > 0) return;
    let active = true;
    getDisbursementBanks()
      .then((list) => {
        if (active) setBankOptions(list);
      })
      .catch((error) =>
        toast.error(extractErrorMessage(error, 'Daftar bank gagal dimuat.')),
      );
    return () => {
      active = false;
    };
  }, [addingBank, bankOptions.length]);

  const saveBank = async () => {
    const chosen = bankOptions.find((bank) => bank.code === bankCode);
    if (!chosen || !bankNumber.trim() || !bankHolder.trim()) {
      toast.error('Pilih bank, lalu lengkapi nomor rekening dan pemilik rekening.');
      return;
    }
    setSavingBank(true);
    try {
      const created = await createMitraBankAccount({
        bank: chosen.name,
        bankCode: chosen.code,
        number: bankNumber.replace(/\D/g, ''),
        holder: bankHolder.trim(),
      });
      setBanks((current) => [created, ...current]);
      setBankId(created.id);
      setBankCode('');
      setBankNumber('');
      setBankHolder('');
      setAddingBank(false);
      toast.success('Rekening berhasil ditambahkan.');
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Gagal menambah rekening.'));
    } finally {
      setSavingBank(false);
    }
  };

  if (loading) {
    return (
      <MitraShell hideNav>
        <AppHeader title="Tarik Saldo" />
        <LoadingState label="Memuat data penarikan…" />
      </MitraShell>
    );
  }

  return (
    <MitraShell hideNav>
      <AppHeader title="Tarik Saldo" />

      <div className="px-5 py-4 pb-32">
        {/* Hero saldo — navy sesuai desain "Tarik Saldo" */}
        <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-[#aded1f] to-[#aded1f] p-5 text-white shadow-lg">
          <p className="text-12 text-white/70">Saldo Tersedia</p>
          <p className="mt-1 text-3xl font-bold">{rupiah(balance)}</p>
          <Wallet
            className="absolute top-1/2 -right-2 size-20 -translate-y-1/2 text-white/10"
            strokeWidth={1}
          />
        </div>

        {/* Pilih rekening */}
        <div className="mt-5 flex items-center justify-between">
          <h2 className="text-deep-blue-600 text-16 font-bold">Pilih Rekening</h2>
          <button
            type="button"
            onClick={() => setAddingBank((open) => !open)}
            className="text-deep-blue-500 text-12 flex items-center gap-1 font-semibold"
          >
            <Plus className="size-4" /> Tambah
          </button>
        </div>
        {addingBank && (
          <div className="drive-card mt-3 space-y-3 rounded-2xl border border-neutral-200 p-4">
            <div>
              <label className="text-14 mb-1.5 block font-medium text-neutral-900">
                Bank
              </label>
              <select
                value={bankCode}
                onChange={(event) => setBankCode(event.target.value)}
                className="text-14 w-full rounded-lg border border-neutral-400 bg-neutral-200 px-3 py-2.5 text-neutral-900"
              >
                <option value="">
                  {bankOptions.length === 0 ? 'Memuat daftar bank…' : 'Pilih bank'}
                </option>
                {bankOptions.map((bank) => (
                  <option key={bank.code} value={bank.code}>
                    {bank.name}
                  </option>
                ))}
              </select>
              {/*
                Dipilih dari daftar, bukan diketik: transfer otomatis memakai
                kode resmi bank. Nama yang diketik sendiri bisa gagal terkirim,
                atau lebih buruk, cocok dengan bank yang berbeda.
              */}
              <p className="text-12 mt-1 text-neutral-700">
                Pilih dari daftar agar dana bisa ditransfer otomatis.
              </p>
            </div>
            <Input
              label="Nomor Rekening"
              inputMode="numeric"
              placeholder="1234567890"
              value={bankNumber}
              onChange={(event) => setBankNumber(event.target.value.replace(/\D/g, ''))}
            />
            <Input
              label="Nama Pemilik"
              placeholder="PT Towing Sejahtera"
              value={bankHolder}
              onChange={(event) => setBankHolder(event.target.value)}
            />
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                fullWidth={false}
                variant="outline"
                onClick={() => setAddingBank(false)}
              >
                Batal
              </Button>
              <Button
                type="button"
                fullWidth={false}
                isLoading={savingBank}
                onClick={() => void saveBank()}
              >
                Simpan
              </Button>
            </div>
          </div>
        )}
        <div className="mt-3 space-y-3">
          {banks.length === 0 && (
            <div className="drive-card rounded-2xl border border-dashed border-neutral-300 p-4 text-center">
              <p className="text-12 font-medium text-neutral-700">Belum ada rekening tujuan.</p>
              <p className="mt-1 text-[11px] text-neutral-500">
                Tambahkan rekening sebelum mengajukan penarikan saldo.
              </p>
            </div>
          )}
          {banks.map((bank) => {
            const active = bank.id === bankId;
            return (
              <button
                key={bank.id}
                type="button"
                onClick={() => setBankId(bank.id)}
                className={cn(
                  'drive-card flex w-full items-center justify-between rounded-2xl border p-4 text-left transition',
                  active ? 'border-deep-blue-500 ring-deep-blue-100 ring-2' : 'border-neutral-300',
                )}
              >
                <div>
                  <p className="text-14 font-semibold text-neutral-900">{bank.bank}</p>
                  <p className="text-[11px] text-neutral-500">
                    {bank.number} • {bank.holder}
                  </p>
                </div>
                <span
                  className={cn(
                    'grid size-5 place-items-center rounded-full border-2',
                    active ? 'border-deep-blue-500' : 'border-neutral-300',
                  )}
                >
                  {active && <span className="bg-deep-blue-500 size-2.5 rounded-full" />}
                </span>
              </button>
            );
          })}
        </div>

        {/* Nominal */}
        <div className="mt-5 flex items-center justify-between">
          <h2 className="text-deep-blue-600 text-16 font-bold">Nominal</h2>
          <button
            type="button"
            onClick={() => setAmount(Math.max(balance - WITHDRAW_ADMIN_FEE, 0))}
            className="text-deep-blue-500 text-12 font-semibold"
          >
            Tarik Semua
          </button>
        </div>
        <div className="drive-card mt-3 rounded-2xl border border-neutral-200 p-4">
          <div className="flex items-center gap-2 border-b border-neutral-200 pb-3">
            <span className="text-2xl font-semibold text-neutral-400">Rp</span>
            <input
              inputMode="numeric"
              value={amount === 0 ? '' : amount.toLocaleString('id-ID')}
              onChange={(e) => {
                const digits = e.target.value.replace(/\D/g, '');
                setAmount(digits ? Number(digits) : 0);
              }}
              placeholder="0"
              className="w-full bg-transparent text-2xl font-semibold text-neutral-900 placeholder:text-neutral-300 focus:outline-none"
            />
          </div>
          <div className="mt-3 flex [scrollbar-width:none] gap-2 overflow-x-auto [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            {WITHDRAW_QUICK_AMOUNTS.map((value) => (
              <button
                key={value}
                type="button"
                onClick={() => setAmount(value)}
                className="text-12 shrink-0 rounded-full border border-neutral-200 px-3 py-1.5 font-medium text-neutral-700 hover:bg-neutral-50"
              >
                {quickLabel(value)}
              </button>
            ))}
          </div>
        </div>

        {/* Info biaya admin */}
        <div className="drive-card text-12 mt-4 flex gap-2 rounded-xl p-3 text-neutral-600">
          <span className="bg-deep-blue-500 mt-0.5 grid size-4 shrink-0 place-items-center rounded-full text-[10px] font-bold text-[#10200a]">
            i
          </span>
          Biaya admin penarikan ke rekening Bank Lain akan dikenakan {rupiah(WITHDRAW_ADMIN_FEE)}.
        </div>
      </div>

      {/* Bar aksi sticky */}
      <div className="pb-safe fixed bottom-5 left-1/2 z-50 w-full max-w-md -translate-x-1/2 border-t border-neutral-200 bg-neutral-100 px-5 pt-3 pb-4 shadow-[0_-4px_14px_rgba(0,0,0,0.06)]">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-12 text-neutral-500">Total Penarikan</span>
          <span className="text-deep-blue-600 text-16 font-bold">{rupiah(amount)}</span>
        </div>
        <Button onClick={submit} isLoading={submitting}>
          Lanjut
        </Button>
      </div>
    </MitraShell>
  );
}
