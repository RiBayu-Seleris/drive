import { useEffect, useState } from 'react';
import { useMitraStore } from '@/features/auth/store/mitraStore';
import { getPendingPartnershipCount } from './partnershipApi';

/**
 * Jumlah undangan kemitraan asuransi yang menunggu jawaban mitra towing.
 *
 * Dipakai untuk penanda di nav & menu Akun supaya undangan tidak menggantung
 * berhari-hari hanya karena mitra tidak kebetulan membuka halaman Kemitraan.
 * Hanya berjalan untuk mitra towing yang sudah login; kegagalan diabaikan karena
 * ini informasi tambahan, bukan data yang menentukan alur.
 */
export function usePendingPartnershipCount(): number {
  const partnerType = useMitraStore((s) => s.partnerType);
  const isLoggedIn = useMitraStore((s) => s.isLoggedIn);
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!isLoggedIn || partnerType !== 'towing') {
      setCount(0);
      return;
    }
    let active = true;
    const load = () => {
      getPendingPartnershipCount()
        .then((value) => {
          if (active) setCount(value);
        })
        .catch(() => {
          /* penanda opsional — diamkan bila gagal */
        });
    };
    load();
    const intervalId = window.setInterval(load, 30000);
    return () => {
      active = false;
      window.clearInterval(intervalId);
    };
  }, [isLoggedIn, partnerType]);

  return count;
}
