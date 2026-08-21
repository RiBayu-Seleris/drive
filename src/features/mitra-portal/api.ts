import { mitraApi } from '@/lib/api/client';
import { env } from '@/config/env';
import { STORAGE_KEYS } from '@/config/constants';
import {
  NGROK_SKIP_BROWSER_WARNING_HEADER,
  NGROK_SKIP_BROWSER_WARNING_VALUE,
} from '@/lib/api/headers';
import { storage } from '@/lib/storage/storage';

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function listFromEnvelope(data: unknown): Record<string, unknown>[] {
  const envelope = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const raw = Array.isArray(envelope.data) ? envelope.data : Array.isArray(data) ? data : [];
  return raw.filter(
    (item): item is Record<string, unknown> => item !== null && typeof item === 'object',
  );
}

function objectFromEnvelope(data: unknown): Record<string, unknown> {
  const envelope = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  const raw = envelope.data;
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
}

function totalFromEnvelope(data: unknown): number {
  const envelope = data && typeof data === 'object' ? (data as Record<string, unknown>) : {};
  return num(envelope.total);
}

export interface MitraTowingOrder {
  id: number;
  orderCode: string;
  userFullname: string;
  userPhone: string;
  inferenceTicket: string;
  towingType: string;
  pickupAddress: string;
  pickupLatitude: number;
  pickupLongitude: number;
  dropoffType: string;
  dropoffAddress: string;
  dropoffLatitude: number;
  dropoffLongitude: number;
  workshopName: string;
  towingName: string;
  driverId: number;
  driverFullname: string;
  fleetId: number;
  fleetPlateNumber: string;
  fleetType: string;
  status: string;
  priority: string;
  notes: string;
  quotedPrice: number;
  userPayable: number;
  requestedAt: string;
  reassignReason: string;
  reassignNote: string;
}

export interface MitraTowingDriver {
  id: number;
  towingServiceId: number;
  driverUserId: number;
  /** Email akun login sopir; kosong bila sopir belum punya akun. */
  email: string;
  towingName: string;
  fullname: string;
  phone: string;
  licenseNumber: string;
  vehiclePlate: string;
  fleetType: string;
  status: string;
  lastLatitude: number;
  lastLongitude: number;
  lastSeenAt: string;
  isActive: boolean;
}

export interface MitraTowingFleet {
  id: number;
  towingServiceId: number;
  towingName: string;
  plateNumber: string;
  fleetType: string;
  capacityLabel: string;
  photoUrl: string;
  status: string;
  lastLatitude: number;
  lastLongitude: number;
  lastSeenAt: string;
  isActive: boolean;
}

export interface MitraTowingDriverInput {
  fullname: string;
  phone: string;
  licenseNumber?: string;
  vehiclePlate?: string;
  fleetType?: string;
  status?: string;
  isActive?: boolean;
}

export interface MitraTowingDriverAccountInput {
  driverId: number;
  email: string;
  password: string;
}

export interface MitraTowingFleetInput {
  plateNumber: string;
  fleetType?: string;
  capacityLabel?: string;
  photoUrl?: string;
  status?: string;
  isActive?: boolean;
  /**
   * Posisi terakhir armada. WAJIB dikirim ulang saat update: endpoint PUT
   * menimpa seluruh kolom, jadi membiarkannya kosong akan MENGHAPUS lokasi
   * terakhir yang sudah tercatat.
   */
  lastLatitude?: number;
  lastLongitude?: number;
}

export interface Paginated<T> {
  data: T[];
  total: number;
}

export const TOWING_FLEET_TYPE_OPTIONS = [
  { value: 'FLATBED', label: 'Flatbed Carrier' },
  { value: 'HEAVY_DUTY', label: 'Heavy Duty Towing' },
  { value: 'MOTORCYCLE', label: 'Motorcycle Carrier' },
  { value: 'WHEEL_LIFT', label: 'Wheel Lift Tow' },
] as const;

export function parseMitraTowingOrder(json: Record<string, unknown>): MitraTowingOrder {
  return {
    id: num(json.id),
    orderCode: str(json.order_code),
    userFullname: str(json.user_fullname),
    userPhone: str(json.user_phone),
    inferenceTicket: str(json.inference_ticket),
    towingType: str(json.towing_type, 'TOWING_ONLY'),
    pickupAddress: str(json.pickup_address),
    pickupLatitude: num(json.pickup_latitude),
    pickupLongitude: num(json.pickup_longitude),
    dropoffType: str(json.dropoff_type, 'WORKSHOP'),
    dropoffAddress: str(json.dropoff_address),
    dropoffLatitude: num(json.dropoff_latitude),
    dropoffLongitude: num(json.dropoff_longitude),
    workshopName: str(json.workshop_name),
    towingName: str(json.towing_name),
    driverId: num(json.driver_id),
    driverFullname: str(json.driver_fullname),
    fleetId: num(json.fleet_id),
    fleetPlateNumber: str(json.fleet_plate_number),
    fleetType: str(json.fleet_type),
    status: str(json.status, 'REQUESTED'),
    priority: str(json.priority, 'NORMAL'),
    notes: str(json.notes),
    quotedPrice: num(json.quoted_price),
    userPayable: num(json.user_payable),
    requestedAt: str(json.requested_at),
    reassignReason: str(json.reassign_reason),
    reassignNote: str(json.reassign_note),
  };
}

export function parseMitraTowingDriver(json: Record<string, unknown>): MitraTowingDriver {
  return {
    id: num(json.id),
    towingServiceId: num(json.towing_service_id),
    driverUserId: num(json.driver_user_id),
    email: str(json.email),
    towingName: str(json.towing_name),
    fullname: str(json.fullname),
    phone: str(json.phone),
    licenseNumber: str(json.license_number),
    vehiclePlate: str(json.vehicle_plate),
    fleetType: str(json.fleet_type, 'FLATBED'),
    status: str(json.status, 'AVAILABLE'),
    lastLatitude: num(json.last_latitude),
    lastLongitude: num(json.last_longitude),
    lastSeenAt: str(json.last_seen_at),
    isActive: bool(json.is_active, true),
  };
}

export function parseMitraTowingFleet(json: Record<string, unknown>): MitraTowingFleet {
  return {
    id: num(json.id),
    towingServiceId: num(json.towing_service_id),
    towingName: str(json.towing_name),
    plateNumber: str(json.plate_number),
    fleetType: str(json.fleet_type, 'FLATBED'),
    capacityLabel: str(json.capacity_label),
    photoUrl: str(json.photo_url),
    status: str(json.status, 'AVAILABLE'),
    lastLatitude: num(json.last_latitude),
    lastLongitude: num(json.last_longitude),
    lastSeenAt: str(json.last_seen_at),
    isActive: bool(json.is_active, true),
  };
}

export async function getMitraTowingOrders(params?: {
  status?: string;
  page?: number;
  limit?: number;
}): Promise<Paginated<MitraTowingOrder>> {
  const res = await mitraApi.get<{ data?: unknown }>('/v1/admin/towing-orders', {
    params: {
      page: params?.page ?? 1,
      limit: params?.limit ?? 50,
      status: params?.status || undefined,
    },
  });
  const envelope = res.data?.data;
  return {
    data: listFromEnvelope(envelope).map(parseMitraTowingOrder),
    total: totalFromEnvelope(envelope),
  };
}

export async function getMitraTowingDrivers(): Promise<MitraTowingDriver[]> {
  const res = await mitraApi.get<{ data?: unknown }>('/v1/admin/towing-drivers', {
    params: { page: 1, limit: 100 },
  });
  return listFromEnvelope(res.data?.data).map(parseMitraTowingDriver);
}

export async function getMitraTowingFleets(): Promise<MitraTowingFleet[]> {
  const res = await mitraApi.get<{ data?: unknown }>('/v1/admin/towing-fleets', {
    params: { page: 1, limit: 100 },
  });
  return listFromEnvelope(res.data?.data).map(parseMitraTowingFleet);
}

export async function createMitraTowingDriver(
  input: MitraTowingDriverInput,
): Promise<MitraTowingDriver> {
  const res = await mitraApi.post<{ data?: unknown }>('/v1/admin/towing-drivers', {
    fullname: input.fullname,
    phone: input.phone,
    license_number: input.licenseNumber ?? '',
    vehicle_plate: input.vehiclePlate ?? '',
    fleet_type: input.fleetType ?? 'FLATBED',
    status: input.status ?? 'AVAILABLE',
    is_active: input.isActive ?? true,
  });
  return parseMitraTowingDriver(objectFromEnvelope(res.data));
}

export async function createMitraTowingDriverAccount(
  input: MitraTowingDriverAccountInput,
): Promise<void> {
  await mitraApi.post('/v1/admin/towing-drivers/account', {
    driver_id: input.driverId,
    email: input.email,
    password: input.password,
  });
}

/**
 * Setel ulang kata sandi akun sopir (dipakai saat sopir lupa password). Password
 * lama tidak bisa dibaca — tersimpan sebagai hash — jadi admin membuat yang baru
 * lalu menyampaikannya ke sopir. Mengembalikan email akun untuk ditampilkan.
 */
export async function resetMitraTowingDriverPassword(input: {
  driverId: number;
  password: string;
}): Promise<string> {
  const res = await mitraApi.post<{ data?: { email?: string } }>(
    '/v1/admin/towing-drivers/reset-password',
    { driver_id: input.driverId, password: input.password },
  );
  return res.data?.data?.email ?? '';
}

export async function updateMitraTowingDriver(
  id: number,
  input: MitraTowingDriverInput,
): Promise<void> {
  await mitraApi.put(
    '/v1/admin/towing-drivers',
    {
      fullname: input.fullname,
      phone: input.phone,
      license_number: input.licenseNumber ?? '',
      vehicle_plate: input.vehiclePlate ?? '',
      fleet_type: input.fleetType ?? 'FLATBED',
      status: input.status ?? 'AVAILABLE',
      is_active: input.isActive ?? true,
    },
    { params: { id } },
  );
}

export async function deleteMitraTowingDriver(id: number): Promise<void> {
  await mitraApi.delete('/v1/admin/towing-drivers', { params: { id } });
}

export async function createMitraTowingFleet(
  input: MitraTowingFleetInput,
): Promise<MitraTowingFleet> {
  const res = await mitraApi.post<{ data?: unknown }>('/v1/admin/towing-fleets', {
    plate_number: input.plateNumber,
    fleet_type: input.fleetType ?? 'FLATBED',
    capacity_label: input.capacityLabel ?? '',
    photo_url: input.photoUrl ?? '',
    status: input.status ?? 'AVAILABLE',
    is_active: input.isActive ?? true,
  });
  return parseMitraTowingFleet(objectFromEnvelope(res.data));
}

/**
 * Ubah data armada milik mitra yang sedang login.
 *
 * Backend menimpa SELURUH kolom (bukan patch parsial), jadi pemanggil wajib
 * mengirim nilai lengkap — termasuk `lastLatitude`/`lastLongitude` milik armada
 * saat ini — supaya data yang tidak diubah tidak ikut terhapus.
 */
export async function updateMitraTowingFleet(
  id: number,
  input: MitraTowingFleetInput,
): Promise<void> {
  await mitraApi.put(
    '/v1/admin/towing-fleets',
    {
      plate_number: input.plateNumber,
      fleet_type: input.fleetType ?? 'FLATBED',
      capacity_label: input.capacityLabel ?? '',
      photo_url: input.photoUrl ?? '',
      status: input.status ?? 'AVAILABLE',
      is_active: input.isActive ?? true,
      last_latitude: input.lastLatitude ?? 0,
      last_longitude: input.lastLongitude ?? 0,
    },
    { params: { id } },
  );
}

export async function acceptMitraTowingOrder(args: {
  orderId: number;
  driverId: number;
  fleetId: number;
}): Promise<void> {
  await mitraApi.post('/v1/admin/towing-orders/accept', {
    order_id: args.orderId,
    driver_id: args.driverId,
    fleet_id: args.fleetId,
  });
}

export async function rejectMitraTowingOrder(orderId: number): Promise<string> {
  const res = await mitraApi.post<{ data?: { status?: string } }>(
    '/v1/admin/towing-orders/reject',
    {
      order_id: orderId,
    },
  );
  return res.data?.data?.status ?? 'REJECTED';
}

/** Tugaskan ulang order yang dikembalikan sopir (sopir menolak / armada tidak layak). */
export async function reassignMitraTowingOrder(args: {
  orderId: number;
  driverId: number;
  fleetId: number;
}): Promise<void> {
  await mitraApi.post('/v1/admin/towing-orders/reassign', {
    order_id: args.orderId,
    driver_id: args.driverId,
    fleet_id: args.fleetId,
  });
}

/** Label alasan penugasan ulang untuk ditampilkan ke admin mitra. */
export function reassignReasonLabel(reason: string): string {
  switch (reason) {
    case 'DRIVER_DECLINED':
      return 'Sopir menolak';
    case 'FLEET_UNFIT':
      return 'Armada tidak layak';
    default:
      return 'Perlu penugasan ulang';
  }
}

function handleTowingOrderStreamChunk(buffer: string, onChange: () => void): string {
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

export function subscribeMitraTowingOrderChanges(args: {
  onChange: () => void;
  onError?: () => void;
}): () => void {
  let stopped = false;
  let reconnectTimer: number | undefined;
  let controller: AbortController | null = null;

  const connect = () => {
    if (stopped) return;
    const token = storage.getString(STORAGE_KEYS.mitraToken);
    if (!token) return;

    controller = new AbortController();
    void fetch(`${env.apiBaseUrl}/v1/admin/towing-orders/stream`, {
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
          buffer = handleTowingOrderStreamChunk(buffer, args.onChange);
        }
      })
      .catch(() => {
        if (!stopped) args.onError?.();
      })
      .finally(() => {
        if (!stopped) {
          reconnectTimer = window.setTimeout(connect, 3000);
        }
      });
  };

  connect();

  return () => {
    stopped = true;
    if (reconnectTimer !== undefined) window.clearTimeout(reconnectTimer);
    controller?.abort();
  };
}

export function isAvailableDriver(driver: MitraTowingDriver): boolean {
  return driver.isActive && driver.status === 'AVAILABLE';
}

export function isAvailableFleet(fleet: MitraTowingFleet): boolean {
  return fleet.isActive && fleet.status === 'AVAILABLE';
}

export function towingStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    REQUESTED: 'Menunggu Dispatch',
    PENDING_ASSIGNMENT: 'Menunggu Penugasan',
    OFFERED: 'Order Masuk',
    ASSIGNED: 'Ditugaskan',
    EN_ROUTE_TO_PICKUP: 'Menuju Jemput',
    ARRIVED_PICKUP: 'Tiba di Lokasi',
    PICKED_UP: 'Kendaraan Diangkut',
    EN_ROUTE_TO_DROPOFF: 'Menuju Tujuan',
    DROPPED_OFF: 'Tiba di Tujuan',
    COMPLETED: 'Selesai',
    CANCELED: 'Dibatalkan',
  };
  return labels[status] ?? status;
}

export function driverStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    AVAILABLE: 'Tersedia',
    BUSY: 'Bertugas',
    OFFLINE: 'Offline',
    INACTIVE: 'Nonaktif',
  };
  return labels[status] ?? status;
}

export function fleetStatusLabel(status: string): string {
  return driverStatusLabel(status);
}

/** Status armada yang diterima backend (`validateTowingFleetPayload`). */
export const TOWING_FLEET_STATUS_OPTIONS = [
  { value: 'AVAILABLE', label: 'Tersedia' },
  { value: 'BUSY', label: 'Bertugas' },
  { value: 'OFFLINE', label: 'Offline' },
  { value: 'INACTIVE', label: 'Nonaktif' },
] as const;

export function fleetTypeLabel(type: string): string {
  const item = TOWING_FLEET_TYPE_OPTIONS.find((option) => option.value === type);
  return item?.label ?? type;
}
