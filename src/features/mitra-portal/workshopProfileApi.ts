import { mitraApi } from '@/lib/api/client';

/**
 * Data bengkel milik mitra yang sedang login.
 *
 * Backend memakai endpoint admin yang sama dengan backoffice, tetapi untuk role
 * `workshop_admin` cakupannya dikunci ke `admins.scope_id` — GET mengembalikan
 * tepat satu bengkel dan PUT menolak id selain miliknya.
 */
export interface WorkshopProfile {
  id: number;
  name: string;
  address: string;
  /** Bintang hasil ulasan pelanggan; ditampilkan saja, tidak bisa diubah mitra. */
  rating: number;
  phone: string;
  website: string;
  gmapsUrl: string;
  imageUrl: string;
  gallery: string[];
  openStatus: string;
  openHours: string;
  latitude: number;
  longitude: number;
  acceptingOrders: boolean;
  workloadStatus: string;
}

/** Field yang boleh diubah mitra dari portal. */
export interface WorkshopProfileInput {
  name: string;
  address: string;
  phone: string;
  website: string;
  imageUrl: string;
  openStatus: string;
  openHours: string;
  latitude: number;
  longitude: number;
  acceptingOrders: boolean;
  workloadStatus: string;
}

export const WORKSHOP_OPEN_STATUS_OPTIONS = [
  { value: 'OPEN', label: 'Buka — melayani pelanggan' },
  { value: 'CLOSED', label: 'Tutup — sedang tidak melayani' },
] as const;

export const WORKSHOP_WORKLOAD_OPTIONS = [
  { value: 'NORMAL', label: 'Normal — antrean lancar' },
  { value: 'BUSY', label: 'Padat — antrean mulai panjang' },
  { value: 'OVERLOADED', label: 'Penuh — hampir tidak bisa menerima lagi' },
  { value: 'CLOSED', label: 'Berhenti menerima — bengkel sedang tutup' },
] as const;

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function parseWorkshopProfile(json: Record<string, unknown>): WorkshopProfile {
  return {
    id: num(json.id),
    name: str(json.name),
    address: str(json.address),
    rating: num(json.rating),
    phone: str(json.phone),
    website: str(json.website),
    gmapsUrl: str(json.gmaps_url),
    imageUrl: str(json.image_url),
    gallery: Array.isArray(json.gallery)
      ? json.gallery.filter((item): item is string => typeof item === 'string')
      : [],
    openStatus: str(json.open_status, 'OPEN') || 'OPEN',
    openHours: str(json.open_hours),
    latitude: num(json.latitude),
    longitude: num(json.longitude),
    acceptingOrders: bool(json.accepting_orders, true),
    workloadStatus: str(json.workload_status, 'NORMAL') || 'NORMAL',
  };
}

/**
 * Ambil data bengkel milik mitra. Backend membalas daftar berisi satu item;
 * `null` berarti scope admin belum tertaut ke bengkel manapun.
 */
export async function getWorkshopProfile(): Promise<WorkshopProfile | null> {
  const res = await mitraApi.get<{ data?: unknown }>('/v1/admin/workshops');
  const envelope =
    res.data?.data && typeof res.data.data === 'object'
      ? (res.data.data as Record<string, unknown>)
      : {};
  const first = Array.isArray(envelope.data) ? (envelope.data as unknown[])[0] : null;
  if (!first || typeof first !== 'object') return null;
  return parseWorkshopProfile(first as Record<string, unknown>);
}

/**
 * Simpan perubahan data bengkel.
 *
 * Endpoint menimpa SELURUH kolom (bukan patch parsial), jadi `current` dipakai
 * untuk mengirim ulang kolom yang tidak ada di form — galeri foto dan tautan
 * Google Maps — supaya tidak ikut terhapus. Rating sengaja tidak dikirim: nilai
 * itu dijaga backend dari ulasan pelanggan.
 */
export async function updateWorkshopProfile(
  current: WorkshopProfile,
  input: WorkshopProfileInput,
): Promise<void> {
  await mitraApi.put(
    '/v1/admin/workshops',
    {
      name: input.name,
      address: input.address,
      phone: input.phone,
      website: input.website,
      gmaps_url: current.gmapsUrl,
      image_url: input.imageUrl,
      gallery: current.gallery,
      open_status: input.openStatus,
      open_hours: input.openHours,
      latitude: input.latitude,
      longitude: input.longitude,
      accepting_orders: input.acceptingOrders,
      workload_status: input.workloadStatus,
    },
    { params: { id: current.id } },
  );
}
