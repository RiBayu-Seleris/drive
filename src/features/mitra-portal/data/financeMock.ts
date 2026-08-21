import type { BankAccount, Laporan, SaldoTx } from '../types';

export const MITRA_REPORTS: Laporan[] = [
  {
    id: 'TRX-99012',
    iconKey: 'truck',
    title: 'Budi Hartono',
    subtitle: 'Towing darurat - Sudirman ke Auto2000 Saharjo',
    statusLabel: 'Menunggu Laporan',
    statusTone: 'yellow',
    actionable: true,
    archived: false,
  },
  {
    id: 'TRX-99013',
    iconKey: 'truck',
    title: 'Siti Rahma',
    subtitle: 'Kendaraan mogok - Fatmawati ke Bengkel rekanan',
    statusLabel: 'Sedang Diproses',
    statusTone: 'blue',
    actionable: false,
    archived: false,
  },
  {
    id: 'TRX-98990',
    iconKey: 'truck',
    title: 'Rudi Santoso',
    subtitle: 'Towing selesai - Klaim sudah diverifikasi',
    statusLabel: 'Dibayarkan',
    statusTone: 'green',
    actionable: false,
    archived: true,
  },
];

export const WORKSHOP_REPORTS: Laporan[] = [
  {
    id: 'WRK-22031',
    iconKey: 'wrench',
    title: 'Toyota Avanza - B 1234 ADK',
    subtitle: 'Estimasi perbaikan bumper depan dan lampu kanan',
    statusLabel: 'Menunggu Laporan',
    statusTone: 'yellow',
    actionable: true,
    archived: false,
  },
  {
    id: 'WRK-22022',
    iconKey: 'wrench',
    title: 'Honda HR-V - B 4412 KLA',
    subtitle: 'Pengerjaan panel samping - menunggu foto akhir',
    statusLabel: 'Sedang Diproses',
    statusTone: 'blue',
    actionable: false,
    archived: false,
  },
  {
    id: 'WRK-21998',
    iconKey: 'wrench',
    title: 'Daihatsu Xenia - B 9311 CCD',
    subtitle: 'Perbaikan selesai dan sudah disetujui asuransi',
    statusLabel: 'Dibayarkan',
    statusTone: 'green',
    actionable: false,
    archived: true,
  },
];

export const MITRA_BALANCE = 2_900_000;

export const MITRA_SALDO_TX: SaldoTx[] = [
  {
    id: 'SAL-80041',
    iconKey: 'truck',
    title: 'Pembayaran Towing TRX-98990',
    date: '17 Jun 2026',
    amount: 850_000,
    status: 'berhasil',
  },
  {
    id: 'SAL-80040',
    iconKey: 'wallet',
    title: 'Penarikan ke BCA',
    date: '16 Jun 2026',
    amount: -1_200_000,
    status: 'berhasil',
  },
  {
    id: 'SAL-80039',
    iconKey: 'truck',
    title: 'Pembayaran Towing TRX-98921',
    date: '15 Jun 2026',
    amount: 725_000,
    status: 'berhasil',
  },
  {
    id: 'SAL-80038',
    iconKey: 'wallet',
    title: 'Penarikan ke Mandiri',
    date: '14 Jun 2026',
    amount: -900_000,
    status: 'proses',
  },
];

export const MITRA_BANK_ACCOUNTS: BankAccount[] = [
  { id: 'bca-main', bank: 'BCA', bankCode: 'BCA', number: '1234567890', holder: 'PT Towing Sejahtera' },
  {
    id: 'mandiri-ops',
    bank: 'Mandiri',
    bankCode: 'MANDIRI',
    number: '1400012345678',
    holder: 'PT Towing Sejahtera',
  },
];

/** Ringkasan kinerja laporan (kartu hero halaman Laporan). */
export const MITRA_REPORT_STATS = { completed: 128, growthPercent: 12 };

/** Total pendapatan & penarikan (kartu ringkasan halaman Saldo). */
export const MITRA_INCOME_TOTAL = 12_500_000;
export const MITRA_WITHDRAW_TOTAL = 8_000_000;

/** Biaya admin penarikan ke bank lain. */
export const WITHDRAW_ADMIN_FEE = 2_500;

/** Nominal cepat pada form tarik saldo. */
export const WITHDRAW_QUICK_AMOUNTS = [500_000, 1_000_000, 5_000_000, 10_000_000];

export function findReport(id: string, reports: Laporan[]): Laporan | undefined {
  return reports.find((item) => item.id === id);
}
