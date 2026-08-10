import { useEffect, useRef, useState } from 'react';
import { distanceMeters, type GeoPoint } from './distance';

/** Fix dengan akurasi lebih buruk dari ini diabaikan (meter). */
const MAX_ACCURACY_METERS = 100;
/** Pergeseran di bawah ini dianggap goyangan GPS, bukan gerakan (meter). */
const MIN_MOVE_METERS = 8;

export interface LiveLocation {
  point: GeoPoint | null;
  /** Radius akurasi fix terakhir dalam meter (0 bila belum ada). */
  accuracyMeters: number;
  /** Pesan siap tampil; kosong bila tidak ada masalah. */
  error: string;
  supported: boolean;
}

function errorMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Izin lokasi ditolak. Aktifkan lewat pengaturan browser.';
    case error.POSITION_UNAVAILABLE:
      return 'Lokasi tidak tersedia saat ini.';
    default:
      return 'Menunggu sinyal GPS…';
  }
}

/**
 * Mengikuti posisi pengguna secara berkelanjutan (`watchPosition`).
 *
 * Dua saringan supaya titiknya tidak menari-nari: fix dengan akurasi buruk
 * dibuang, dan pergeseran di bawah beberapa meter diabaikan. Fix pertama
 * selalu diterima apa pun akurasinya supaya pengguna desktop (yang lokasinya
 * ditebak dari IP) tetap melihat titiknya.
 *
 * Watcher dihentikan saat komponen dilepas — `watchPosition` yang bocor
 * menyalakan GPS di latar belakang dan menghabiskan baterai.
 */
export function useLiveLocation(enabled = true): LiveLocation {
  const supported = typeof navigator !== 'undefined' && 'geolocation' in navigator;
  const [state, setState] = useState<Omit<LiveLocation, 'supported'>>({
    point: null,
    accuracyMeters: 0,
    error: '',
  });
  const lastPointRef = useRef<GeoPoint | null>(null);

  useEffect(() => {
    if (!enabled || !supported) return;

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude, accuracy } = position.coords;
        const next: GeoPoint = { lat: latitude, lng: longitude };
        const last = lastPointRef.current;

        if (last) {
          if (accuracy > MAX_ACCURACY_METERS) return;
          if (distanceMeters(last, next) < MIN_MOVE_METERS) return;
        }

        lastPointRef.current = next;
        setState({ point: next, accuracyMeters: accuracy, error: '' });
      },
      (error) => setState((prev) => ({ ...prev, error: errorMessage(error) })),
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 15_000 },
    );

    return () => navigator.geolocation.clearWatch(watchId);
  }, [enabled, supported]);

  return { ...state, supported };
}
