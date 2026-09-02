import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { Moon, Save, Sun } from 'lucide-react';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/Button';
import { CurrencyInput } from '@/components/ui/CurrencyInput';
import { Input } from '@/components/ui/Input';
import { LoadingState } from '@/components/ui/Spinner';
import { toast } from '@/components/feedback/toast';
import { extractErrorMessage } from '@/lib/api/client';
import { formatCurrency } from '@/lib/utils/format';
import { MitraShell } from '../../components/MitraShell';
import {
  getTowingService,
  previewTowingPrice,
  updateTowingTariff,
  type TowingService,
} from '../../towingTariffApi';

/** Jarak contoh untuk pratinjau harga — pendek, sedang, jauh. */
const PREVIEW_DISTANCES = [5, 12, 25];

function digitsToNumber(value: string): number {
  const digits = value.replace(/\D/g, '');
  return digits ? Number(digits) : 0;
}

/**
 * Form tarif derek milik mitra.
 *
 * Harga dihitung backend dengan rumus: tarif dasar + (km di atas jarak dasar,
 * dibulatkan ke atas) x tarif per km, ditambah tambahan malam bila order masuk
 * pukul 22.00–06.00. Halaman ini memperlihatkan hasilnya sambil mitra mengetik
 * supaya tidak ada yang menyimpan tarif tanpa tahu efeknya di layar pelanggan.
 */
export function TarifPage() {
  const [service, setService] = useState<TowingService | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [baseFare, setBaseFare] = useState('');
  const [baseKm, setBaseKm] = useState('');
  const [perKmFare, setPerKmFare] = useState('');
  const [nightSurcharge, setNightSurcharge] = useState('');

  useEffect(() => {
    let active = true;
    getTowingService()
      .then((data) => {
        if (!active) return;
        setService(data);
        if (data) {
          setBaseFare(String(data.baseFare || ''));
          setBaseKm(String(data.baseKm || ''));
          setPerKmFare(String(data.perKmFare || ''));
          setNightSurcharge(String(data.nightSurcharge || ''));
        }
      })
      .catch((err) => toast.error(extractErrorMessage(err, 'Gagal memuat data derek.')))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const tariff = useMemo(
    () => ({
      baseFare: digitsToNumber(baseFare),
      baseKm: Number(baseKm.replace(',', '.')) || 0,
      perKmFare: digitsToNumber(perKmFare),
      nightSurcharge: digitsToNumber(nightSurcharge),
    }),
    [baseFare, baseKm, perKmFare, nightSurcharge],
  );

  const mutation = useMutation({
    mutationFn: () => {
      if (!service) throw new Error('Data derek belum termuat.');
      return updateTowingTariff(service, tariff);
    },
    onSuccess: () => {
      toast.success('Tarif derek tersimpan.');
      setService((prev) => (prev ? { ...prev, ...tariff } : prev));
    },
    onError: (err) => setError(extractErrorMessage(err, 'Gagal menyimpan tarif derek.')),
  });

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    if (!service) return;
    if (tariff.perKmFare <= 0) {
      setError('Tarif per kilometer wajib diisi — itu dasar perhitungan harganya.');
      return;
    }
    mutation.mutate();
  };

  if (loading) {
    return (
      <MitraShell>
        <AppHeader title="Tarif Derek" />
        <LoadingState label="Memuat tarif…" />
      </MitraShell>
    );
  }

  if (!service) {
    return (
      <MitraShell>
        <AppHeader title="Tarif Derek" />
        <p className="text-12 px-5 py-20 text-center text-neutral-500">
          Akun Anda belum tertaut ke penyedia derek manapun. Hubungi admin DRIVE.
        </p>
      </MitraShell>
    );
  }

  return (
    <MitraShell>
      <AppHeader title="Tarif Derek" />

      <form onSubmit={handleSubmit} className="px-5 py-4">
        <h1 className="text-18 font-bold text-neutral-900">Tarif Derek</h1>
        <p className="text-12 mt-1 text-neutral-500">
          Anda yang menentukan harganya. Angka ini yang dipakai menghitung ongkos setiap order yang
          masuk ke {service.name}.
        </p>

        <div className="mt-4 space-y-3">
          <div className="drive-card rounded-2xl p-4">
            <CurrencyInput
              label="Tarif Per Kilometer"
              value={perKmFare}
              onChange={setPerKmFare}
              placeholder="0"
              hint="Dikalikan jarak jemput sampai tujuan, dibulatkan ke atas."
            />
          </div>

          <div className="drive-card rounded-2xl p-4">
            <CurrencyInput
              label="Tarif Dasar"
              value={baseFare}
              onChange={setBaseFare}
              placeholder="0"
              hint="Ongkos minimum sekali jalan. Isi 0 bila murni hitung per kilometer."
            />
          </div>

          <div className="drive-card rounded-2xl p-4">
            <Input
              label="Jarak Sudah Termasuk Tarif Dasar"
              type="text"
              inputMode="decimal"
              value={baseKm}
              onChange={(e) => setBaseKm(e.target.value.replace(/[^\d.,]/g, ''))}
              placeholder="0"
              hint="Dalam kilometer. Di atas jarak ini baru dihitung per kilometer."
            />
          </div>

          <div className="drive-card rounded-2xl p-4">
            <CurrencyInput
              label="Tambahan Malam"
              value={nightSurcharge}
              onChange={setNightSurcharge}
              placeholder="0"
              hint="Ditambahkan sekali untuk order yang masuk pukul 22.00–06.00."
            />
          </div>
        </div>

        {/* Pratinjau: memperlihatkan tarif ini jadi berapa di layar pelanggan. */}
        <section className="drive-card mt-4 rounded-2xl p-4">
          <p className="hud-readout text-[10.5px] tracking-[0.14em] text-neutral-600 uppercase">
            Contoh Perhitungan
          </p>
          <ul className="mt-3 space-y-2">
            {PREVIEW_DISTANCES.map((km) => (
              <li key={km} className="flex items-center justify-between gap-3">
                <span className="text-12 flex items-center gap-1.5 text-neutral-600">
                  <Sun className="size-3.5 shrink-0" />
                  Derek {km} km, siang
                </span>
                <span className="text-14 text-deep-blue-500 font-semibold">
                  {formatCurrency(previewTowingPrice(tariff, km, false))}
                </span>
              </li>
            ))}
            <li className="flex items-center justify-between gap-3 border-t border-neutral-300 pt-2">
              <span className="text-12 flex items-center gap-1.5 text-neutral-600">
                <Moon className="size-3.5 shrink-0" />
                Derek 12 km, malam
              </span>
              <span className="text-14 text-deep-blue-500 font-semibold">
                {formatCurrency(previewTowingPrice(tariff, 12, true))}
              </span>
            </li>
          </ul>
        </section>

        {error && <p className="text-12 text-danger mt-3">{error}</p>}

        <Button
          type="submit"
          className="mt-5"
          isLoading={mutation.isPending}
          leftIcon={<Save className="size-5" />}
        >
          Simpan Tarif
        </Button>
      </form>
    </MitraShell>
  );
}
