import { create } from 'zustand';
import { STORAGE_KEYS } from '@/config/constants';
import { storage } from '@/lib/storage/storage';
import { VEHICLE_SIDES, type CapturedImage, type VehicleSideState } from '../types';
import { normalizePlate } from '../utils/plate';
import type { InsuranceCoverage } from '../services/types';

export type InsuranceStatus = 'idle' | 'checking' | 'insured' | 'not_insured' | 'error';
/**
 * Asal-usul pemindaian. Menentukan alur foto, judul layar, dan perlakuan hasil.
 *
 * Bantuan Darurat dulu juga memulai pemindaian kelayakan asuransi, tapi
 * pintasannya sudah diganti jadi "Ajukan Klaim" — membeli polis untuk kendaraan
 * yang baru saja rusak memang tidak masuk akal. Tersisa dua asal: cek kondisi
 * biasa, dan penilaian kelayakan sebelum membeli polis.
 */
export type ScanPurpose = 'standard' | 'insurance_purchase';

/** Pemindaian untuk menilai kelayakan asuransi (foto 4 sisi wajib). */
export function isInsuranceScan(purpose: ScanPurpose): boolean {
  return purpose === 'insurance_purchase';
}

interface PlateState {
  image: CapturedImage | null;
  number: string | null;
  /** Cara plat diperoleh: hasil OCR atau diketik manual. */
  source: 'ocr' | 'manual' | null;
}

interface StoredInsuranceCoverage {
  plateNumber: string;
  coverage: InsuranceCoverage;
}

export interface VehicleScanInfo {
  brandModel: string;
  color: string;
  year: string;
  /** Jenis kendaraan (Mobil/Motor/SUV/…), disamakan dengan kendaraan tersimpan. */
  type: string;
}

/** Kendaraan tersimpan yang dipilih user di awal alur cek (untuk prefill data & verifikasi plat). */
export interface SelectedVehicle {
  plate: string;
  name: string;
}

interface ScanState {
  plate: PlateState;
  vehicleInfo: VehicleScanInfo;
  selectedVehicle: SelectedVehicle | null;
  insuranceStatus: InsuranceStatus;
  insuranceCoverage: InsuranceCoverage | null;
  scanPurpose: ScanPurpose;
  /**
   * Kode produk yang sedang dibeli saat user dilempar ke alur pemindaian.
   *
   * Halaman pembelian menerima produknya lewat state router, dan state itu
   * musnah begitu berpindah halaman. Tanpa disimpan di sini, user yang selesai
   * memindai tidak punya jalan kembali ke produk yang tadi dipilihnya — ia
   * harus mencari dan memilih ulang dari daftar.
   */
  pendingProductCode: string | null;
  sides: VehicleSideState[];
  currentSideIndex: number;

  reset: () => void;
  setScanPurpose: (purpose: ScanPurpose) => void;
  setPendingProductCode: (code: string | null) => void;
  setVehicleInfo: (info: VehicleScanInfo) => void;
  setSelectedVehicle: (vehicle: SelectedVehicle | null) => void;
  setPlateImage: (image: CapturedImage | null) => void;
  setPlate: (number: string, source: 'ocr' | 'manual') => void;
  setInsurance: (status: InsuranceStatus, coverage?: InsuranceCoverage | null) => void;
  answerSide: (index: number, damaged: boolean) => void;
  setSidePhoto: (index: number, photo: CapturedImage) => void;
  clearSidePhoto: (index: number) => void;
  goToNextSide: () => void;
}

function freshSides(): VehicleSideState[] {
  return VEHICLE_SIDES.map((s) => ({ id: s.id, label: s.label, damaged: null, photo: null }));
}

function storedPlate(): PlateState {
  const number = normalizePlate(storage.getString(STORAGE_KEYS.lastScanPlateNumber) ?? '');
  const rawSource = storage.getString(STORAGE_KEYS.lastScanPlateSource);
  const source = rawSource === 'ocr' || rawSource === 'manual' ? rawSource : 'manual';
  return number ? { image: null, number, source } : { image: null, number: null, source: null };
}

function storedInsuranceForPlate(plateNumber: string | null): InsuranceCoverage | null {
  const normalizedPlate = normalizePlate(plateNumber ?? '');
  if (!normalizedPlate) return null;

  const cached = storage.getJSON<StoredInsuranceCoverage>(STORAGE_KEYS.insuranceCoverageCache);
  if (!cached?.coverage?.insured) return null;
  if (normalizePlate(cached.plateNumber) !== normalizedPlate) return null;
  return cached.coverage;
}

function rememberInsuranceCoverage(plateNumber: string | null, coverage: InsuranceCoverage | null) {
  const normalizedPlate = normalizePlate(plateNumber ?? '');
  if (!normalizedPlate || !coverage?.insured) return;
  storage.setJSON<StoredInsuranceCoverage>(STORAGE_KEYS.insuranceCoverageCache, {
    plateNumber: normalizedPlate,
    coverage,
  });
}

function forgetInsuranceCoverageForPlate(plateNumber: string | null) {
  const normalizedPlate = normalizePlate(plateNumber ?? '');
  const cached = storage.getJSON<StoredInsuranceCoverage>(STORAGE_KEYS.insuranceCoverageCache);
  if (!normalizedPlate || normalizePlate(cached?.plateNumber ?? '') !== normalizedPlate) return;
  storage.remove(STORAGE_KEYS.insuranceCoverageCache);
}

function clearStoredPlate() {
  storage.remove(STORAGE_KEYS.lastScanPlateNumber);
  storage.remove(STORAGE_KEYS.lastScanPlateSource);
}

function emptyVehicleInfo(): VehicleScanInfo {
  return { brandModel: '', color: '', year: '', type: '' };
}

const initialPlate = storedPlate();
const initialInsuranceCoverage = storedInsuranceForPlate(initialPlate.number);

export const useScanStore = create<ScanState>((set) => ({
  plate: initialPlate,
  vehicleInfo: emptyVehicleInfo(),
  selectedVehicle: null,
  insuranceStatus: initialInsuranceCoverage ? 'insured' : 'idle',
  insuranceCoverage: initialInsuranceCoverage,
  scanPurpose: 'standard',
  pendingProductCode: null,
  sides: freshSides(),
  currentSideIndex: 0,

  reset: () => {
    clearStoredPlate();
    set((state) => ({
      plate: { image: null, number: null, source: null },
      // Data kendaraan DIPERTAHANKAN melintasi reset().
      //
      // Yang dulu bikin aneh adalah penyimpanannya di browser: data mobil lama
      // muncul lagi berhari-hari kemudian saat memindai mobil yang berbeda. Itu
      // sudah dihapus — nilainya kini hanya hidup di memori dan hilang begitu
      // halaman dimuat ulang.
      //
      // Menghapusnya di sini pernah dicoba dan justru merusak: menekan tombol
      // pindai dari formulir pembelian memanggil reset(), sehingga data yang
      // baru saja diisi user langsung terbuang dan formulirnya kosong lagi
      // sesudah memindai.
      vehicleInfo: state.vehicleInfo,
      // Kendaraan terpilih dipertahankan agar verifikasi plat tetap jalan setelah
      // halaman scan memanggil reset() saat mount.
      selectedVehicle: state.selectedVehicle,
      insuranceStatus: 'idle',
      insuranceCoverage: null,
      // Tujuan scan (standard / insurance_purchase) ditetapkan saat masuk alur dan
      // harus bertahan melewati reset() antar-halaman agar mode asuransi tak hilang.
      scanPurpose: state.scanPurpose,
      // Alasan yang sama: halaman scan memanggil reset() saat mount, dan produk
      // yang sedang dibeli harus tetap diingat sampai pemindaiannya selesai.
      pendingProductCode: state.pendingProductCode,
      sides: freshSides(),
      currentSideIndex: 0,
    }));
  },

  setScanPurpose: (purpose) => set({ scanPurpose: purpose }),

  setPendingProductCode: (code) => set({ pendingProductCode: code }),

  setSelectedVehicle: (vehicle) => set({ selectedVehicle: vehicle }),

  setVehicleInfo: (info) => {
    const normalized = {
      brandModel: info.brandModel.trim(),
      color: info.color.trim(),
      year: info.year.trim(),
      type: info.type.trim(),
    };
    set({ vehicleInfo: normalized });
  },

  setPlateImage: (image) => {
    clearStoredPlate();
    set({
      plate: { image, number: null, source: null },
      insuranceStatus: 'idle',
      insuranceCoverage: null,
    });
  },

  setPlate: (number, source) => {
    const normalized = normalizePlate(number);
    storage.setString(STORAGE_KEYS.lastScanPlateNumber, normalized);
    storage.setString(STORAGE_KEYS.lastScanPlateSource, source);
    set((s) => ({
      plate: { ...s.plate, number: normalized, source },
      ...(s.plate.number !== normalized
        ? (() => {
            const cachedCoverage = storedInsuranceForPlate(normalized);
            return cachedCoverage
              ? { insuranceStatus: 'insured' as const, insuranceCoverage: cachedCoverage }
              : { insuranceStatus: 'idle' as const, insuranceCoverage: null };
          })()
        : {}),
    }));
  },

  setInsurance: (status, coverage) =>
    set((state) => {
      if (status === 'insured' && coverage?.insured) {
        rememberInsuranceCoverage(state.plate.number, coverage);
      } else if (status === 'not_insured') {
        forgetInsuranceCoverageForPlate(state.plate.number);
      }
      return { insuranceStatus: status, insuranceCoverage: coverage ?? null };
    }),

  answerSide: (index, damaged) =>
    set((s) => {
      const sides = s.sides.slice();
      const current = sides[index];
      if (!current) return {};
      sides[index] = { ...current, damaged, photo: damaged ? current.photo : null };
      return { sides };
    }),

  setSidePhoto: (index, photo) =>
    set((s) => {
      const sides = s.sides.slice();
      const current = sides[index];
      if (!current) return {};
      sides[index] = { ...current, photo };
      return { sides };
    }),

  clearSidePhoto: (index) =>
    set((s) => {
      const sides = s.sides.slice();
      const current = sides[index];
      if (!current) return {};
      sides[index] = { ...current, photo: null };
      return { sides };
    }),

  goToNextSide: () =>
    set((s) => ({ currentSideIndex: Math.min(s.currentSideIndex + 1, s.sides.length - 1) })),
}));
