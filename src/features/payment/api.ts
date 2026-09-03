import { userApi } from '@/lib/api/client';
import { env } from '@/config/env';
import { DEFAULT_PRICING, type Invoice, type PaymentPricing, type PaymentType } from './types';

/** E-wallet yang ditampilkan saat mode mock / daftar dukungan gagal dimuat. */
const DEFAULT_EWALLET_CHANNELS = [
  'ID_GOPAY',
  'ID_DANA',
  'ID_LINKAJA',
  'ID_SHOPEEPAY',
  'ID_ASTRAPAY',
];

function num(value: unknown): number {
  return typeof value === 'number' ? value : Number(value) || 0;
}
function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function parsePricing(data: Record<string, unknown>, type: PaymentType): PaymentPricing {
  const fallback = DEFAULT_PRICING[type] ?? DEFAULT_PRICING.OTHER;
  // Kompatibel mundur: backend lama hanya kirim charge_amount.
  const charge = data.charge_amount != null ? num(data.charge_amount) : undefined;
  const base = data.base_amount != null ? num(data.base_amount) : (charge ?? fallback.baseAmount);
  const fee = data.admin_fee != null ? num(data.admin_fee) : 0;
  return {
    paymentType: type,
    currency: str(data.currency, fallback.currency),
    baseAmount: base,
    adminFee: fee,
    chargeAmount: charge ?? base + fee,
    itemName: str(data.item_name, fallback.itemName),
  };
}

function parseInvoice(data: Record<string, unknown>): Invoice {
  return {
    inferenceTicket: str(data.inference_ticket),
    transactionId: str(data.transaction_id),
    paymentType: str(data.payment_type, 'AI_REPORT'),
    status: str(data.status),
    currency: str(data.currency, 'IDR'),
    chargeAmount: num(data.charge_amount),
    channelCode: str(data.channel_code),
    action: str(data.action),
    paymentMethod: str(data.payment_method, 'EWALLET'),
    qrString: str(data.qr_string),
    vaNumber: str(data.va_number),
    vaBank: str(data.va_bank),
    expiryTime: str(data.expiry_time),
    createdAt: str(data.created_at),
    updatedAt: str(data.updated_at),
  };
}

/** Harga produk (real dari backend; default saat mock / gagal). */
export async function getPaymentPricing(type: PaymentType): Promise<PaymentPricing> {
  if (env.useMockServices) return DEFAULT_PRICING[type] ?? DEFAULT_PRICING.OTHER;
  try {
    const res = await userApi.get<{ data?: Record<string, unknown> }>('/v1/payment/pricing', {
      params: { payment_type: type },
    });
    return parsePricing(res.data?.data ?? {}, type);
  } catch {
    return DEFAULT_PRICING[type] ?? DEFAULT_PRICING.OTHER;
  }
}

/** Daftar channel e-wallet yang didukung backend (untuk memfilter pilihan). */
export async function getSupportedEwalletChannels(): Promise<string[]> {
  if (env.useMockServices) return DEFAULT_EWALLET_CHANNELS;
  try {
    const res = await userApi.get<{ data?: unknown }>('/v1/payment-support');
    const data = res.data?.data;
    if (!Array.isArray(data)) return DEFAULT_EWALLET_CHANNELS;
    return data
      .filter((e): e is string => typeof e === 'string')
      .map((e) => e.trim().toUpperCase())
      .filter((e) => e.length > 0);
  } catch {
    return DEFAULT_EWALLET_CHANNELS;
  }
}

export interface CreateInvoiceArgs {
	inferenceTicket: string;
	policyNumber?: string;
	/** Kode pekerjaan bengkel; wajib saat paymentType = REPAIR. */
	jobCode?: string;
  paymentType: PaymentType;
  /** EWALLET / QRIS / VA. */
  paymentMethod: string;
  /** Channel e-wallet (mis. ID_DANA); kosong untuk QRIS/VA. */
  paymentChannel: string;
  /** Kode bank VA (mis. BCA); kosong untuk QRIS/e-wallet. */
  bankCode: string;
}

/** Buat invoice Xendit. Dipakai hanya pada mode backend (bukan mock). */
export async function createInvoice(args: CreateInvoiceArgs): Promise<Invoice> {
  const res = await userApi.post<{ data?: unknown; stat_msg?: string }>('/v1/payment/invoice', {
		inference_ticket: args.inferenceTicket,
		policy_number: args.policyNumber,
		job_code: args.jobCode,
    payment_method: args.paymentMethod,
    payment_channel: args.paymentChannel,
    bank_code: args.bankCode,
    payment_type: args.paymentType,
  });
  const payload = record(res.data?.data);
  const invoice = parseInvoice(payload);
  if (!invoice.inferenceTicket || !invoice.status) {
    throw new Error(res.data?.stat_msg || 'Response invoice kosong dari server.');
  }
  return invoice;
}

/** Ambil status invoice terkini (polling). */
export async function getInvoice(ticket: string, paymentType: PaymentType): Promise<Invoice> {
  const res = await userApi.get<{ data?: Record<string, unknown> }>('/v1/payment/invoice', {
    params: { ticket, payment_type: paymentType },
  });
  return parseInvoice(res.data?.data ?? {});
}
