import { mitraApi } from '@/lib/api/client';
import type { MitraPartnerType } from '@/features/auth/store/mitraStore';
import type { BankAccount, Laporan, MitraIconKey, SaldoTx } from './types';

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function asArray(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function num(value: unknown): number {
  return typeof value === 'number' ? value : Number(value) || 0;
}

function bool(value: unknown): boolean {
  return Boolean(value);
}

function dataOf(payload: unknown): Record<string, unknown> {
  return asRecord(asRecord(payload).data);
}

function iconKey(value: unknown): MitraIconKey {
  const key = str(value);
  if (['truck', 'user', 'building', 'wallet', 'shield', 'wrench'].includes(key)) {
    return key as MitraIconKey;
  }
  return 'truck';
}

function statusTone(value: unknown): Laporan['statusTone'] {
  const tone = str(value);
  if (tone === 'yellow' || tone === 'blue' || tone === 'green') return tone;
  return 'blue';
}

function saldoStatus(value: unknown): SaldoTx['status'] {
  return str(value) === 'berhasil' ? 'berhasil' : 'proses';
}

function parseReport(value: unknown): Laporan {
  const json = asRecord(value);
  return {
    id: str(json.id),
    iconKey: iconKey(json.icon_key),
    title: str(json.title),
    subtitle: str(json.subtitle),
    statusLabel: str(json.status_label),
    statusTone: statusTone(json.status_tone),
    actionable: bool(json.actionable),
    archived: bool(json.archived),
  };
}

function parseBankAccount(value: unknown): BankAccount {
  const json = asRecord(value);
  return {
    id: str(json.id),
    bank: str(json.bank),
    bankCode: str(json.bank_code),
    number: str(json.number),
    holder: str(json.holder),
  };
}

function parseSaldoTx(value: unknown): SaldoTx {
  const json = asRecord(value);
  return {
    id: str(json.id),
    iconKey: iconKey(json.icon_key),
    title: str(json.title),
    date: str(json.date),
    amount: num(json.amount),
    status: saldoStatus(json.status),
  };
}

function partnerParams(partnerType: MitraPartnerType | null) {
  return partnerType ? { partner_type: partnerType } : undefined;
}

export interface MitraReportSummary {
  completed: number;
  growthPercent: number;
  pending: number;
}

export interface MitraReportsResult {
  stats: MitraReportSummary;
  reports: Laporan[];
}

export async function getMitraReports(
  partnerType: MitraPartnerType | null,
): Promise<MitraReportsResult> {
  const res = await mitraApi.get('/v1/admin/mitra-reports', {
    params: partnerParams(partnerType),
  });
  const data = dataOf(res.data);
  const stats = asRecord(data.stats);
  return {
    stats: {
      completed: num(stats.completed),
      growthPercent: num(stats.growth_percent),
      pending: num(stats.pending),
    },
    reports: asArray(data.reports).map(parseReport),
  };
}

export async function getMitraReport(
  partnerType: MitraPartnerType | null,
  id: string,
): Promise<Laporan | undefined> {
  const res = await mitraApi.get(`/v1/admin/mitra-reports/${encodeURIComponent(id)}`, {
    params: partnerParams(partnerType),
  });
  return parseReport(dataOf(res.data));
}

export async function submitMitraReport(
  id: string,
  input: {
    finalOdometer: number;
    vehicleCondition: string;
    notes: string;
    photoUrls?: string[];
  },
): Promise<Laporan> {
  const res = await mitraApi.post(`/v1/admin/mitra-reports/${encodeURIComponent(id)}/submit`, {
    final_odometer: input.finalOdometer,
    vehicle_condition: input.vehicleCondition,
    notes: input.notes,
    photo_urls: input.photoUrls ?? [],
  });
  return parseReport(dataOf(res.data));
}

export interface MitraSaldoResult {
  balance: number;
  income: number;
  withdraw: number;
  /** Porsi asuransi yang sudah jadi hak mitra tapi belum cair (tagih berkala). */
  pendingInsurance: number;
  transactions: SaldoTx[];
}

export async function getMitraSaldo(): Promise<MitraSaldoResult> {
  const res = await mitraApi.get('/v1/admin/mitra-balance');
  const data = dataOf(res.data);
  return {
    balance: num(data.balance),
    income: num(data.income),
    withdraw: num(data.withdraw),
    pendingInsurance: num(data.pending_insurance),
    transactions: asArray(data.transactions).map(parseSaldoTx),
  };
}

export async function getMitraBankAccounts(): Promise<BankAccount[]> {
  const res = await mitraApi.get('/v1/admin/mitra-bank-accounts');
  return asArray(asRecord(res.data).data).map(parseBankAccount);
}

export async function createMitraBankAccount(args: {
  bank: string;
  bankCode: string;
  number: string;
  holder: string;
}): Promise<BankAccount> {
  const res = await mitraApi.post('/v1/admin/mitra-bank-accounts', {
    bank: args.bank,
    bank_code: args.bankCode,
    number: args.number,
    holder: args.holder,
  });
  return parseBankAccount(dataOf(res.data));
}

export async function requestMitraWithdrawal(args: {
  bankAccountId: string;
  amount: number;
}): Promise<void> {
  await mitraApi.post('/v1/admin/mitra-withdrawals', {
    bank_account_id: args.bankAccountId,
    amount: args.amount,
    client_request_id: `withdraw-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`,
  });
}

/** Satu bank tujuan transfer, dari daftar resmi penyedia pembayaran. */
export interface DisbursementBank {
  name: string;
  code: string;
}

/**
 * Daftar bank tujuan transfer.
 *
 * Diambil dari server (yang mengambilnya dari penyedia pembayaran), bukan
 * daftar tetap di aplikasi: bank yang tidak dikenal penyedia berarti uang gagal
 * terkirim justru setelah mitra selesai bekerja.
 */
export async function getDisbursementBanks(): Promise<DisbursementBank[]> {
  const res = await mitraApi.get<{ data?: { banks?: unknown } }>(
    '/v1/admin/mitra-bank-accounts/banks',
  );
  const list = res.data?.data?.banks;
  if (!Array.isArray(list)) return [];
  return list
    .map((item) => {
      const json = asRecord(item);
      return { name: str(json.name), code: str(json.code) };
    })
    .filter((bank) => bank.code !== '' && bank.name !== '');
}
