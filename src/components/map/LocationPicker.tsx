import { useCallback, useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, useMapEvents } from 'react-leaflet';
import type { Map as LeafletMap } from 'leaflet';
import { LocateFixed, MapPin, Search } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { reverseGeocode, searchPlaces, type GeocodeResult } from '@/lib/geo/nominatim';
import {
  DEFAULT_MAP_POINT,
  DEFAULT_MAP_ZOOM,
  OSM_TILE_ATTRIBUTION,
  OSM_TILE_URL,
  type MapPoint,
} from './leafletConfig';

export interface PickedLocation {
  lat: number;
  lng: number;
  address: string;
  city: string;
  province: string;
}

interface LocationPickerProps {
  /** Titik awal peta. Default: Jakarta. */
  value?: MapPoint;
  onPick: (location: PickedLocation) => void;
  className?: string;
}

const SEARCH_DEBOUNCE_MS = 500;
const PICKED_ZOOM = 16;

/** Jembatan ke instance Leaflet: tangkap map + emit pusat saat selesai geser. */
function MapController({
  onReady,
  onMoveEnd,
}: {
  onReady: (map: LeafletMap) => void;
  onMoveEnd: (lat: number, lng: number) => void;
}) {
  const map = useMapEvents({
    moveend() {
      const center = map.getCenter();
      onMoveEnd(center.lat, center.lng);
    },
  });
  useEffect(() => onReady(map), [map, onReady]);
  return null;
}

/**
 * Pemilih lokasi di peta (OSM): pin tetap di tengah, geser peta untuk memilih
 * titik; alamat di-reverse-geocode otomatis. Dilengkapi pencarian alamat dan
 * tombol "lokasi saya".
 *
 * `onPick` hanya dipanggil saat user benar-benar memindahkan peta (bukan saat
 * mount) — agar tidak menimpa isian form ketika komponen ini di-mount ulang.
 */
export function LocationPicker({ value, onPick, className }: LocationPickerProps) {
  const mapRef = useRef<LeafletMap | null>(null);
  const [initialCenter] = useState<MapPoint>(value ?? DEFAULT_MAP_POINT);
  const [address, setAddress] = useState('');
  const [isResolving, setIsResolving] = useState(false);

  const [query, setQuery] = useState('');
  const [results, setResults] = useState<GeocodeResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [locating, setLocating] = useState(false);

  /** Reverse-geocode lalu (opsional) teruskan ke parent. */
  const resolve = useCallback(
    async (lat: number, lng: number, emit: boolean) => {
      setIsResolving(true);
      const result = await reverseGeocode(lat, lng);
      setIsResolving(false);
      const location: PickedLocation = {
        lat,
        lng,
        address: result?.displayName ?? '',
        city: result?.city ?? '',
        province: result?.province ?? '',
      };
      setAddress(location.address);
      if (emit) onPick(location);
    },
    [onPick],
  );

  // Tampilkan alamat titik awal (display-only) — tidak meng-emit ke form.
  const didInit = useRef(false);
  useEffect(() => {
    if (didInit.current) return;
    didInit.current = true;
    void resolve(initialCenter.lat, initialCenter.lng, false);
  }, [initialCenter, resolve]);

  const handleReady = useCallback((map: LeafletMap) => {
    mapRef.current = map;
  }, []);

  const handleMoveEnd = useCallback(
    (lat: number, lng: number) => void resolve(lat, lng, true),
    [resolve],
  );

  // Pencarian alamat dengan debounce (hormati kebijakan Nominatim ~1 req/s).
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 3) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    const timer = window.setTimeout(() => {
      void (async () => {
        setResults(await searchPlaces(trimmed));
        setIsSearching(false);
      })();
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [query]);

  // setView memicu moveend → resolve(emit) sehingga form ikut terisi.
  const flyTo = (lat: number, lng: number) => mapRef.current?.setView([lat, lng], PICKED_ZOOM);

  const handlePickResult = (result: GeocodeResult) => {
    setQuery('');
    setResults([]);
    flyTo(result.lat, result.lng);
  };

  const handleMyLocation = () => {
    if (!navigator.geolocation) return;
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        flyTo(pos.coords.latitude, pos.coords.longitude);
      },
      () => setLocating(false),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  };

  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-neutral-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Cari alamat / tempat"
          className="focus:border-deep-blue-500 h-10 w-full rounded-lg border border-neutral-400 bg-neutral-100 pr-3 pl-9 text-sm focus:outline-none"
        />
        {(results.length > 0 || isSearching) && (
          <div className="absolute z-1000 mt-1 w-full overflow-hidden rounded-lg border border-neutral-300 bg-neutral-100 shadow-lg">
            {isSearching ? (
              <p className="px-3 py-2 text-xs text-neutral-600">Mencari…</p>
            ) : (
              results.map((result) => (
                <button
                  key={`${result.lat}-${result.lng}`}
                  type="button"
                  onClick={() => handlePickResult(result)}
                  className="block w-full truncate px-3 py-2 text-left text-xs text-neutral-800 hover:bg-neutral-100"
                >
                  {result.displayName}
                </button>
              ))
            )}
          </div>
        )}
      </div>

      <div className="relative">
        <MapContainer
          center={[initialCenter.lat, initialCenter.lng]}
          zoom={DEFAULT_MAP_ZOOM}
          scrollWheelZoom
          className="h-60 w-full overflow-hidden rounded-lg"
        >
          <TileLayer url={OSM_TILE_URL} attribution={OSM_TILE_ATTRIBUTION} />
          <MapController onReady={handleReady} onMoveEnd={handleMoveEnd} />
        </MapContainer>

        {/* Pin tetap di tengah (overlay) — titik inilah yang dipilih. */}
        <div className="pointer-events-none absolute top-1/2 left-1/2 z-500 -translate-x-1/2 -translate-y-full">
          <MapPin className="size-9 text-[#e76a6a]" fill="#dd2c2c" strokeWidth={1.5} />
        </div>

        <button
          type="button"
          onClick={handleMyLocation}
          disabled={locating}
          aria-label="Gunakan lokasi saya"
          className="text-deep-blue-600 absolute right-3 bottom-3 z-600 flex size-10 items-center justify-center rounded-full bg-neutral-100 shadow-md disabled:opacity-60"
        >
          <LocateFixed className="size-5" />
        </button>
      </div>

      <p className="text-12 min-h-5 text-neutral-700">
        {isResolving ? 'Membaca alamat…' : address || 'Geser peta untuk memilih lokasi.'}
      </p>
    </div>
  );
}
