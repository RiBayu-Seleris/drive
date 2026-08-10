/** Satu titik koordinat. Sengaja struktural agar cocok dengan `MapPoint`. */
export interface GeoPoint {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_METERS = 6_371_000;

const toRadians = (value: number): number => (value * Math.PI) / 180;

/**
 * Jarak garis lurus antar dua titik dalam meter (haversine).
 *
 * Dipakai untuk keputusan halus seperti menyaring jitter GPS, jadi hasilnya
 * sengaja tidak dibulatkan — berbeda dengan `haversineKm` di halaman sopir yang
 * membulatkan ke 0,1 km untuk keperluan tampilan.
 */
export function distanceMeters(from: GeoPoint, to: GeoPoint): number {
  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLng = toRadians(to.lng - from.lng);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(deltaLng / 2) ** 2;
  return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
