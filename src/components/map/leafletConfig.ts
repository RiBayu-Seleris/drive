import 'leaflet/dist/leaflet.css';
import { DEFAULT_LOCATION } from '@/config/constants';

/** Satu titik koordinat di peta. */
export interface MapPoint {
  lat: number;
  lng: number;
}

/** Titik default peta (Jakarta) bila lokasi belum diketahui. */
export const DEFAULT_MAP_POINT: MapPoint = {
  lat: DEFAULT_LOCATION.latitude,
  lng: DEFAULT_LOCATION.longitude,
};

/**
 * Konfigurasi peta bersama. Memakai OpenStreetMap (tanpa API key) — selaras
 * dengan autoclaim-flutter yang juga memakai OSM, bukan Google Maps.
 */
export const OSM_TILE_URL = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

export const OSM_TILE_ATTRIBUTION =
  '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> kontributor';

export const DEFAULT_MAP_ZOOM = 15;

/** Warna pin per peran titik di peta. */
export const MAP_PIN_COLOR = {
  default: '#aded1f',
  origin: '#3adfac',
  destination: '#df3a3a',
  driver: '#aded1f',
} as const;

export type MapPinVariant = keyof typeof MAP_PIN_COLOR;
