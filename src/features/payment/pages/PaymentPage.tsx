import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Check, ChevronDown, CircleHelp, Landmark, QrCode, Smartphone } from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/Spinner';
import { toast } from '@/components/feedback/toast';
import { extractErrorMessage } from '@/lib/api/client';
import { formatCurrency } from '@/lib/utils/format';
import { env } from '@/config/env';
import { ROUTES } from '@/app/routes';
import { useDamageStore } from '@/features/damage/store/damageStore';
import { createInvoice, getPaymentPricing, getSupportedEwalletChannels } from '../api';
import { savePendingPayment } from '../pending';
import {
  PAYMENT_METHOD_OPTIONS,
  type PaymentContext,
  type PaymentMethodKind,
  type PaymentMethodOption,
  type PaymentType,
} from '../types';

interface PaymentNavState {
  payment_type?: PaymentType;
  redirect_route?: string;
  redirect_state?: Record<string, unknown>;
	ticket?: string;
	policy_number?: string;
  amount?: number;
  item_name?: string;
}

const METHOD_ICON: Record<PaymentMethodKind, typeof QrCode> = {
  QRIS: QrCode,
  EWALLET: Smartphone,
  VA: Landmark,
};

/*
 * Logo per metode. Kuncinya sama dengan `key` di PAYMENT_METHOD_OPTIONS.
 * Metode tanpa logo tetap tampil — hanya memakai inisial huruf sebagai
 * gantinya — jadi menambah berkas ke folder ini cukup untuk menghidupkannya.
 */
const METHOD_LOGO: Partial<Record<string, string>> = {
  QRIS: '/assets/payment-logo/qris.webp',
  'EWALLET:ID_DANA': '/assets/payment-logo/dana.webp',
  'EWALLET:ID_LINKAJA': '/assets/payment-logo/linkaja.webp',
  'VA:BCA': '/assets/payment-logo/bca.webp',
  // Nama berkas mengikuti yang benar-benar ada di folder, termasuk
  // perbedaan formatnya — bukan pola seragam yang lalu gagal dimuat.
  'VA:BNI': '/assets/payment-logo/bni.jpeg',
  'VA:BRI': '/assets/payment-logo/bri.png',
  'VA:MANDIRI': '/assets/payment-logo/mandiri.webp',
};

function getPaymentInstructionSteps(method?: PaymentMethodOption) {
  if (!method) {
    return [
      'Pilih metode pembayaran yang ingin digunakan.',
      'Tekan Bayar Sekarang untuk membuat instruksi pembayaran.',
      'Selesaikan pembayaran dan tunggu konfirmasi otomatis.',
    ];
  }

  if (method.kind === 'QRIS') {
    return [
      'Tekan Bayar Sekarang untuk menampilkan kode QRIS.',
      'Buka aplikasi e-wallet atau m-banking, lalu pilih menu Scan/QRIS.',
      'Scan kode QRIS di halaman instruksi dan pastikan nominalnya sesuai.',
      'Konfirmasi pembayaran, lalu tunggu status terverifikasi otomatis.',
    ];
  }

  if (method.kind === 'VA') {
    return [
      `Tekan Bayar Sekarang untuk membuat nomor ${method.label}.`,
      'Salin nomor Virtual Account yang muncul di halaman instruksi.',
      'Transfer sesuai nominal sebelum batas waktu pembayaran habis.',
      'Kembali ke aplikasi dan tunggu status terverifikasi otomatis.',
    ];
  }

  return [
    `Tekan Bayar Sekarang untuk membuat pembayaran ${method.label}.`,
    'Di halaman instruksi, tekan Buka Halaman Pembayaran.',
    `Selesaikan pembayaran di halaman atau aplikasi ${method.label}.`,
    'Kembali ke aplikasi dan tunggu status terverifikasi otomatis.',
  ];
}

function getInstructionTitle(method?: PaymentMethodOption) {
  return method ? `Cara Bayar ${method.label}` : 'Cara Bayar';
}

export function PaymentPage() {
  const navigate = useNavigate();
  const state = (useLocation().state ?? {}) as PaymentNavState;
  const paymentType: PaymentType = state.payment_type ?? 'AI_REPORT';
  const redirectRoute = state.redirect_route ?? ROUTES.damageAnalysis;
  const redirectState = state.redirect_state;
  const damageTicket = useDamageStore((s) => s.result?.ticket ?? '');
	const policyNumber = state.policy_number ?? '';
	const ticket = paymentType === 'POLICY_PREMIUM' ? policyNumber : state.ticket || damageTicket;
	const dynamicPricing =
		paymentType === 'TOWING' || paymentType === 'POLICY_PREMIUM'
			? {
          paymentType,
          currency: 'IDR',
          baseAmount: Math.max(0, state.amount ?? 0),
          adminFee: 0,
          chargeAmount: Math.max(0, state.amount ?? 0),
				itemName: state.item_name ?? (paymentType === 'POLICY_PREMIUM' ? 'Premi Asuransi' : 'Biaya Towing'),
        }
      : null;

  const [selectedKey, setSelectedKey] = useState('QRIS');
  const [methodOpen, setMethodOpen] = useState(false);
  const [instructionsOpen, setInstructionsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  /*
   * OVO menagih ke nomor HP yang terdaftar di akun OVO pelanggan: Xendit
   * mengirim permintaan bayar ke aplikasi di nomor itu. Kanal lain tidak
   * memerlukannya, jadi kolomnya hanya muncul saat OVO dipilih.
   */
  const [mobileNumber, setMobileNumber] = useState('');

  const pricingQuery = useQuery({
    queryKey: ['payment-pricing', paymentType],
    queryFn: () => getPaymentPricing(paymentType),
    enabled: !dynamicPricing,
  });
  const channelsQuery = useQuery({
    queryKey: ['payment-support'],
    queryFn: getSupportedEwalletChannels,
  });

  // Filter e-wallet sesuai channel yang didukung backend; QRIS & VA selalu ada.
  const methods = useMemo<PaymentMethodOption[]>(() => {
    const supported = new Set(channelsQuery.data ?? []);
    return PAYMENT_METHOD_OPTIONS.filter((o) => o.kind !== 'EWALLET' || supported.has(o.value));
  }, [channelsQuery.data]);

  const pricing = dynamicPricing ?? pricingQuery.data;
  const total = pricing?.chargeAmount ?? 0;
  const selected = methods.find((m) => m.key === selectedKey) ?? methods[0];
  const instructionSteps = getPaymentInstructionSteps(selected);

  const buildContext = (amount: number): PaymentContext => ({
    paymentType,
    redirectRoute,
		redirectState,
		ticket,
		policyNumber: paymentType === 'POLICY_PREMIUM' ? policyNumber : undefined,
    amount,
    itemName: pricing?.itemName,
    method: selected?.label,
  });

  const handlePay = async () => {
    if (!selected || !pricing) return;
    if (total <= 0) {
      toast.error('Nominal pembayaran belum tersedia.');
      return;
    }
    // Mode mock: lewati gateway, langsung ke layar tunggu (auto-success demo).
    if (env.useMockServices) {
      navigate(ROUTES.paymentWaiting, { state: buildContext(total) });
      return;
    }
    if (!ticket) {
      toast.error(
		paymentType === 'TOWING'
			? 'Referensi order towing tidak ditemukan.'
			: paymentType === 'POLICY_PREMIUM'
				? 'Nomor polis tidak ditemukan.'
				: 'Tiket analisis tidak ditemukan. Jalankan analisis ulang.',
      );
      return;
    }
    const needsMobile = selected.kind === 'EWALLET' && selected.value === 'ID_OVO';
    if (needsMobile && mobileNumber.trim().length < 9) {
      toast.error('Masukkan nomor HP yang terdaftar di OVO.');
      return;
    }

    setIsSubmitting(true);
    try {
		const invoice = await createInvoice({
			inferenceTicket: ticket,
			policyNumber: paymentType === 'POLICY_PREMIUM' ? policyNumber : undefined,
			// Untuk REPAIR, `ticket` yang dibawa halaman ini adalah kode pekerjaan.
			jobCode: paymentType === 'REPAIR' ? ticket : undefined,
			mobileNumber: needsMobile ? mobileNumber.trim() : undefined,
        paymentType,
        paymentMethod: selected.kind,
        paymentChannel: selected.kind === 'EWALLET' ? selected.value : '',
        bankCode: selected.kind === 'VA' ? selected.value : '',
      });
      const ctx = buildContext(invoice.chargeAmount || total);
      savePendingPayment(ctx);
      navigate(ROUTES.paymentWaiting, { state: ctx });
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Pembayaran belum bisa diproses. Coba lagi.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!pricing) {
    return (
      <PageContainer>
        <AppHeader title="Pembayaran" />
        <LoadingState label="Memuat rincian pembayaran…" />
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <AppHeader title="Pembayaran" />
      <div className="flex flex-1 flex-col gap-5 px-5 py-5">
        <section className="drive-card rounded-xl border border-neutral-300 p-4">
          <p className="text-14 font-bold text-neutral-900">Detail Pembayaran</p>
          <div className="mt-3 flex flex-col gap-2.5">
            <PaymentRow label="Produk" value={pricing.itemName} />
            <PaymentRow label="Nominal" value={formatCurrency(pricing.baseAmount)} />
            <PaymentRow
              label="Biaya Admin"
              value={pricing.adminFee > 0 ? formatCurrency(pricing.adminFee) : 'Gratis'}
            />
            <div className="mt-1 flex justify-between border-t border-neutral-200 pt-2.5">
              <span className="text-14 font-bold text-neutral-900">Total Pembayaran</span>
              <span className="text-deep-blue-500 text-16 font-bold">{formatCurrency(total)}</span>
            </div>
          </div>
        </section>

        <section className="drive-card overflow-hidden rounded-xl border border-orange">
          <button
            type="button"
            className="flex w-full items-center gap-3 p-4 text-left"
            aria-expanded={instructionsOpen}
            onClick={() => setInstructionsOpen((open) => !open)}
          >
            <span className="relative flex size-10 shrink-0 items-center justify-center rounded-full bg-orange/15 text-[#e79d6a]">
              <CircleHelp className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[14px] font-bold text-[#e79d6a]">
                {getInstructionTitle(selected)}
              </span>
              <span className="text-12 block text-neutral-600">
                Lihat langkah pembayaran singkat
              </span>
            </span>
            <ChevronDown
              className={`size-5 text-neutral-500 transition-transform duration-300 ${
                instructionsOpen ? 'rotate-180' : ''
              }`}
            />
          </button>
          <div
            className={`grid transition-all duration-300 ease-out ${
              instructionsOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
            }`}
          >
            <div className="min-h-0 overflow-hidden">
              <div
                className={`px-4 pb-4 transition-transform duration-300 ${
                  instructionsOpen ? 'translate-y-0' : '-translate-y-2'
                }`}
              >
                <div className="relative rounded-lg bg-orange/15/70 p-4">
                  <span className="absolute top-4 bottom-4 left-[27px] w-px bg-orange" />
                  <div className="relative flex flex-col gap-3">
                    {instructionSteps.map((step, index) => (
                      <div key={index} className="flex gap-3">
                        <span className="z-10 flex size-6 shrink-0 items-center justify-center rounded-full bg-[#df7d3a] text-[11px] font-bold text-white shadow-[0_4px_12px_rgba(249,115,22,0.28)]">
                          {index + 1}
                        </span>
                        <p className="text-12 pt-0.5 leading-relaxed text-neutral-700">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section>
          <p className="text-14 mb-3 font-bold text-neutral-900">Pilih Metode Pembayaran</p>
          <div className="relative">
            <button
              type="button"
              className={`flex w-full items-center gap-3 rounded-xl border bg-neutral-100 p-3.5 text-left transition-colors ${
                methodOpen ? 'border-deep-blue-500 border-2' : 'border-neutral-300'
              }`}
              aria-expanded={methodOpen}
              onClick={() => setMethodOpen((open) => !open)}
            >
              {selected && <PaymentMethodLogo method={selected} />}
              <span className="min-w-0 flex-1">
                <span className="text-14 block font-semibold text-neutral-900">
                  {selected?.label ?? 'Pilih metode pembayaran'}
                </span>
                <span className="text-12 block text-neutral-600">
                  {selected?.description ?? 'Pilih salah satu metode yang tersedia'}
                </span>
              </span>
              <ChevronDown
                className={`size-5 text-neutral-500 transition-transform duration-300 ${
                  methodOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            <div
              className={`grid transition-all duration-300 ease-out ${
                methodOpen ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'
              }`}
            >
              <div className="min-h-0 overflow-hidden">
                <div
                  className={`mt-2 overflow-hidden rounded-xl border border-neutral-200 bg-neutral-100 shadow-[0_12px_30px_rgba(15,23,42,0.08)] transition-transform duration-300 ${
                    methodOpen ? 'translate-y-0' : '-translate-y-2'
                  }`}
                >
                  {methods.map((method) => {
                    const active = selected?.key === method.key;
                    return (
                      <button
                        key={method.key}
                        type="button"
                        onClick={() => {
                          setSelectedKey(method.key);
                          setMethodOpen(false);
                        }}
                        className={`flex w-full items-center gap-3 border-b border-neutral-300 p-3.5 text-left last:border-b-0 ${
                          active ? 'bg-deep-blue-50/70' : 'bg-neutral-100 active:bg-neutral-100'
                        }`}
                      >
                        <PaymentMethodLogo method={method} />
                        <span className="min-w-0 flex-1">
                          <span className="text-14 block font-semibold text-neutral-900">
                            {method.label}
                          </span>
                          <span className="text-12 block text-neutral-600">
                            {method.description}
                          </span>
                        </span>
                        {active && <Check className="text-deep-blue-500 size-5" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/*
          Kolom ini hanya untuk OVO. Xendit tidak membuka halaman pembayaran
          untuk OVO — ia mengirim permintaan bayar ke aplikasi OVO di nomor
          yang disebutkan, dan pelanggan menyetujuinya di sana.
        */}
        {selected?.kind === 'EWALLET' && selected.value === 'ID_OVO' && (
          <section className="drive-card rounded-xl p-4">
            <label className="text-12 mb-2 block font-semibold text-neutral-900" htmlFor="ovo-phone">
              Nomor HP OVO
            </label>
            <input
              id="ovo-phone"
              value={mobileNumber}
              onChange={(event) => setMobileNumber(event.target.value.replace(/[^0-9+]/g, ''))}
              inputMode="tel"
              placeholder="08xxxxxxxxxx"
              className="text-14 h-12 w-full rounded-xl border border-neutral-300 bg-neutral-200 px-4 text-neutral-900 outline-none placeholder:text-neutral-500"
            />
            <p className="text-11 mt-2 text-neutral-600">
              Permintaan bayar akan dikirim ke aplikasi OVO nomor ini. Pastikan nomornya benar dan
              aplikasinya terpasang.
            </p>
          </section>
        )}
      </div>

      <div className="sticky bottom-0 border-t border-neutral-300 bg-neutral-100 px-5 py-4">
        <Button
          fullWidth={false}
          className="w-full"
          size="lg"
          isLoading={isSubmitting}
          disabled={!selected || total <= 0}
          onClick={() => void handlePay()}
        >
          Bayar Sekarang
        </Button>
      </div>
    </PageContainer>
  );
}

function PaymentMethodLogo({ method }: { method: PaymentMethodOption }) {
  const Icon = METHOD_ICON[method.kind];
  const mapped = METHOD_LOGO[method.key];
  // Berkas yang hilang atau gagal dimuat jatuh ke ikon polos, bukan kotak
  // kosong dengan gambar rusak.
  const [broken, setBroken] = useState(false);
  const logo = broken ? undefined : mapped;

  if (logo) {
    return (
      <span className="flex size-11 shrink-0 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-100 p-2">
        <img
          src={logo}
          alt={method.label}
          onError={() => setBroken(true)}
          className="max-h-full max-w-full object-contain"
        />
      </span>
    );
  }

  return (
    <span className="bg-deep-blue-50 text-deep-blue-500 flex size-11 shrink-0 items-center justify-center rounded-lg">
      <Icon className="size-5" />
    </span>
  );
}

function PaymentRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-12 text-neutral-600">{label}</span>
      <span className="text-12 truncate text-right font-semibold text-neutral-900">{value}</span>
    </div>
  );
}
