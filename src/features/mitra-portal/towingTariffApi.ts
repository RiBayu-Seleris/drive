import { mitraApi } from '@/lib/api/client';

/**
 * Data penyedia derek milik mitra yang sedang login.
 *
 * Endpointnya sama dengan backoffice, tetapi untuk role `towing_admin`
 * cakupannya dikunci ke `admins.scope_id`: GET mengembalikan tepat satu
 * penyedia, PUT menolak id selain miliknya.
 */
export interface TowingService {
  id: number;
  name: string;
  address: string;
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
  providerType: string;
  partnerWorkshopId: number;
  ownerInsurerId: number;
  isAvailable: boolean;
  acceptingOrders: boolean;
  fleetCount: number;
  coverageArea: string;
  /** Tarif dalam Rupiah. */
  baseFare: number;
  /** Jarak (km) yang sudah termasuk dalam tarif dasar. */
  baseKm: number;
  perKmFare: number;
  nightSurcharge: number;
}

export interface TowingTariffInput {
  baseFare: number;
  baseKm: number;
  perKmFare: number;
  nightSurcharge: number;
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function num(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function bool(value: unknown, fallback = false): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function parseTowingService(json: Record<string, unknown>): TowingService {
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
    providerType: str(json.provider_type, 'TOWING_ONLY') || 'TOWING_ONLY',
    partnerWorkshopId: num(json.partner_workshop_id),
    ownerInsurerId: num(json.owner_insurer_id),
    isAvailable: bool(json.is_available, true),
    acceptingOrders: bool(json.accepting_orders, true),
    fleetCount: num(json.fleet_count),
    coverageArea: str(json.coverage_area),
    baseFare: num(json.base_fare),
    baseKm: num(json.base_km),
    perKmFare: num(json.per_km_fare),
    nightSurcharge: num(json.night_surcharge),
  };
}

/** Ambil penyedia derek milik mitra. `null` bila akun belum tertaut. */
export async function getTowingService(): Promise<TowingService | null> {
  const res = await mitraApi.get<{ data?: unknown }>('/v1/admin/towing-services');
  const envelope =
    res.data?.data && typeof res.data.data === 'object'
      ? (res.data.data as Record<string, unknown>)
      : {};
  const first = Array.isArray(envelope.data) ? (envelope.data as unknown[])[0] : null;
  if (!first || typeof first !== 'object') return null;
  return parseTowingService(first as Record<string, unknown>);
}

/**
 * Simpan tarif derek.
 *
 * Endpoint menimpa SELURUH kolom (bukan patch parsial), jadi `current` dipakai
 * mengirim ulang seluruh data profil yang tidak ada di form tarif. Rating dan
 * pemilik armada tidak ikut dikirim sebagai perubahan: keduanya dijaga backend.
 */
export async function updateTowingTariff(
  current: TowingService,
  input: TowingTariffInput,
): Promise<void> {
  await mitraApi.put(
    '/v1/admin/towing-services',
    {
      name: current.name,
      address: current.address,
      phone: current.phone,
      website: current.website,
      gmaps_url: current.gmapsUrl,
      image_url: current.imageUrl,
      gallery: current.gallery,
      open_status: current.openStatus,
      open_hours: current.openHours,
      latitude: current.latitude,
      longitude: current.longitude,
      provider_type: current.providerType,
      partner_workshop_id: current.partnerWorkshopId,
      owner_insurer_id: current.ownerInsurerId,
      is_available: current.isAvailable,
      accepting_orders: current.acceptingOrders,
      fleet_count: current.fleetCount,
      coverage_area: current.coverageArea,
      base_fare: input.baseFare,
      base_km: input.baseKm,
      per_km_fare: input.perKmFare,
      night_surcharge: input.nightSurcharge,
    },
    { params: { id: current.id } },
  );
}

/**
 * Cermin dari `CalculateTowingPrice` di backend — dipakai memperlihatkan contoh
 * harga sambil mitra mengetik. Angka yang benar tetap dihitung backend saat
 * order dibuat; ini hanya pratinjau.
 */
export function previewTowingPrice(tariff: TowingTariffInput, distanceKm: number, night: boolean) {
  let total = tariff.baseFare;
  if (distanceKm > tariff.baseKm) {
    total += Math.ceil(distanceKm - tariff.baseKm) * tariff.perKmFare;
  }
  if (night) total += tariff.nightSurcharge;
  return total < 0 ? 0 : total;
}
