import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { Camera, Save, X } from 'lucide-react';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { LoadingState } from '@/components/ui/Spinner';
import { toast } from '@/components/feedback/toast';
import { extractErrorMessage } from '@/lib/api/client';
import { uploadFilePublic } from '@/lib/upload/publicUpload';
import { buildPath } from '@/app/routes';
import { MitraShell } from '../../components/MitraShell';
import {
  getMitraTowingFleets,
  updateMitraTowingFleet,
  TOWING_FLEET_STATUS_OPTIONS,
  TOWING_FLEET_TYPE_OPTIONS,
  type MitraTowingFleet,
} from '../../api';

/** Kartu pembungkus satu field (label kapital + kontrol), gaya desain Kelola Armada. */
function CardField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="drive-card rounded-2xl p-4">
      <label className="mb-2 block text-[11px] font-semibold tracking-wide text-neutral-500">
        {label}
      </label>
      {children}
    </div>
  );
}

const CONTROL_CLASS =
  'block h-11 w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-deep-blue-400 focus:bg-neutral-200 focus:ring-2 focus:ring-deep-blue-100 focus:outline-none';

/** Ambil nilai field form sebagai string (FormData bisa berisi File). */
function field(fd: FormData, key: string): string {
  const value = fd.get(key);
  return typeof value === 'string' ? value : '';
}

/** Form ubah armada. Hanya field yang benar-benar disimpan backend yang ditampilkan. */
export function ArmadaEditPage() {
  const navigate = useNavigate();
  const { id = '' } = useParams();
  const fleetID = Number(id);

  const [fleet, setFleet] = useState<MitraTowingFleet | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [photoPreview, setPhotoPreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Object URL hanya dibuat untuk foto baru; foto lama memakai URL server.
  const objectUrlRef = useRef('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    getMitraTowingFleets()
      .then((items) => {
        if (!active) return;
        const found = items.find((item) => item.id === fleetID) ?? null;
        setFleet(found);
        setPhotoUrl(found?.photoUrl ?? '');
        setPhotoPreview(found?.photoUrl ?? '');
      })
      .catch((err) => toast.error(extractErrorMessage(err, 'Gagal memuat data armada.')))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [fleetID]);

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    [],
  );

  const mutation = useMutation({
    mutationFn: (input: Parameters<typeof updateMitraTowingFleet>[1]) =>
      updateMitraTowingFleet(fleetID, input),
    onSuccess: () => {
      toast.success('Perubahan data armada tersimpan.');
      navigate(buildPath.mitraArmadaDetail(String(fleetID)), { replace: true });
    },
    onError: (err) => setError(extractErrorMessage(err, 'Gagal menyimpan perubahan armada.')),
  });

  const handlePhotoChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const nextPreview = URL.createObjectURL(file);
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = nextPreview;
    setPhotoPreview(nextPreview);
    setUploading(true);
    try {
      const url = await uploadFilePublic(file, `fleet_${Date.now()}.jpg`);
      setPhotoUrl(url);
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Gagal mengunggah foto kendaraan.'));
      // Kembalikan ke foto yang tersimpan sebelumnya agar tidak terlihat berubah.
      setPhotoPreview(fleet?.photoUrl ?? '');
      setPhotoUrl(fleet?.photoUrl ?? '');
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = '';
    }
    setPhotoPreview('');
    setPhotoUrl('');
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    if (!fleet) return;
    const fd = new FormData(e.currentTarget);
    const plateNumber = field(fd, 'plate_number').trim();
    if (!plateNumber) {
      setError('Nomor plat wajib diisi.');
      return;
    }
    if (uploading) {
      setError('Tunggu unggah foto armada selesai dulu.');
      return;
    }
    mutation.mutate({
      plateNumber,
      fleetType: field(fd, 'fleet_type') || 'FLATBED',
      capacityLabel: field(fd, 'capacity_label').trim(),
      photoUrl,
      status: field(fd, 'status') || fleet.status,
      isActive: field(fd, 'is_active') === 'true',
      // Endpoint menimpa seluruh kolom — kirim ulang posisi terakhir agar tidak hilang.
      lastLatitude: fleet.lastLatitude,
      lastLongitude: fleet.lastLongitude,
    });
  };

  if (loading) {
    return (
      <MitraShell>
        <AppHeader showLogo />
        <LoadingState label="Memuat data armada…" />
      </MitraShell>
    );
  }

  if (!fleet || !Number.isFinite(fleetID)) {
    return (
      <MitraShell>
        <AppHeader showLogo />
        <p className="text-12 px-5 py-20 text-center text-neutral-500">Armada tidak ditemukan.</p>
      </MitraShell>
    );
  }

  return (
    <MitraShell>
      <AppHeader showLogo />

      <form onSubmit={handleSubmit} className="px-5 py-4">
        <h1 className="text-18 font-bold text-neutral-900">Ubah Data Armada</h1>
        <p className="text-12 mt-1 text-neutral-500">
          Perbarui detail kendaraan {fleet.plateNumber} yang terdaftar di sistem manajemen fleet.
        </p>

        <div className="mt-4 space-y-3">
          <CardField label="NAMA ARMADA">
            <input
              name="capacity_label"
              className={CONTROL_CLASS}
              placeholder="Contoh: Truck Logistik Jakarta"
              defaultValue={fleet.capacityLabel}
            />
          </CardField>

          <CardField label="JENIS KENDARAAN">
            <Select
              name="fleet_type"
              className={CONTROL_CLASS}
              defaultValue={fleet.fleetType}
              options={[...TOWING_FLEET_TYPE_OPTIONS]}
            />
          </CardField>

          <CardField label="NOMOR PLAT">
            <input
              name="plate_number"
              className={CONTROL_CLASS}
              placeholder="B 1234 ABC"
              defaultValue={fleet.plateNumber}
              required
            />
          </CardField>

          <CardField label="STATUS UNIT">
            <Select
              name="status"
              className={CONTROL_CLASS}
              defaultValue={fleet.status}
              options={[...TOWING_FLEET_STATUS_OPTIONS]}
            />
          </CardField>

          <CardField label="KETERSEDIAAN">
            <Select
              name="is_active"
              className={CONTROL_CLASS}
              defaultValue={fleet.isActive ? 'true' : 'false'}
              options={[
                { value: 'true', label: 'Aktif — bisa menerima order' },
                { value: 'false', label: 'Nonaktif — disembunyikan dari penugasan' },
              ]}
            />
          </CardField>

          <CardField label="FOTO KENDARAAN (OPSIONAL)">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoChange}
            />
            {photoPreview ? (
              <div className="space-y-2">
                <div className="relative">
                  <img
                    src={photoPreview}
                    alt="Foto armada"
                    className="h-44 w-full rounded-xl object-cover"
                  />
                  <button
                    type="button"
                    onClick={removePhoto}
                    aria-label="Hapus foto"
                    className="absolute top-2 right-2 grid size-8 place-items-center rounded-full bg-black/55 text-white"
                  >
                    <X className="size-4" />
                  </button>
                  {uploading && (
                    <div className="text-12 absolute inset-0 grid place-items-center rounded-xl bg-black/40 font-medium text-white">
                      Mengunggah…
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="text-deep-blue-500 text-12 font-semibold"
                >
                  Ganti Foto
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="hover:border-deep-blue-400 flex w-full flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed border-neutral-300 bg-neutral-50 py-7 text-center transition"
              >
                <span className="bg-deep-blue-500 grid size-11 place-items-center rounded-full text-[#10200a]">
                  <Camera className="size-5" />
                </span>
                <span className="text-12 font-medium text-neutral-700">Klik untuk pilih foto</span>
                <span className="text-[11px] text-neutral-400">
                  Maksimum ukuran file 5MB. Format JPG, PNG.
                </span>
              </button>
            )}
          </CardField>
        </div>

        {error && <p className="text-12 text-danger mt-3">{error}</p>}

        <div className="mt-5 grid grid-cols-2 gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(buildPath.mitraArmadaDetail(String(fleetID)))}
          >
            Batal
          </Button>
          <Button
            type="submit"
            isLoading={mutation.isPending}
            leftIcon={<Save className="size-5" />}
          >
            Simpan
          </Button>
        </div>
      </form>
    </MitraShell>
  );
}
