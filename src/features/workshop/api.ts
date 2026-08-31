import { userApi } from '@/lib/api/client';
import { DEFAULT_LOCATION } from '@/config/constants';

export interface RecommendationPlace {
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
  distanceKm: number;
  estimatedMinutes: number;
  acceptingOrders: boolean;
  /** Apakah bengkel ini punya layanan towing sendiri (false → tawarkan mitra lain). */
  towingAvailable: boolean;
  isInsurerPartner: boolean;
}

export interface WorkshopVisitRequest {
  id: number;
  visitCode: string;
  inferenceTicket: string;
  claimNumber: string;
  vehiclePlate: string;
  targetWorkshopId: number;
  workshopName: string;
  workshopAddress: string;
  workshopPhone: string;
  workshopWebsite: string;
  workshopGmapsUrl: string;
  workshopLatitude: number;
  workshopLongitude: number;
  workshopRating: number;
  arrivalMethod: 'SELF_DRIVE';
  originAddress: string;
  originLatitude: number;
  originLongitude: number;
  status: 'PLANNED' | 'ON_THE_WAY' | 'ARRIVED' | 'CANCELED' | 'COMPLETED';
  notes: string;
  createdAt: string;
}

function parsePlace(json: Record<string, unknown>): RecommendationPlace {
  const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0);
  const str = (v: unknown): string => (typeof v === 'string' ? v : '');
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
      ? json.gallery.filter((g): g is string => typeof g === 'string')
      : [],
    openStatus: str(json.open_status) || 'OPEN',
    openHours: str(json.open_hours),
    latitude: num(json.latitude),
    longitude: num(json.longitude),
    distanceKm: num(json.distance),
    estimatedMinutes: num(json.estimation_minutes),
    acceptingOrders: json.accepting_orders !== false,
    towingAvailable: json.towing_available !== false && json.has_towing !== false,
    isInsurerPartner: json.is_insurer_partner === true,
  };
}

function parseWorkshopVisit(json: Record<string, unknown>): WorkshopVisitRequest {
  const num = (v: unknown): number => (typeof v === 'number' ? v : Number(v) || 0);
  const str = (v: unknown): string => (typeof v === 'string' ? v : '');
  const status = str(json.status) as WorkshopVisitRequest['status'];
  return {
    id: num(json.id),
    visitCode: str(json.visit_code),
    inferenceTicket: str(json.inference_ticket),
    claimNumber: str(json.claim_number),
    vehiclePlate: str(json.vehicle_plate),
    targetWorkshopId: num(json.target_workshop_id),
    workshopName: str(json.workshop_name),
    workshopAddress: str(json.workshop_address),
    workshopPhone: str(json.workshop_phone),
    workshopWebsite: str(json.workshop_website),
    workshopGmapsUrl: str(json.workshop_gmaps_url),
    workshopLatitude: num(json.workshop_latitude),
    workshopLongitude: num(json.workshop_longitude),
    workshopRating: num(json.workshop_rating),
    arrivalMethod: 'SELF_DRIVE',
    originAddress: str(json.origin_address),
    originLatitude: num(json.origin_latitude),
    originLongitude: num(json.origin_longitude),
    status: status || 'PLANNED',
    notes: str(json.notes),
    createdAt: str(json.created_at),
  };
}

/** Target rekomendasi backend (POST /v1/recommender). */
export type RecommendationTarget = 'workshop' | 'hospital' | 'towing';

/**
 * Backend `/v1/recommender` mengharapkan nama target sesuai tabelnya
 * (REPAIR_STATION/HOSPITAL/TOWING), bukan label UI. Tanpa map ini, target
 * 'workshop' ditolak 400 "invalid recommendation target".
 */
const RECOMMENDER_TARGET: Record<RecommendationTarget, string> = {
  workshop: 'REPAIR_STATION',
  hospital: 'HOSPITAL',
  towing: 'TOWING',
};

export async function getRecommendations(
  target: RecommendationTarget,
  coords: { latitude: number; longitude: number } = DEFAULT_LOCATION,
  claimNumber = '',
): Promise<RecommendationPlace[]> {
  // Route backend terdaftar dengan trailing slash (`/recommender/`); tanpa slash
  // chi membalas 404 → UI "Gagal memuat data". Berlaku untuk bengkel/RS/towing.
  const res = await userApi.post<{ data?: { recommendations?: unknown[] } }>('/v1/recommender/', {
    latitude: coords.latitude,
    longitude: coords.longitude,
    target: RECOMMENDER_TARGET[target],
    claim_number: claimNumber,
  });
  const list = res.data?.data?.recommendations ?? [];
  return list
    .filter((e): e is Record<string, unknown> => typeof e === 'object' && e !== null)
    .map(parsePlace);
}

/**
 * Layanan darurat terdekat (derek / rumah sakit) — TANPA login.
 *
 * Memakai `/v1/recommender/emergency`, varian publik dari endpoint rekomendasi.
 * Layar darurat berada di alur scanning yang memang terbuka untuk tamu; versi
 * bertoken (`/v1/recommender/`) membalas 401 dan membuat halamannya gagal muat
 * bagi orang yang belum punya akun — justru di layar yang paling dibutuhkan
 * saat mobilnya mogok.
 *
 * `Authorization: undefined` mematikan penyisipan token: endpointnya publik,
 * dan token kedaluwarsa tidak boleh ikut memicu alur "sesi berakhir" di sini.
 */
export async function getEmergencyServices(
  target: 'towing' | 'hospital',
  coords: { latitude: number; longitude: number } = DEFAULT_LOCATION,
): Promise<RecommendationPlace[]> {
  const res = await userApi.post<{ data?: { recommendations?: unknown[] } }>(
    '/v1/recommender/emergency',
    {
      latitude: coords.latitude,
      longitude: coords.longitude,
      target: RECOMMENDER_TARGET[target],
      claim_number: '',
    },
    { headers: { Authorization: undefined } },
  );
  const list = res.data?.data?.recommendations ?? [];
  return list
    .filter((e): e is Record<string, unknown> => typeof e === 'object' && e !== null)
    .map(parsePlace);
}

export async function createWorkshopVisitRequest(payload: {
  targetWorkshopId: number;
  inferenceTicket?: string;
  claimNumber?: string;
  vehiclePlate?: string;
  originAddress?: string;
  originLatitude?: number;
  originLongitude?: number;
  notes?: string;
}): Promise<WorkshopVisitRequest> {
  const res = await userApi.post<{ data?: Record<string, unknown> }>('/v1/member/workshop-visits', {
    target_workshop_id: payload.targetWorkshopId,
    inference_ticket: payload.inferenceTicket ?? '',
    claim_number: payload.claimNumber ?? '',
    vehicle_plate: payload.vehiclePlate ?? '',
    origin_address: payload.originAddress ?? '',
    origin_latitude: payload.originLatitude ?? 0,
    origin_longitude: payload.originLongitude ?? 0,
    notes: payload.notes ?? '',
  });
  return parseWorkshopVisit(res.data?.data ?? {});
}

// ── Ulasan / rating bengkel (endpoint asli /v1/member/ratings) ──────────────

export interface WorkshopReview {
  id: number;
  score: number;
  comment: string;
  createdAt: string;
}

export interface WorkshopReviewSummary {
  average: number;
  count: number;
  reviews: WorkshopReview[];
  /** Jumlah ulasan per skor (1..5), untuk grafik distribusi. */
  distribution: Record<number, number>;
}

export async function getWorkshopReviews(workshopId: number): Promise<WorkshopReviewSummary> {
  const res = await userApi.get<{
    data?: { average?: number; count?: number; ratings?: unknown[] };
  }>('/v1/member/ratings', { params: { target_type: 'workshop', target_ref: String(workshopId) } });
  const data = res.data?.data ?? {};
  const reviews: WorkshopReview[] = (data.ratings ?? [])
    .filter((e): e is Record<string, unknown> => typeof e === 'object' && e !== null)
    .map((e) => ({
      id: typeof e.id === 'number' ? e.id : 0,
      score: typeof e.score === 'number' ? e.score : Number(e.score) || 0,
      comment: typeof e.comment === 'string' ? e.comment : '',
      createdAt: typeof e.created_at === 'string' ? e.created_at : '',
    }));
  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  for (const r of reviews) {
    const key = Math.min(5, Math.max(1, Math.round(r.score)));
    distribution[key] = (distribution[key] ?? 0) + 1;
  }
  return {
    average: typeof data.average === 'number' ? data.average : 0,
    count: typeof data.count === 'number' ? data.count : reviews.length,
    reviews,
    distribution,
  };
}

export async function submitWorkshopReview(
  workshopId: number,
  score: number,
  comment: string,
): Promise<void> {
  await userApi.post('/v1/member/ratings', {
    target_type: 'workshop',
    target_ref: String(workshopId),
    score,
    comment: comment.trim(),
  });
}
