import type { LucideIcon } from 'lucide-react';

/** Satu kartu aksi cepat di Home mitra. */
export interface QuickAction {
  key: string;
  label: string;
  /** Ilustrasi dari desain (path aset di public/). Prioritas di atas `icon`. */
  image?: string;
  icon?: LucideIcon;
  /** Warna latar ikon (kelas Tailwind bg + text) — hanya untuk `icon`. */
  tint?: string;
  /** Route tujuan; kosong = belum ada (tampilkan toast "segera hadir"). */
  to?: string;
}

/** Item aktivitas terkini (penugasan towing berjalan). */
export interface MitraActivity {
  id: string;
  driverName: string;
  driverAvatar?: string;
  description: string;
  time: string;
  fleetLabel: string;
}

/** Status operasional sopir towing. */
export type SopirStatus = 'aktif' | 'on_duty' | 'offline';

/** Dokumen legal yang dilampirkan pada profil sopir/armada. */
export interface MitraDocument {
  label: string;
  sub: string;
  ok: boolean;
}

/** Profil sopir towing (list + detail). */
export interface Sopir {
  id: string;
  code: string; // mis. DRV-0842
  name: string;
  avatar?: string;
  role: string; // mis. "Spesialis Pemulihan Senior"
  status: SopirStatus;
  fleetLabel: string; // mis. "Towing Flatbed #042"
  rating?: number;
  ratingCount?: number;
  destination?: string; // tujuan saat On Duty
  lastSeen?: string; // "2 jam lalu" saat offline
  phone: string;
  email: string;
  address: string;
  plate: string;
  vehicleType: string;
  lastService: string;
  serviceNote: string;
  trips: number;
  shiftHours: number;
  documents: MitraDocument[];
}

/** Status ketersediaan armada. */
export type ArmadaStatus = 'tersedia' | 'bertugas';

/** Satu titik pada riwayat perjalanan armada. */
export interface ArmadaTrip {
  id: string;
  route: string;
  label: string;
  meta: string;
}

/** Data armada towing (list + detail). */
export interface Armada {
  id: string;
  name: string; // Isuzu Giga FVR
  image?: string;
  type: string; // Flatbed Carrier
  category: string; // flatbed | heavy | motorcycle (untuk filter)
  plate: string; // B 9042 TWA
  status: ArmadaStatus;
  price?: string; // Rp 850.000
  capacity?: string; // 8.000 kg
  year?: string;
  engineNo?: string;
  health?: number; // 0-100
  odometer?: string;
  driverName?: string;
  driverSince?: string;
  driverRating?: number;
  trips?: ArmadaTrip[];
  location?: string;
}

/** Order/permintaan derek yang masuk ke mitra towing. */
export interface TowingOrder {
  id: string;
  category: string; // "Derek Ringan" | "Derek Gendong"
  vehicle: string; // "Toyota Avanza - Putih"
  address: string;
  distanceKm: number;
  etaMin: number;
}

/** Ikon kategori untuk item laporan/transaksi. */
export type MitraIconKey = 'truck' | 'user' | 'building' | 'wallet' | 'shield' | 'wrench';

/** Laporan tugas mitra ke AutoClaim. */
export interface Laporan {
  id: string; // TRX-99012
  iconKey: MitraIconKey;
  title: string; // nama klien / deskripsi singkat
  subtitle: string; // detail + area
  statusLabel: string; // "Menunggu Laporan" | "Sedang Diproses"
  statusTone: 'yellow' | 'blue' | 'green';
  actionable: boolean; // true → "Buat Laporan", false → "Lengkapi Data"
  archived: boolean; // true → tab Riwayat
}

/** Transaksi saldo/dompet mitra. */
export interface SaldoTx {
  id: string;
  iconKey: MitraIconKey;
  title: string;
  date: string;
  amount: number; // positif = masuk, negatif = keluar
  status: 'berhasil' | 'proses';
}

/** Rekening bank tujuan penarikan. */
export interface BankAccount {
  id: string;
  bank: string;
  /** Kode bank penyedia pembayaran. Kosong = rekening lama, belum bisa dikirimi otomatis. */
  bankCode: string;
  number: string;
  holder: string;
}

/** Item pekerjaan klaim/perbaikan pada portal bengkel. */
export interface WorkshopJob {
  id: string;
  customerName: string;
  vehicle: string;
  plateNumber: string;
  status: 'inspection' | 'waiting_parts' | 'repairing' | 'ready';
  severity: string;
  eta: string;
  intakeDate: string;
  address: string;
  tasks: string[];
  estimate: number;
}
