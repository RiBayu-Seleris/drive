import { create } from 'zustand';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

export interface ToastItem {
  id: string;
  tone: ToastTone;
  message: string;
  title?: string;
  duration: number;
}

interface ToastState {
  toasts: ToastItem[];
  push: (toast: Omit<ToastItem, 'id'>) => string;
  dismiss: (id: string) => void;
}

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (toast) => {
    /*
     * Pesan yang sama tidak menumpuk. Tombol yang ditekan berulang saat izin
     * ditolak dulu melahirkan satu notifikasi per tekanan, sampai formulir di
     * belakangnya tertutup tembok notifikasi identik.
     */
    const existing = get().toasts.find(
      (item) => item.message === toast.message && item.tone === toast.tone,
    );
    if (existing) return existing.id;

    const id = crypto.randomUUID();
    set((state) => ({ toasts: [...state.toasts, { ...toast, id }] }));
    return id;
  },
  dismiss: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
}));

function show(tone: ToastTone, message: string, opts?: { title?: string; duration?: number }) {
  return useToastStore.getState().push({
    tone,
    message,
    title: opts?.title,
    duration: opts?.duration ?? 3500,
  });
}

/** API imperatif sederhana untuk notifikasi (pengganti SweetAlert2 toast). */
export const toast = {
  success: (message: string, opts?: { title?: string; duration?: number }) =>
    show('success', message, opts),
  error: (message: string, opts?: { title?: string; duration?: number }) =>
    show('error', message, opts),
  info: (message: string, opts?: { title?: string; duration?: number }) =>
    show('info', message, opts),
  warning: (message: string, opts?: { title?: string; duration?: number }) =>
    show('warning', message, opts),
  dismiss: (id: string) => useToastStore.getState().dismiss(id),
};
