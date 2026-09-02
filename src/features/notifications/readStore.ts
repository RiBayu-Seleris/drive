import { create } from 'zustand';
import { STORAGE_KEYS } from '@/config/constants';
import { storage } from '@/lib/storage/storage';

/*
 * Tanda "sudah dibaca" tinggal di perangkat, bukan di server.
 *
 * Notifikasi di sini bukan baris di database — ia disusun dari keadaan yang
 * memang sudah ada (polis menunggu diambil alih, derek yang berjalan, klaim
 * yang berubah status). Jadi tidak ada apa pun di server yang bisa ditandai
 * terbaca. Yang perlu diingat cuma satu: mana yang sudah dilihat pengguna di
 * perangkat ini.
 *
 * Konsekuensinya jujur saja: ganti perangkat, tandanya kembali kosong.
 */
const MAX_REMEMBERED = 200;

function keyFor(scope: string): string {
  return `${STORAGE_KEYS.notificationsRead}:${scope}`;
}

interface ReadState {
  /** Akun pemilik tanda-baca; dipisah supaya tidak bocor antar akun. */
  scope: string;
  ids: string[];
  setScope: (scope: string) => void;
  markRead: (ids: string[]) => void;
}

export const useNotificationReadStore = create<ReadState>((set, get) => ({
  scope: '',
  ids: [],

  setScope: (scope) => {
    if (get().scope === scope) return;
    set({ scope, ids: storage.getJSON<string[]>(keyFor(scope)) ?? [] });
  },

  markRead: (incoming) => {
    const { scope, ids } = get();
    if (!scope || incoming.every((id) => ids.includes(id))) return;
    const merged = [...new Set([...ids, ...incoming])].slice(-MAX_REMEMBERED);
    set({ ids: merged });
    storage.setJSON(keyFor(scope), merged);
  },
}));
