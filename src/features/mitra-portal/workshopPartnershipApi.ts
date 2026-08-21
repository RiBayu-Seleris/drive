import { mitraApi } from '@/lib/api/client';
import type { PartnershipStatus } from './partnershipApi';

/**
 * Kemitraan mitra bengkel ↔ asuransi (sisi mitra bengkel).
 *
 * Aturannya sama persis dengan kemitraan towing: mengikat butuh persetujuan DUA
 * pihak, undangan hanya boleh dijawab pihak yang diundang, keluar boleh
 * sepihak. Bedanya, bengkel tidak punya padanan "armada eksklusif".
 */

export interface WorkshopPartnership {
  id: number;
  repairStationId: number;
  repairStationName: string;
  insurerId: number;
  insurerName: string;
  status: PartnershipStatus;
  /** Sisi yang mengirim undangan: INSURER | WORKSHOP. */
  initiatedBy: string;
  note: string;
  /** true hanya bila PENDING dan mitra ini adalah pihak yang diundang. */
  canRespond: boolean;
  invitedAt: string;
  respondedAt: string;
  terminatedAt: string;
}

/** Asuransi yang belum punya relasi PENDING/ACTIVE dengan bengkel ini. */
export interface WorkshopPartnershipCandidate {
  id: number;
  name: string;
  address: string;
  phone: string;
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

function statusOf(value: unknown): PartnershipStatus {
  const status = str(value);
  return status === 'ACTIVE' || status === 'REJECTED' || status === 'TERMINATED'
    ? status
    : 'PENDING';
}

function rowsOf(payload: unknown): Record<string, unknown>[] {
  const envelope = asRecord(asRecord(payload).data);
  const raw = envelope.items ?? envelope.data ?? envelope;
  return Array.isArray(raw)
    ? raw.filter((item): item is Record<string, unknown> => item !== null && typeof item === 'object')
    : [];
}

function parsePartnership(json: Record<string, unknown>): WorkshopPartnership {
  return {
    id: num(json.id),
    repairStationId: num(json.repair_station_id),
    repairStationName: str(json.repair_station_name),
    insurerId: num(json.insurer_id),
    insurerName: str(json.insurer_name),
    status: statusOf(json.status),
    initiatedBy: str(json.initiated_by),
    note: str(json.note),
    canRespond: Boolean(json.can_respond),
    invitedAt: str(json.invited_at),
    respondedAt: str(json.responded_at),
    terminatedAt: str(json.terminated_at),
  };
}

export async function getWorkshopPartnerships(status?: string): Promise<WorkshopPartnership[]> {
  const res = await mitraApi.get<{ data?: unknown }>('/v1/admin/workshop-partnerships', {
    params: { page: 1, limit: 100, status: status || undefined },
  });
  return rowsOf(res.data).map(parsePartnership);
}

export async function getWorkshopPartnershipCandidates(
  q?: string,
): Promise<WorkshopPartnershipCandidate[]> {
  const res = await mitraApi.get<{ data?: unknown }>('/v1/admin/workshop-partnerships/candidates', {
    params: { q: q || undefined },
  });
  return rowsOf(res.data).map((json) => ({
    id: num(json.id),
    name: str(json.name),
    address: str(json.address),
    phone: str(json.phone),
  }));
}

export async function getPendingWorkshopPartnershipCount(): Promise<number> {
  const res = await mitraApi.get<{ data?: { count?: number } }>(
    '/v1/admin/workshop-partnerships/pending-count',
  );
  return num(res.data?.data?.count);
}

export async function inviteWorkshopPartnership(insurerId: number): Promise<void> {
  await mitraApi.post('/v1/admin/workshop-partnerships/invite', { insurer_id: insurerId });
}

export async function respondWorkshopPartnership(
  id: number,
  action: 'ACCEPT' | 'REJECT',
  note = '',
): Promise<void> {
  await mitraApi.post('/v1/admin/workshop-partnerships/respond', { id, action, note });
}

export async function terminateWorkshopPartnership(id: number, note = ''): Promise<void> {
  await mitraApi.post('/v1/admin/workshop-partnerships/terminate', { id, note });
}
