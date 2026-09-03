export type PaymentType =
  | 'AI_REPORT'
  | 'CLAIM_FEE'
  | 'TOWING'
  /** Sisa biaya perbaikan yang tidak ditanggung asuransi. */
  | 'REPAIR'
  | 'POLICY_PREMIUM'
  | 'OTHER';
export type PaymentMethodKind = 'QRIS' | 'EWALLET' | 'VA';

/** Konteks pembayaran yang dibawa antar-halaman (payment → waiting → success). */
export interface PaymentReceipt {
  orderNumber?: string;
  transactionId?: string;
  status?: string;
  method?: string;
  channelCode?: string;
  paidAt?: string;
}

export interface PaymentContext {
  paymentType: PaymentType;
  /** Rute tujuan setelah pembayaran selesai. */
  redirectRoute: string;
  /** State route tujuan setelah pembayaran selesai. */
  redirectState?: Record<string, unknown>;
  /** Tiket inferensi yang dibayar (kunci invoice di backend). */
  ticket: string;
	/** Nomor polis untuk pembayaran premi. */
	policyNumber?: string;
  /** Total yang ditagih (charge amount) — sumber kebenaran = backend. */
  amount: number;
  /** Nama item yang ditampilkan pada ringkasan lokal. */
  itemName?: string;
  /** Label metode terpilih (untuk ditampilkan). */
  method?: string;
  /** Data kuitansi dari invoice terakhir saat pembayaran berhasil. */
  receipt?: PaymentReceipt;
}

export interface PaymentPricing {
  paymentType: PaymentType;
  currency: string;
  baseAmount: number;
  adminFee: number;
  /** Nominal yang benar-benar ditagih = baseAmount + adminFee. */
  chargeAmount: number;
  itemName: string;
}

/** Invoice Xendit (mengikuti kontrak backend AutoClaim). */
export interface Invoice {
  inferenceTicket: string;
  transactionId: string;
  paymentType: string;
  status: string; // PENDING / SUCCEEDED / FAILED / EXPIRED
  currency: string;
  chargeAmount: number;
  channelCode: string;
  /** URL checkout untuk e-wallet (diawali https). */
  action: string;
  paymentMethod: string; // EWALLET / QRIS / VA
  qrString: string;
  vaNumber: string;
  vaBank: string;
  expiryTime: string;
  createdAt: string;
  updatedAt: string;
}

export interface PaymentMethodOption {
  /** Key unik untuk seleksi. */
  key: string;
  kind: PaymentMethodKind;
  /** Channel e-wallet (mis. ID_DANA) atau kode bank VA (mis. BCA). */
  value: string;
  label: string;
  description: string;
}

/** Pilihan metode pembayaran (QRIS + e-wallet + Virtual Account). */
export const PAYMENT_METHOD_OPTIONS: PaymentMethodOption[] = [
  {
    key: 'QRIS',
    kind: 'QRIS',
    value: '',
    label: 'QRIS',
    description: 'Scan dari e-wallet atau m-banking apa pun',
  },
  {
    key: 'EWALLET:ID_GOPAY',
    kind: 'EWALLET',
    value: 'ID_GOPAY',
    label: 'GoPay',
    description: 'Bayar instan lewat aplikasi GoPay',
  },
  {
    key: 'EWALLET:ID_DANA',
    kind: 'EWALLET',
    value: 'ID_DANA',
    label: 'DANA',
    description: 'Bayar instan lewat aplikasi DANA',
  },
  {
    key: 'EWALLET:ID_LINKAJA',
    kind: 'EWALLET',
    value: 'ID_LINKAJA',
    label: 'LinkAja',
    description: 'Saldo LinkAja & LinkAja Syariah',
  },
  {
    key: 'EWALLET:ID_SHOPEEPAY',
    kind: 'EWALLET',
    value: 'ID_SHOPEEPAY',
    label: 'ShopeePay',
    description: 'Bayar dengan saldo ShopeePay',
  },
  {
    key: 'EWALLET:ID_ASTRAPAY',
    kind: 'EWALLET',
    value: 'ID_ASTRAPAY',
    label: 'AstraPay',
    description: 'Saldo AstraPay & kartu terhubung',
  },
  {
    key: 'VA:BCA',
    kind: 'VA',
    value: 'BCA',
    label: 'Virtual Account BCA',
    description: 'Transfer ke nomor VA BCA',
  },
  {
    key: 'VA:BNI',
    kind: 'VA',
    value: 'BNI',
    label: 'Virtual Account BNI',
    description: 'Transfer ke nomor VA BNI',
  },
  {
    key: 'VA:BRI',
    kind: 'VA',
    value: 'BRI',
    label: 'Virtual Account BRI',
    description: 'Transfer ke nomor VA BRI',
  },
  {
    key: 'VA:MANDIRI',
    kind: 'VA',
    value: 'MANDIRI',
    label: 'Virtual Account Mandiri',
    description: 'Transfer ke nomor VA Mandiri',
  },
];

/** Harga default per jenis (fallback mock / saat pricing API gagal). */
export const DEFAULT_PRICING: Record<PaymentType, PaymentPricing> = {
  AI_REPORT: {
    paymentType: 'AI_REPORT',
    currency: 'IDR',
    baseAmount: 20_000,
    adminFee: 1_200,
    chargeAmount: 21_200,
    itemName: 'AI Damage Report',
  },
  CLAIM_FEE: {
    paymentType: 'CLAIM_FEE',
    currency: 'IDR',
    baseAmount: 0,
    adminFee: 0,
    chargeAmount: 0,
    itemName: 'Biaya Klaim',
  },
  REPAIR: {
    // Nominalnya selalu datang dari server (sisa yang tidak ditanggung
    // asuransi, berbeda tiap pekerjaan); nol di sini hanya penampung.
    paymentType: 'REPAIR',
    currency: 'IDR',
    baseAmount: 0,
    adminFee: 0,
    chargeAmount: 0,
    itemName: 'Sisa Biaya Perbaikan',
  },
  TOWING: {
    paymentType: 'TOWING',
    currency: 'IDR',
    baseAmount: 0,
    adminFee: 0,
    chargeAmount: 0,
    itemName: 'Biaya Towing',
  },
  POLICY_PREMIUM: {
    paymentType: 'POLICY_PREMIUM',
    currency: 'IDR',
    baseAmount: 0,
    adminFee: 0,
    chargeAmount: 0,
    itemName: 'Premi Asuransi',
  },
  OTHER: {
    paymentType: 'OTHER',
    currency: 'IDR',
    baseAmount: 0,
    adminFee: 0,
    chargeAmount: 0,
    itemName: 'Pembayaran',
  },
};
