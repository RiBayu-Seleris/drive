import { useEffect, useState } from 'react';
import { useMitraStore } from '@/features/auth/store/mitraStore';
import { getPendingPartnershipCount } from './partnershipApi';
import { getPendingWorkshopPartnershipCount } from './workshopPartnershipApi';

/**
 * Jumlah undangan kemitraan asuransi yang menunggu jawaban mitra towing.
 *
 * Dipakai untuk penanda di nav & menu Akun supaya undangan tidak menggantung
 * berhari-hari hanya karena mitra tidak kebetulan membuka halaman Kemitraan.
 * Berlaku untuk mitra towing maupun bengkel — endpoint hitungannya berbeda,
 * dipilih dari partnerType. Kegagalan diabaikan karena ini informasi tambahan.
 */
export function usePendingPartnershipCount(): number {
  const partnerType = useMitraStore((s) => s.partnerType);
  const isLoggedIn = useMitraStore((s) => s.isLoggedIn);
  const [count, setCount] = useState(0);

  useEffect(() => {
    const isPartner = partnerType === 'towing' || partnerType === 'workshop';
    if (!isLoggedIn || !isPartner) {
      setCount(0);
      return;
    }
    const fetchCount =
      partnerType === 'workshop' ? getPendingWorkshopPartnershipCount : getPendingPartnershipCount;
    let active = true;
    const load = () => {
      fetchCount()
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
