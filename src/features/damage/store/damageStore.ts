import { create } from 'zustand';
import { STORAGE_KEYS } from '@/config/constants';
import { storage } from '@/lib/storage/storage';
import type { DamageResult } from '../types';

interface DamageState {
  result: DamageResult | null;
  /**
   * Sidik jari foto & plat yang menghasilkan `result`.
   *
   * Dipakai halaman review untuk mengenali "ini persis yang barusan
   * dianalisis". Tanpa ini, kembali ke review lalu menekan tombolnya lagi
   * mengirim ulang foto yang sama ke layanan AI dan melahirkan pemindaian
   * baru — satu kendaraan bisa punya belasan catatan hasil yang identik hanya
   * karena user bolak-balik melihat hasilnya.
   */
  analyzedSignature: string | null;
  isAnalyzing: boolean;
  /** Apakah laporan AI (detail penuh) sudah dibuka via pembayaran. */
  reportUnlocked: boolean;
  /** User sudah membuka salah satu detail analisis kerusakan. */
  detailViewed: boolean;
  flowMode: 'insurance_claim' | 'self_pay' | '';
  viewMode: 'history' | '';

  setResult: (result: DamageResult, signature?: string) => void;
  setAnalyzing: (value: boolean) => void;
  unlockReport: () => void;
  markDetailViewed: () => void;
  setFlowMode: (mode: DamageState['flowMode']) => void;
  setViewMode: (mode: DamageState['viewMode']) => void;
  reset: () => void;
}

export const useDamageStore = create<DamageState>((set) => ({
  result: null,
  analyzedSignature: null,
  isAnalyzing: false,
  reportUnlocked: false,
  detailViewed: false,
  flowMode: '',
  viewMode: '',

  setResult: (result, signature) => {
    if (result.ticket) {
      storage.setString(STORAGE_KEYS.guestInferenceTicket, result.ticket);
    } else {
      storage.remove(STORAGE_KEYS.guestInferenceTicket);
    }
    set((state) => {
      const sameTicket =
        Boolean(result.ticket) &&
        Boolean(state.result?.ticket) &&
        result.ticket === state.result?.ticket;
      return {
        result,
        analyzedSignature: signature ?? null,
        isAnalyzing: false,
        detailViewed: false,
        reportUnlocked: Boolean(result.reportUnlocked || (sameTicket && state.reportUnlocked)),
      };
    });
  },
  setAnalyzing: (value) => set({ isAnalyzing: value }),
  unlockReport: () => set({ reportUnlocked: true }),
  markDetailViewed: () => set({ detailViewed: true }),
  setFlowMode: (flowMode) => set({ flowMode }),
  setViewMode: (viewMode) => set({ viewMode }),
  reset: () => {
    storage.remove(STORAGE_KEYS.guestInferenceTicket);
    set({
      result: null,
      analyzedSignature: null,
      isAnalyzing: false,
      reportUnlocked: false,
      detailViewed: false,
      flowMode: '',
      viewMode: '',
    });
  },
}));
