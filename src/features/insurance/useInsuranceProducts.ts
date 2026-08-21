import { useQuery } from '@tanstack/react-query';
import { getInsuranceProducts, type InsuranceProduct } from './api';

/**
 * Seberapa sering daftar produk disegarkan selama halamannya dibuka.
 *
 * Satu menit, bukan lebih rapat: harga dan ketentuan produk jarang berubah,
 * sementara ini berjalan di aplikasi nasabah — memanggil gateway tiap beberapa
 * detik cuma memboroskan kuota dan baterai tanpa ada yang berubah.
 *
 * Perubahan yang lebih mendesak sudah tertangani refetchOnWindowFocus:
 * begitu nasabah kembali ke aplikasi, datanya langsung diambil ulang.
 */
const PRODUCT_REFRESH_MS = 60_000;

/**
 * Daftar produk asuransi yang menyegarkan dirinya sendiri.
 *
 * refetchOnWindowFocus dinyalakan khusus di sini — bawaan global aplikasi ini
 * mematikannya. Untuk kebanyakan layar itu benar, tapi harga produk diubah dari
 * BackOffice oleh orang lain, jadi tanpa ini nasabah bisa melihat premi lama
 * sampai ia menutup dan membuka aplikasinya lagi.
 */
export function useInsuranceProducts(enabled = true) {
  return useQuery({
    queryKey: ['insurance-products'],
    queryFn: getInsuranceProducts,
    enabled,
    refetchOnWindowFocus: true,
    refetchInterval: PRODUCT_REFRESH_MS,
  });
}

/**
 * Produk yang sedang dibuka, selalu versi terbaru.
 *
 * Halaman detail & pembelian menerima produknya lewat state router — salinan
 * beku dari saat kartunya ditekan. Kalau harga produk diubah dari BackOffice
 * setelah itu, halaman yang sudah terbuka tidak pernah tahu, dan nasabah
 * membaca premi yang sudah tidak berlaku sampai ia memuat ulang halamannya.
 *
 * Di sini salinan beku itu cuma dipakai untuk mengenali produk MANA yang
 * dibuka; angkanya diambil dari data yang baru diambil. Salinan bekunya tetap
 * dipertahankan sebagai cadangan supaya halaman tidak kosong saat datanya belum
 * selesai dimuat atau jaringannya sedang mati.
 */
export function useLiveInsuranceProduct(
  snapshot: InsuranceProduct | null,
): InsuranceProduct | null {
  const { data } = useInsuranceProducts(Boolean(snapshot));
  if (!snapshot) return null;
  return data?.find((item) => item.code === snapshot.code) ?? snapshot;
}
