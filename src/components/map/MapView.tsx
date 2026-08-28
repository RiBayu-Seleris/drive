import { useEffect, useRef } from 'react';
import {
  CircleMarker,
  Circle,
  MapContainer,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
} from 'react-leaflet';
import { LatLngBounds, type LatLngExpression } from 'leaflet';
import { cn } from '@/lib/utils/cn';
import {
  DEFAULT_MAP_ZOOM,
  MAP_PIN_COLOR,
  OSM_TILE_ATTRIBUTION,
  OSM_TILE_URL,
  type MapPinVariant,
  type MapPoint,
} from './leafletConfig';

export type { MapPoint };

export interface MapMarker extends MapPoint {
  label?: string;
  variant?: MapPinVariant;
}

interface MapViewProps {
  center: MapPoint;
  zoom?: number;
  markers?: MapMarker[];
  /** Garis penghubung antar titik (mis. sopir → lokasi jemput). */
  polyline?: MapPoint[];
  /** Sesuaikan tampilan agar semua marker terlihat. */
  fitToMarkers?: boolean;
  /**
   * Titik yang diikuti peta (mode "ikuti posisi"). Selama terisi, peta bergeser
   * mengikutinya dan `fitToMarkers` diabaikan — kalau tidak, peta akan menarik
   * diri kembali setiap posisi diperbarui dan pengguna tidak bisa menggeser.
   */
  follow?: MapPoint | null;
  /** Dipanggil saat pengguna menggeser peta (biasanya untuk mematikan follow). */
  onUserDrag?: () => void;
  /** Radius akurasi posisi pengguna dalam meter; digambar sebagai lingkaran samar. */
  accuracyMeters?: number;
  className?: string;
}

/** Mengarahkan ulang peta saat pusat berubah, mengikuti titik, atau fit-to-markers. */
function MapAutoView({
  center,
  zoom,
  markers,
  fitToMarkers,
  follow,
}: {
  center: MapPoint;
  zoom: number;
  markers: MapMarker[];
  fitToMarkers: boolean;
  follow?: MapPoint | null;
}) {
  const map = useMap();
  // Array marker lahir baru tiap render; kalau dipakai sebagai dependency,
  // efek ini jalan terus dan peta memposisikan ulang dirinya tanpa henti.
  // Yang menentukan cuma koordinatnya, jadi itu yang dijadikan penanda.
  const markersRef = useRef(markers);
  markersRef.current = markers;
  const signature = markers.map((marker) => `${marker.lat},${marker.lng}`).join('|');
  const followLat = follow?.lat;
  const followLng = follow?.lng;

  useEffect(() => {
    if (followLat !== undefined && followLng !== undefined) {
      map.setView([followLat, followLng], map.getZoom(), { animate: true });
      return;
    }
    const current = markersRef.current;
    if (fitToMarkers && current.length > 1) {
      const bounds = new LatLngBounds(current.map((m) => [m.lat, m.lng] as LatLngExpression));
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      return;
    }
    map.setView([center.lat, center.lng], zoom);
  }, [map, center.lat, center.lng, zoom, fitToMarkers, signature, followLat, followLng]);

  return null;
}

/** Mematikan mode ikuti begitu pengguna menggeser peta sendiri, seperti gmaps. */
function MapDragWatcher({ onUserDrag }: { onUserDrag: () => void }) {
  useMapEvents({ dragstart: onUserDrag });
  return null;
}

/**
 * Leaflet mengukur container-nya sekali saat mount. Kalau saat itu tingginya
 * masih 0 (mis. dipakai di dalam `flex-1` yang baru dapat tinggi setelah
 * layout selesai), peta ikut lahir 0px dan tampil kosong selamanya. Ukur ulang
 * setelah frame pertama dan setiap kali container berubah ukuran.
 */
function MapAutoSize() {
  const map = useMap();

  useEffect(() => {
    const refresh = () => map.invalidateSize();
    const frame = requestAnimationFrame(refresh);
    const observer = new ResizeObserver(refresh);
    observer.observe(map.getContainer());
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [map]);

  return null;
}

/**
 * Peta tampilan (read-only) berbasis OpenStreetMap: menampilkan marker
 * berwarna sesuai peran + garis rute opsional.
 */
export function MapView({
  center,
  zoom = DEFAULT_MAP_ZOOM,
  markers = [],
  polyline,
  fitToMarkers = false,
  follow,
  onUserDrag,
  accuracyMeters = 0,
  className,
}: MapViewProps) {
  return (
    <MapContainer
      center={[center.lat, center.lng]}
      zoom={zoom}
      scrollWheelZoom={false}
      className={cn('h-56 w-full overflow-hidden rounded-lg', className)}
    >
      <TileLayer url={OSM_TILE_URL} attribution={OSM_TILE_ATTRIBUTION} />
      {follow && accuracyMeters > 0 && (
        <Circle
          center={[follow.lat, follow.lng]}
          radius={accuracyMeters}
          pathOptions={{
            color: MAP_PIN_COLOR.origin,
            weight: 1,
            fillColor: MAP_PIN_COLOR.origin,
            fillOpacity: 0.12,
          }}
        />
      )}
      {polyline && polyline.length > 1 && (
        <Polyline
          positions={polyline.map((p) => [p.lat, p.lng] as LatLngExpression)}
          pathOptions={{ color: MAP_PIN_COLOR.driver, weight: 4, opacity: 0.7 }}
        />
      )}
      {markers.map((marker, index) => (
        <CircleMarker
          key={`${marker.lat}-${marker.lng}-${index}`}
          center={[marker.lat, marker.lng]}
          radius={9}
          pathOptions={{
            color: '#eef4f8',
            weight: 3,
            fillColor: MAP_PIN_COLOR[marker.variant ?? 'default'],
            fillOpacity: 1,
          }}
        >
          {marker.label && (
            <Tooltip direction="top" offset={[0, -8]}>
              {marker.label}
            </Tooltip>
          )}
        </CircleMarker>
      ))}
      <MapAutoView
        center={center}
        zoom={zoom}
        markers={markers}
        fitToMarkers={fitToMarkers}
        follow={follow}
      />
      <MapAutoSize />
      {onUserDrag && <MapDragWatcher onUserDrag={onUserDrag} />}
    </MapContainer>
  );
}
