import { BarChart3, FileText, PackageCheck, Receipt, Truck, UserRound, Wallet } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import type { MitraActivity, QuickAction } from '../types';

/**
 * Data contoh untuk Home mitra towing. Saat endpoint mitra siap, ganti dengan
 * data asli (saldo, aktivitas) tanpa mengubah komponen.
 */
export const TOWING_BALANCE = 2_900_000;

/*
 * Aksi cepat memakai ikon + tint, bukan berkas gambar.
 *
 * Sebelumnya enam ilustrasi SVG hasil ekspor Figma merek lama (biru–oranye,
 * total ~96 KB) yang menyala sendiri di atas latar gelap DRIVE. Portal bengkel
 * sudah lebih dulu memakai pola ikon+tint ini; towing sekarang menyusul supaya
 * dua portal terlihat seperti satu aplikasi, bukan dua.
 */
const TINT_BRAND = 'bg-deep-blue-50 text-deep-blue-600';
const TINT_GREEN = 'bg-green-cust/15 text-green-cust';
const TINT_AMBER = 'bg-warning/15 text-warning';
const TINT_RED = 'bg-[#df3a5e]/10 text-[#e76a85]';

export const TOWING_QUICK_ACTIONS: QuickAction[] = [
  {
    key: 'sopir',
    label: 'Data Sopir Towing',
    icon: UserRound,
    tint: TINT_BRAND,
    to: ROUTES.mitraSopir,
  },
  {
    key: 'armada',
    label: 'Armada Towing',
    icon: Truck,
    tint: TINT_AMBER,
    to: ROUTES.mitraArmada,
  },
  {
    key: 'saldo',
    label: 'Tarik Saldo',
    icon: Wallet,
    tint: TINT_RED,
    to: ROUTES.mitraTarikSaldo,
  },
  {
    key: 'laporan',
    label: 'Laporan Sopir Towing',
    icon: FileText,
    tint: TINT_GREEN,
    to: ROUTES.mitraLaporan,
  },
  {
    key: 'transaksi',
    label: 'Laporan Transaksi',
    icon: BarChart3,
    tint: TINT_BRAND,
    to: ROUTES.mitraSaldo,
  },
  {
    key: 'order',
    label: 'Order',
    icon: PackageCheck,
    tint: TINT_GREEN,
    to: ROUTES.mitraOrder,
  },
  {
    key: 'tarif',
    label: 'Tarif Derek',
    icon: Receipt,
    tint: TINT_AMBER,
    to: ROUTES.mitraTarif,
  },
];

export const TOWING_ACTIVITIES: MitraActivity[] = [
  {
    id: 'a1',
    driverName: 'Bapak Anto',
    description: 'Perjalanan menuju Tol Cikampek',
    time: '12.30',
    fleetLabel: 'Armada 1',
  },
  {
    id: 'a2',
    driverName: 'Bapak Anto',
    description: 'Perjalanan menuju Tol Cikampek',
    time: '12.30',
    fleetLabel: 'Armada 2',
  },
  {
    id: 'a3',
    driverName: 'Bapak Anto',
    description: 'Perjalanan menuju Tol Cikampek',
    time: '12.30',
    fleetLabel: 'Armada 3',
  },
];
