import { mitraApi } from '@/lib/api/client';

/**
 * Pekerjaan perbaikan bengkel (sisi mitra bengkel).
 *
 * Pekerjaan hanya lahir untuk klaim yang SUDAH disetujui asuransi — bengkel tidak
 * akan pernah melihat, apalagi bisa memindai, klaim yang masih ditinjau.
 */

export type RepairJobStatus = 'QUEUED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELED';

export interface RepairJob {
  id: number;
  jobCode: string;
  claimNumber: string;
  userFullname: string;
  userPhone: string;
  vehiclePlate: string;
  repairStationId: number;
  repairStationName: string;
  insurerId: number;
  estimatedCost: number;
  deductibleAmount: number;
  insuranceCoverage: number;
  userPayable: number;
  status: RepairJobStatus;
  notes: string;
  scannedAt: string;
  completedAt: string;
  createdAt: string;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : Number(value) || 0;
}

function statusOf(value: unknown): RepairJobStatus {
  const status = str(value);
  return status === 'IN_PROGRESS' || status === 'COMPLETED' || status === 'CANCELED'
    ? status
    : 'QUEUED';
}

export function parseRepairJob(json: Record<string, unknown>): RepairJob {
  return {
    id: num(json.id),
    jobCode: str(json.job_code),
    claimNumber: str(json.claim_number),
    userFullname: str(json.user_fullname),
    userPhone: str(json.user_phone),
    vehiclePlate: str(json.vehicle_plate),
    repairStationId: num(json.repair_station_id),
    repairStationName: str(json.repair_station_name),
    insurerId: num(json.insurer_id),
    estimatedCost: num(json.estimated_cost),
    deductibleAmount: num(json.deductible_amount),
    insuranceCoverage: num(json.insurance_coverage),
    userPayable: num(json.user_payable),
    status: statusOf(json.status),
    notes: str(json.notes),
    scannedAt: str(json.scanned_at),
    completedAt: str(json.completed_at),
    createdAt: str(json.created_at),
  };
}

function rowsOf(payload: unknown): Record<string, unknown>[] {
  const envelope = asRecord(asRecord(payload).data);
  const raw = envelope.items ?? envelope.data ?? envelope;
  return Array.isArray(raw)
    ? raw.filter(
        (item): item is Record<string, unknown> => item !== null && typeof item === 'object',
      )
    : [];
}

export async function getRepairJobs(status?: string): Promise<RepairJob[]> {
  const res = await mitraApi.get<{ data?: unknown }>('/v1/admin/repair-jobs', {
    params: { page: 1, limit: 100, status: status || undefined },
  });
  return rowsOf(res.data).map(parseRepairJob);
}

export async function getRepairJob(code: string): Promise<RepairJob> {
  const res = await mitraApi.get<{ data?: unknown }>(
    `/v1/admin/repair-jobs/${encodeURIComponent(code)}`,
  );
  return parseRepairJob(asRecord(asRecord(res.data).data));
}

/** Verifikasi tiket user. Kode boleh kode pekerjaan atau nomor klaim. */
export async function scanRepairJob(code: string): Promise<RepairJob> {
  const res = await mitraApi.post<{ data?: unknown }>('/v1/admin/repair-jobs/scan', { code });
  return parseRepairJob(asRecord(asRecord(res.data).data));
}

export async function completeRepairJob(code: string): Promise<RepairJob> {
  const res = await mitraApi.post<{ data?: unknown }>('/v1/admin/repair-jobs/complete', { code });
  return parseRepairJob(asRecord(asRecord(res.data).data));
}

export function repairJobStatusLabel(status: RepairJobStatus): string {
  switch (status) {
    case 'IN_PROGRESS':
      return 'Dikerjakan';
    case 'COMPLETED':
      return 'Selesai';
    case 'CANCELED':
      return 'Dibatalkan';
    default:
      return 'Menunggu';
  }
}
