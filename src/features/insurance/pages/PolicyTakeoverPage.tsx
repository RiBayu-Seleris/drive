import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CalendarClock, ShieldCheck } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { AppHeader } from '@/components/layout/AppHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { LoadingState } from '@/components/ui/Spinner';
import { EmptyState, ErrorState } from '@/components/feedback/StateViews';
import { confirm } from '@/components/feedback/confirm';
import { toast } from '@/components/feedback/toast';
import { extractErrorMessage } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';
import { formatDate } from '@/lib/utils/format';
import { ROUTES } from '@/app/routes';
import { useAuthStore } from '@/features/auth/store/authStore';
import {
  acceptPolicyTransfer,
  declinePolicyTransfer,
  getPendingPolicyTransfers,
  type PendingPolicyTransfer,
} from '../api';

const USAGE_OPTIONS = [
  { value: 'PRIVATE', label: 'Pribadi' },
  { value: 'COMMERCIAL', label: 'Usaha (rental, taksi online, angkutan)' },
];

/**
 * Pengambilalihan polis oleh pembeli kendaraan.
 *
 * Identitas diminta SEKALI di sini, bukan setiap kali klaim: berkas klaim harus
 * milik orang yang menanggung risiko saat kejadian, dan sejak mobil berpindah
 * itu adalah pembeli. Setelah halaman ini selesai, penjual tidak perlu
 * dihubungi lagi.
 */
export function PolicyTakeoverPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((state) => state.user);

  const query = useQuery({
    queryKey: ['policy-transfers-pending'],
    queryFn: getPendingPolicyTransfers,
  });
  const transfer: PendingPolicyTransfer | undefined = query.data?.[0];

  const [form, setForm] = useState({
    holderName: '',
    holderNik: '',
    holderPhone: '',
    holderEmail: '',
    holderAddress: '',
    holderCity: '',
    holderPostalCode: '',
    holderBirthDate: '',
    vehicleUsage: 'PRIVATE',
    registrationArea: '',
  });

  // Prisi dari akun & polis yang diterima supaya pembeli tidak mengetik ulang
  // apa yang sudah diketahui sistem.
  useEffect(() => {
    setForm((prev) => ({
      ...prev,
      holderName: prev.holderName || user?.fullname || '',
      holderEmail: prev.holderEmail || user?.email || '',
      holderPhone: prev.holderPhone || user?.phone || '',
      vehicleUsage: transfer?.vehicleUsage || prev.vehicleUsage,
      registrationArea: prev.registrationArea || transfer?.registrationArea || '',
    }));
  }, [user, transfer]);

  const set = (key: keyof typeof form, value: string) =>
    setForm((prev) => ({ ...prev, [key]: value }));

  const accept = useMutation({
    mutationFn: () => acceptPolicyTransfer({ policyNumber: transfer!.policyNumber, ...form }),
    onSuccess: () => {
      toast.success('Polis berpindah ke akun Anda.');
      void queryClient.invalidateQueries({ queryKey: ['policy-transfers-pending'] });
      void queryClient.invalidateQueries({ queryKey: ['insurance-policies'] });
      navigate(ROUTES.insurancePolicies, { replace: true });
    },
    onError: (error) => toast.error(extractErrorMessage(error, 'Gagal mengambil alih polis.')),
  });

  const decline = useMutation({
    mutationFn: () => declinePolicyTransfer(transfer!.policyNumber),
    onSuccess: () => {
      toast.success('Polis dikembalikan ke pemilik sebelumnya.');
      void queryClient.invalidateQueries({ queryKey: ['policy-transfers-pending'] });
      navigate(ROUTES.home, { replace: true });
    },
    onError: (error) => toast.error(extractErrorMessage(error, 'Gagal menolak polis.')),
  });

  const handleDecline = async () => {
    const ok = await confirm({
      title: 'Tolak polis ini?',
      message:
        'Polis akan dikembalikan ke pemilik sebelumnya. Kendaraan tetap menjadi milik Anda, tapi tanpa asuransi dari polis ini.',
      confirmText: 'Ya, tolak',
      tone: 'danger',
    });
    if (ok) decline.mutate();
  };

  if (query.isLoading) {
    return (
      <PageContainer>
        <AppHeader title="Ambil Alih Polis" />
        <LoadingState label="Memuat polis…" />
      </PageContainer>
    );
  }

  if (query.isError) {
    return (
      <PageContainer>
        <AppHeader title="Ambil Alih Polis" />
        <ErrorState onRetry={() => void query.refetch()} />
      </PageContainer>
    );
  }

  if (!transfer) {
    return (
      <PageContainer>
        <AppHeader title="Ambil Alih Polis" />
        <EmptyState
          title="Tidak ada polis menunggu"
          description="Polis dari kendaraan yang Anda beli akan muncul di sini setelah penjual melepasnya."
          action={
            <Button fullWidth={false} onClick={() => navigate(ROUTES.home)}>
              Kembali
            </Button>
          }
        />
      </PageContainer>
    );
  }

  const nikValid = /^\d{16}$/.test(form.holderNik.trim());
  const ready = form.holderName.trim().length > 0 && nikValid;

  return (
    <PageContainer>
      <AppHeader title="Ambil Alih Polis" />
      <div className="flex flex-1 flex-col gap-4 px-5 py-5">
        <Card className="border-deep-blue-200 bg-deep-blue-50/60">
          <div className="flex items-start gap-3">
            <span className="bg-deep-blue-500 grid size-10 shrink-0 place-items-center rounded-full text-white">
              <ShieldCheck className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-16 font-semibold text-neutral-900">{transfer.productName}</p>
              <p className="text-12 text-neutral-700">{transfer.provider}</p>
              <p className="text-12 mt-2 text-neutral-800">
                {transfer.vehiclePlate} · berlaku sampai {formatDate(transfer.endedAt)}
              </p>
            </div>
          </div>
          <p className="text-12 mt-3 flex items-center gap-1.5 border-t border-neutral-300 pt-3 text-neutral-700">
            <CalendarClock className="size-4" />
            Ambil alih sebelum {formatDate(transfer.deadlineAt)}
          </p>
        </Card>

        <div>
          <p className="text-14 font-semibold text-neutral-900">Data pemegang polis</p>
          <p className="text-12 mt-1 text-neutral-700">
            Isi dengan data Anda sendiri. Berkas ini yang dipakai saat mengajukan klaim nanti, jadi
            Anda tidak perlu menghubungi pemilik sebelumnya lagi.
          </p>
        </div>

        <Input
          label="Nama sesuai KTP"
          required
          value={form.holderName}
          onChange={(event) => set('holderName', event.target.value)}
        />
        <Input
          label="NIK"
          required
          inputMode="numeric"
          maxLength={16}
          value={form.holderNik}
          onChange={(event) => set('holderNik', event.target.value.replace(/\D/g, ''))}
          error={form.holderNik && !nikValid ? 'NIK harus 16 digit angka.' : undefined}
        />
        <Input
          label="Nomor HP"
          value={form.holderPhone}
          onChange={(event) => set('holderPhone', event.target.value)}
        />
        <Input
          label="Alamat"
          value={form.holderAddress}
          onChange={(event) => set('holderAddress', event.target.value)}
        />
        <div className="grid grid-cols-2 gap-3">
          <Input
            label="Kota"
            value={form.holderCity}
            onChange={(event) => set('holderCity', event.target.value)}
          />
          <Input
            label="Kode pos"
            inputMode="numeric"
            value={form.holderPostalCode}
            onChange={(event) => set('holderPostalCode', event.target.value.replace(/\D/g, ''))}
          />
        </div>
        <Input
          label="Tanggal lahir"
          type="date"
          value={form.holderBirthDate}
          onChange={(event) => set('holderBirthDate', event.target.value)}
        />

        <div>
          <p className="text-12 mb-1.5 font-medium text-neutral-900">
            Kendaraan ini akan dipakai untuk
          </p>
          <div className="flex flex-col gap-2">
            {USAGE_OPTIONS.map((option) => {
              const selected = form.vehicleUsage === option.value;
              return (
                <label
                  key={option.value}
                  className={cn(
                    'text-13 flex cursor-pointer items-center gap-3 rounded-xl border bg-neutral-200 px-4 py-3 text-neutral-900 transition',
                    selected
                      ? 'border-[#aded1f] shadow-[0_0_18px_-8px_rgba(173,237,31,0.7)]'
                      : 'border-[#22313c]',
                  )}
                >
                  <input
                    type="radio"
                    name="vehicle-usage"
                    value={option.value}
                    checked={selected}
                    onChange={(event) => set('vehicleUsage', event.target.value)}
                    className="size-4 shrink-0 accent-[#aded1f]"
                  />
                  {option.label}
                </label>
              );
            })}
          </div>
          {form.vehicleUsage !== transfer.vehicleUsage && (
            <p className="text-11 text-warning mt-1.5">
              Penggunaan berbeda dari polis sebelumnya. Polis tetap aktif dan bisa diklaim, tapi
              pihak asuransi akan meninjau preminya.
            </p>
          )}
        </div>

        <div className="mt-auto flex flex-col gap-3 pt-4">
          <Button
            size="lg"
            disabled={!ready}
            isLoading={accept.isPending}
            onClick={() => accept.mutate()}
          >
            Ambil Alih Polis
          </Button>
          <Button variant="outline" isLoading={decline.isPending} onClick={handleDecline}>
            Tolak
          </Button>
        </div>
      </div>
    </PageContainer>
  );
}
