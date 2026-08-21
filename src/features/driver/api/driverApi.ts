import { driverApi } from '@/lib/api/client';
import { env } from '@/config/env';
import { STORAGE_KEYS } from '@/config/constants';
import {
  NGROK_SKIP_BROWSER_WARNING_HEADER,
  NGROK_SKIP_BROWSER_WARNING_VALUE,
} from '@/lib/api/headers';
import { storage } from '@/lib/storage/storage';
import { parseSettlementFlag, type SettlementFlag } from '@/features/towing/types';
import { parseDriverTask, type DriverTask } from '../types';

export async function getDriverTasks(): Promise<DriverTask[]> {
  const res = await driverApi.get<{ data?: { orders?: unknown[] } | unknown[] }>(
    '/v1/admin/driver/towing-orders',
  );
  const data = res.data?.data;
  const list = Array.isArray(data) ? data : (data?.orders ?? []);
  return list
    .filter((e): e is Record<string, unknown> => typeof e === 'object' && e !== null)
    .map(parseDriverTask);
}

/**
 * Majukan status perjalanan sopir.
 *
 * Kedua foto bukti wajib saat status DROPPED_OFF — dua sudut serong yang dilihat
 * user dan dicocokkan admin bengkel. Backend menolak bila salah satu kosong.
 */
export async function updateDriverTaskStatus(
  code: string,
  status: string,
  proof?: { front: string; rear: string },
): Promise<string> {
  const res = await driverApi.post<{ data?: { status?: string } }>(
    `/v1/admin/driver/towing-orders/${encodeURIComponent(code)}/status`,
    { status, proof_photo: proof?.front ?? '', proof_photo_rear: proof?.rear ?? '' },
  );
  return res.data?.data?.status ?? status;
}

/** Profil sopir yang sedang login (GET/PUT /driver/me). */
export interface DriverProfile {
  id: number;
  towingServiceId: number;
  fullname: string;
  phone: string;
  licenseNumber: string;
  /** Format YYYY-MM-DD; null bila belum diisi. */
  licenseExpiry: string | null;
  address: string;
  photoUrl: string;
  ktpImageUrl: string;
  simImageUrl: string;
  fleetType: string;
  status: string;
  towingName: string;
  email: string;
  isActive: boolean;
}

function parseDriverProfile(json: Record<string, unknown>): DriverProfile {
  const str = (v: unknown, f = ''): string => (typeof v === 'string' ? v : f);
  const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0);
  return {
    id: num(json.id),
    towingServiceId: num(json.towing_service_id),
    fullname: str(json.fullname),
    phone: str(json.phone),
    licenseNumber: str(json.license_number),
    licenseExpiry: typeof json.license_expiry === 'string' ? json.license_expiry : null,
    address: str(json.address),
    photoUrl: str(json.photo_url),
    ktpImageUrl: str(json.ktp_image_url),
    simImageUrl: str(json.sim_image_url),
    fleetType: str(json.fleet_type),
    status: str(json.status),
    towingName: str(json.towing_name),
    email: str(json.email),
    isActive: json.is_active !== false,
  };
}

export async function getDriverProfile(): Promise<DriverProfile> {
  const res = await driverApi.get<{ data?: Record<string, unknown> }>('/v1/admin/driver/me');
  return parseDriverProfile(res.data?.data ?? {});
}

export interface UpdateDriverProfileInput {
  phone: string;
  address: string;
  licenseNumber: string;
  /** YYYY-MM-DD atau '' bila kosong. */
  licenseExpiry: string;
  photoUrl: string;
  ktpImageUrl: string;
  simImageUrl: string;
}

/** PUT mengganti seluruh field profil sekaligus — kirim nilai lengkap hasil prefill. */
export async function updateDriverProfile(input: UpdateDriverProfileInput): Promise<void> {
  await driverApi.put('/v1/admin/driver/me', {
    phone: input.phone,
    address: input.address,
    license_number: input.licenseNumber,
    license_expiry: input.licenseExpiry,
    photo_url: input.photoUrl,
    ktp_image_url: input.ktpImageUrl,
    sim_image_url: input.simImageUrl,
  });
}

/**
 * Sopir meng-on/off-kan dirinya sendiri. BUSY milik sistem — backend menolak
 * perubahan saat sopir sedang memegang order aktif.
 */
export async function setDriverAvailability(status: 'AVAILABLE' | 'OFFLINE'): Promise<void> {
  await driverApi.post('/v1/admin/driver/status', { status });
}

/** Ganti kata sandi sendiri (wajib tahu kata sandi lama). */
export async function changeDriverPassword(
  oldPassword: string,
  newPassword: string,
): Promise<void> {
  await driverApi.post('/v1/admin/driver/password', {
    old_password: oldPassword,
    new_password: newPassword,
  });
}

export async function rejectDriverOrder(code: string, note: string): Promise<void> {
  await driverApi.post(`/v1/admin/driver/towing-orders/${encodeURIComponent(code)}/reject`, {
    note,
  });
}

export interface FleetInspectionPayload {
  verdict: 'FIT' | 'UNFIT';
  notes: string;
  photoFront: string;
  photoRear: string;
  photoLeft: string;
  photoRight: string;
}

export async function submitFleetInspection(
  code: string,
  payload: FleetInspectionPayload,
): Promise<void> {
  await driverApi.post(`/v1/admin/driver/towing-orders/${encodeURIComponent(code)}/inspection`, {
    verdict: payload.verdict,
    notes: payload.notes,
    photo_front: payload.photoFront,
    photo_rear: payload.photoRear,
    photo_left: payload.photoLeft,
    photo_right: payload.photoRight,
  });
}

export async function updateDriverLocation(latitude: number, longitude: number): Promise<void> {
  await driverApi.post('/v1/admin/driver/location', { latitude, longitude });
}

export async function scanDriverSettlementCode(code: string): Promise<SettlementFlag> {
  const res = await driverApi.post<{ data?: Record<string, unknown> }>(
    '/v1/admin/driver/claim-settlement/scan',
    { code },
  );
  return parseSettlementFlag(res.data?.data ?? {});
}

export async function settleDriverSettlementCode(code: string): Promise<SettlementFlag> {
  const res = await driverApi.post<{ data?: Record<string, unknown> }>(
    '/v1/admin/driver/claim-settlement/settle',
    { code },
  );
  return parseSettlementFlag(res.data?.data ?? {});
}

function handleDriverOrderStreamChunk(buffer: string, onChange: () => void): string {
  const blocks = buffer.split('\n\n');
  const rest = blocks.pop() ?? '';
  for (const block of blocks) {
    let event = 'message';
    let hasData = false;
    for (const line of block.split('\n')) {
      if (line.startsWith(':')) continue;
      if (line.startsWith('event:')) event = line.slice(6).trim();
      if (line.startsWith('data:')) hasData = true;
    }
    if (event === 'orders' && hasData) onChange();
  }
  return rest;
}

export function subscribeDriverTowingOrderChanges(args: {
  onChange: () => void;
  onError?: () => void;
}): () => void {
  let stopped = false;
  let reconnectTimer: number | undefined;
  let controller: AbortController | null = null;

  const connect = () => {
    if (stopped) return;
    const token = storage.getString(STORAGE_KEYS.driverToken);
    if (!token) return;

    controller = new AbortController();
    void fetch(`${env.apiBaseUrl}/v1/admin/driver/towing-orders/stream`, {
      method: 'GET',
      headers: {
        Accept: 'text/event-stream',
        Authorization: `Bearer ${token}`,
        'X-Channel': env.apiChannel,
        [NGROK_SKIP_BROWSER_WARNING_HEADER]: NGROK_SKIP_BROWSER_WARNING_VALUE,
      },
      signal: controller.signal,
    })
      .then(async (response) => {
        if (!response.ok || !response.body) throw new Error('stream unavailable');
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        while (!stopped) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          buffer = handleDriverOrderStreamChunk(buffer, args.onChange);
        }
      })
      .catch(() => {
        if (!stopped) args.onError?.();
      })
      .finally(() => {
        if (!stopped) reconnectTimer = window.setTimeout(connect, 3000);
      });
  };

  connect();

  return () => {
    stopped = true;
    if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
    controller?.abort();
  };
}
