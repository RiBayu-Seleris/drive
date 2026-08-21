import { create } from 'zustand';
import { STORAGE_KEYS } from '@/config/constants';
import { storage } from '@/lib/storage/storage';
import { setMitraSessionExpiredHandler } from '@/lib/api/client';
import { toast } from '@/components/feedback/toast';
import { probeAdminLogin } from '../api/authApi';

/** Tipe mitra yang punya portal di webapp-v2 (asuransi tetap di backoffice). */
export type MitraPartnerType = 'towing' | 'workshop';

/** Petakan role admin (dari /v1/admin/auth/login) ke tipe mitra portal. */
const ROLE_TO_TYPE: Record<string, MitraPartnerType> = {
  towing_admin: 'towing',
  partner_towing_admin: 'towing',
  workshop_admin: 'workshop',
  partner_workshop_admin: 'workshop',
};

/**
 * Mitra yang pendaftarannya DITOLAK tidak diloloskan ke portal. Sejak ditolak,
 * ikatan akun ke entitas (bengkel/armada) dilepas backend, sehingga setiap
 * halaman portal hanya menghasilkan 403 — dashboard yang isinya pesan gagal
 * semua lebih membingungkan daripada ditahan di layar masuk. Jalur yang benar
 * adalah memperbaiki data lalu mengajukan ulang.
 */
export const PARTNER_REJECTED_MESSAGE =
  'Pendaftaran mitra Anda ditolak. Perbaiki data mitra lalu ajukan ulang untuk ditinjau kembali.';

export function isPartnerRejected(accountStatus: string): boolean {
  return accountStatus.trim().toUpperCase() === 'REJECTED';
}

export function mitraTypeFromRole(role: string): MitraPartnerType | null {
  return ROLE_TO_TYPE[role] ?? null;
}

interface MitraInfo {
  name: string;
  role: string;
  type: MitraPartnerType;
  /** Email login mitra — dipakai di header Home (sesuai desain). */
  email?: string;
}

interface MitraState {
  token: string | null;
  name: string;
  email: string;
  role: string;
  partnerType: MitraPartnerType | null;
  isLoading: boolean;
  error: string | null;
  isLoggedIn: boolean;

  hydrate: () => void;
  loginAsMitra: (email: string, password: string) => Promise<boolean>;
  /** Set sesi dari login mitra. false bila role bukan mitra portal. */
  setSession: (args: { token: string; name: string; role: string; email?: string }) => boolean;
  logout: () => void;
  clearError: () => void;
}

function persist(token: string, info: MitraInfo): void {
  storage.setString(STORAGE_KEYS.mitraToken, token);
  storage.setJSON<MitraInfo>(STORAGE_KEYS.mitraInfo, info);
}

/**
 * Sesi admin mitra (bengkel/towing) untuk portal webapp-v2. Terpisah dari sesi
 * user & sopir. Asuransi tidak punya portal di sini (tetap di backoffice).
 */
export const useMitraStore = create<MitraState>((set) => ({
  token: null,
  name: '',
  email: '',
  role: '',
  partnerType: null,
  isLoading: false,
  error: null,
  isLoggedIn: false,

  hydrate: () => {
    const token = storage.getString(STORAGE_KEYS.mitraToken);
    const info = storage.getJSON<MitraInfo>(STORAGE_KEYS.mitraInfo);
    if (token && info) {
      set({
        token,
        name: info.name,
        email: info.email ?? '',
        role: info.role,
        partnerType: info.type,
        isLoggedIn: true,
      });
    }
  },

  loginAsMitra: async (email, password) => {
    set({ isLoading: true, error: null });
    const { outcome, errorMessage } = await probeAdminLogin(email, password);
    if (!outcome) {
      set({ isLoading: false, error: errorMessage });
      return false;
    }
    const type = mitraTypeFromRole(outcome.role);
    if (!type) {
      set({ isLoading: false, error: 'Akun ini bukan mitra bengkel atau towing.' });
      return false;
    }
    if (isPartnerRejected(outcome.accountStatus)) {
      set({ isLoading: false, error: PARTNER_REJECTED_MESSAGE });
      return false;
    }
    const info: MitraInfo = { name: outcome.name, role: outcome.role, type, email };
    persist(outcome.token, info);
    set({
      token: outcome.token,
      name: info.name,
      email,
      role: info.role,
      partnerType: type,
      isLoggedIn: true,
      isLoading: false,
    });
    return true;
  },

  setSession: ({ token, name, role, email }) => {
    const type = mitraTypeFromRole(role);
    if (!type) return false;
    const info: MitraInfo = { name, role, type, email };
    persist(token, info);
    set({
      token,
      name,
      email: email ?? '',
      role,
      partnerType: type,
      isLoggedIn: true,
      isLoading: false,
      error: null,
    });
    return true;
  },

  logout: () => {
    storage.remove(STORAGE_KEYS.mitraToken);
    storage.remove(STORAGE_KEYS.mitraInfo);
    set({
      token: null,
      name: '',
      email: '',
      role: '',
      partnerType: null,
      isLoggedIn: false,
      error: null,
    });
  },

  clearError: () => set({ error: null }),
}));

// Token mitra invalid/expired (401 dan tidak bisa dipulihkan) → hapus sesi.
// MitraGuard otomatis mengarahkan ke halaman login mitra saat isLoggedIn false.
setMitraSessionExpiredHandler((message) => {
  const { isLoggedIn, logout } = useMitraStore.getState();
  if (!isLoggedIn) return;
  logout();
  toast.error(message);
});
