import { env } from '@/config/env';
import type { GeoPoint } from './distance';

/**
 * Pembungkus tipis OSRM (Open Source Routing Machine) untuk rute berkendara
 * yang mengikuti jalan — bukan garis lurus antar titik.
 *
 * Server default `router.project-osrm.org` gratis tanpa API key, tapi itu
 * server demo tanpa jaminan ketersediaan: jangan dipakai untuk trafik
 * produksi. Ganti lewat `VITE_OSRM_BASE_URL` (OSRM self-host, Mapbox
 * Directions, dsb.) saat naik produksi.
 *
 * Semua kegagalan (jaringan, rate limit, rute tidak ditemukan) mengembalikan
 * null, bukan melempar — pemanggil jatuh ke garis lurus supaya peta tetap
 * berguna alih-alih menampilkan layar error.
 */

export interface DrivingRoute {
  /** Titik-titik garis rute, siap dipakai sebagai `polyline` MapView. */
  path: GeoPoint[];
  distanceKm: number;
  durationMinutes: number;
}

interface OsrmRoute {
  distance?: number;
  duration?: number;
  geometry?: { coordinates?: [number, number][] };
}

interface OsrmResponse {
  code?: string;
  routes?: OsrmRoute[];
}

export async function getDrivingRoute(
  from: GeoPoint,
  to: GeoPoint,
  signal?: AbortSignal,
): Promise<DrivingRoute | null> {
  // OSRM memakai urutan lon,lat — kebalikan dari lat,lng yang dipakai Leaflet.
  const coordinates = `${from.lng},${from.lat};${to.lng},${to.lat}`;
  const url = `${env.osrmBaseUrl}/route/v1/driving/${coordinates}?overview=full&geometries=geojson`;

  try {
    const response = await fetch(url, { signal });
    if (!response.ok) return null;

    const data = (await response.json()) as OsrmResponse;
    const route = data.code === 'Ok' ? data.routes?.[0] : undefined;
    const line = route?.geometry?.coordinates;
    if (!route || !line?.length) return null;

    return {
      path: line.map(([lng, lat]) => ({ lat, lng })),
      distanceKm: (route.distance ?? 0) / 1000,
      durationMinutes: (route.duration ?? 0) / 60,
    };
  } catch {
    return null;
  }
}
