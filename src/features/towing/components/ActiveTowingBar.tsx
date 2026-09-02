import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Truck } from 'lucide-react';
import { buildPath } from '@/app/routes';
import { getTowingOrders } from '../api/towingApi';
import { isTowingActive, isTowingSearching, towingStatusLabel } from '../types';

/**
 * Penanda order derek yang sedang berjalan, seperti bilah pesanan aktif di
 * aplikasi pesan-antar.
 *
 * Sebelum ini, kode order hanya hidup di state navigasi: begitu pengguna
 * menekan back sampai beranda, satu-satunya jalan kembali ke pelacakan hilang.
 * Bilah ini menjadikan order yang berjalan sebagai sesuatu yang selalu bisa
 * ditemukan, bukan sesuatu yang harus diingat jalannya.
 */
export function ActiveTowingBar() {
  const navigate = useNavigate();

  const { data } = useQuery({
    queryKey: ['towing-orders'],
    queryFn: getTowingOrders,
    // Cukup jarang: bilah ini hanya perlu tahu ADA atau tidak. Perubahan
    // detik-detikan dipantau halaman pelacakan, bukan di sini.
    refetchInterval: 30_000,
  });

  const order = data?.find((item) => isTowingSearching(item.status) || isTowingActive(item.status));
  if (!order) return null;

  return (
    <button
      type="button"
      onClick={() => navigate(buildPath.towingStatus(order.orderCode))}
      className="bg-brand-500 text-on-brand fixed inset-x-0 bottom-20 z-40 mx-auto flex w-full max-w-md items-center gap-3 px-5 py-3 text-left shadow-lg"
    >
      <span className="bg-on-brand/10 grid size-9 shrink-0 place-items-center rounded-full">
        <Truck className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="text-13 block font-semibold">Derek sedang berjalan</span>
        <span className="text-11 block opacity-80">
          {towingStatusLabel(order.status)} · {order.orderCode}
        </span>
      </span>
      <ChevronRight className="size-5 shrink-0" />
    </button>
  );
}
