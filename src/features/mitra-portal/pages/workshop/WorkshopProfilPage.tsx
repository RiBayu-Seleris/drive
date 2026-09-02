import {
  type ChangeEvent,
  type FormEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { useMutation } from '@tanstack/react-query';
import { Camera, MapPin, Save, Star, X } from 'lucide-react';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/Button';
import { Select } from '@/components/ui/Select';
import { LoadingState } from '@/components/ui/Spinner';
import { toast } from '@/components/feedback/toast';
import { LocationPicker, type PickedLocation } from '@/components/map/LocationPicker';
import type { MapPoint } from '@/components/map/leafletConfig';
import { extractErrorMessage } from '@/lib/api/client';
import { uploadFilePublic } from '@/lib/upload/publicUpload';
import { MitraShell } from '../../components/MitraShell';
import {
  getWorkshopProfile,
  updateWorkshopProfile,
  WORKSHOP_OPEN_STATUS_OPTIONS,
  WORKSHOP_WORKLOAD_OPTIONS,
  type WorkshopProfile,
} from '../../workshopProfileApi';

/** Kartu pembungkus satu field — gaya sama dengan form armada towing. */
function CardField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="drive-card rounded-2xl p-4">
      <label className="mb-2 block text-[11px] font-semibold tracking-wide text-neutral-500">
        {label}
      </label>
      {children}
      {hint && <p className="mt-2 text-[11px] text-neutral-500">{hint}</p>}
    </div>
  );
}

const CONTROL_CLASS =
  'block h-11 w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-deep-blue-400 focus:bg-neutral-200 focus:ring-2 focus:ring-deep-blue-100 focus:outline-none';

const TEXTAREA_CLASS =
  'block w-full rounded-lg border border-neutral-300 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-900 placeholder:text-neutral-400 focus:border-deep-blue-400 focus:bg-neutral-200 focus:ring-2 focus:ring-deep-blue-100 focus:outline-none';

/** Ambil nilai field form sebagai string (FormData bisa berisi File). */
function field(fd: FormData, key: string): string {
  const value = fd.get(key);
  return typeof value === 'string' ? value : '';
}

/** Koordinat 0,0 berarti belum pernah diset — jangan dipakai sebagai titik peta. */
function pointOf(profile: WorkshopProfile): MapPoint | undefined {
  if (profile.latitude === 0 && profile.longitude === 0) return undefined;
  return { lat: profile.latitude, lng: profile.longitude };
}

/**
 * Form data bengkel untuk mitra bengkel yang sedang login.
 *
 * Titik peta di sini yang menentukan bengkel muncul di rekomendasi siapa —
 * jaraknya dihitung dari koordinat ini ke posisi pengguna.
 */
export function WorkshopProfilPage() {
  const [profile, setProfile] = useState<WorkshopProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [address, setAddress] = useState('');
  const [point, setPoint] = useState<MapPoint | null>(null);

  const [imageUrl, setImageUrl] = useState('');
  const [imagePreview, setImagePreview] = useState('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const objectUrlRef = useRef('');

  useEffect(() => {
    let active = true;
    getWorkshopProfile()
      .then((data) => {
        if (!active) return;
        setProfile(data);
        if (data) {
          setAddress(data.address);
          setPoint(pointOf(data) ?? null);
          setImageUrl(data.imageUrl);
          setImagePreview(data.imageUrl);
        }
      })
      .catch((err) => toast.error(extractErrorMessage(err, 'Gagal memuat data bengkel.')))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(
    () => () => {
      if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    },
    [],
  );

  // Geser peta → koordinat ikut pindah, alamat diisi hasil reverse-geocode.
  // Alamat tetap bisa ditimpa manual karena hasil OSM sering terlalu panjang.
  const handlePick = useCallback((location: PickedLocation) => {
    setPoint({ lat: location.lat, lng: location.lng });
    if (location.address) setAddress(location.address);
  }, []);

  const mutation = useMutation({
    mutationFn: (input: Parameters<typeof updateWorkshopProfile>[1]) => {
      if (!profile) throw new Error('Data bengkel belum termuat.');
      return updateWorkshopProfile(profile, input);
    },
    onSuccess: (_result, input) => {
      toast.success('Data bengkel tersimpan.');
      // Simpan hasilnya ke state supaya pengiriman berikutnya tetap membawa
      // nilai terbaru (endpoint menimpa seluruh kolom).
      setProfile((prev) => (prev ? { ...prev, ...input } : prev));
    },
    onError: (err) => setError(extractErrorMessage(err, 'Gagal menyimpan data bengkel.')),
  });

  const handlePhotoChange = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const nextPreview = URL.createObjectURL(file);
    if (objectUrlRef.current) URL.revokeObjectURL(objectUrlRef.current);
    objectUrlRef.current = nextPreview;
    setImagePreview(nextPreview);
    setUploading(true);
    try {
      setImageUrl(await uploadFilePublic(file, `workshop_${Date.now()}.jpg`));
    } catch (err) {
      toast.error(extractErrorMessage(err, 'Gagal mengunggah foto bengkel.'));
      setImagePreview(profile?.imageUrl ?? '');
      setImageUrl(profile?.imageUrl ?? '');
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = () => {
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = '';
    }
    setImagePreview('');
    setImageUrl('');
  };

  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError('');
    if (!profile) return;
    const fd = new FormData(e.currentTarget);
    const name = field(fd, 'name').trim();
    if (!name) {
      setError('Nama bengkel wajib diisi.');
      return;
    }
    if (!address.trim()) {
      setError('Alamat bengkel wajib diisi.');
      return;
    }
    if (!point) {
      setError('Tandai lokasi bengkel di peta dulu.');
      return;
    }
    if (uploading) {
      setError('Tunggu unggah foto bengkel selesai dulu.');
      return;
    }
    mutation.mutate({
      name,
      address: address.trim(),
      phone: field(fd, 'phone').trim(),
      website: field(fd, 'website').trim(),
      imageUrl,
      openStatus: field(fd, 'open_status') || 'OPEN',
      openHours: field(fd, 'open_hours').trim(),
      latitude: point.lat,
      longitude: point.lng,
      acceptingOrders: field(fd, 'accepting_orders') === 'true',
      workloadStatus: field(fd, 'workload_status') || 'NORMAL',
    });
  };

  if (loading) {
    return (
      <MitraShell>
        <AppHeader title="Data Bengkel" />
        <LoadingState label="Memuat data bengkel…" />
      </MitraShell>
    );
  }

  if (!profile) {
    return (
      <MitraShell>
        <AppHeader title="Data Bengkel" />
        <p className="text-12 px-5 py-20 text-center text-neutral-500">
          Akun Anda belum tertaut ke bengkel manapun. Hubungi admin DRIVE untuk menautkannya.
        </p>
      </MitraShell>
    );
  }

  return (
    <MitraShell>
      <AppHeader title="Data Bengkel" />

      <form onSubmit={handleSubmit} className="px-5 py-4">
        <h1 className="text-18 font-bold text-neutral-900">Data Bengkel</h1>
        <p className="text-12 mt-1 text-neutral-500">
          Yang Anda isi di sini yang dilihat pemilik kendaraan saat memilih bengkel.
        </p>

        <div className="mt-4 space-y-3">
          <CardField label="FOTO BENGKEL">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoChange}
            />
            {imagePreview ? (
              <div className="space-y-2">
                <div className="relative">
                  <img
                    src={imagePreview}
                    alt="Foto bengkel"
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
                <span className="bg-deep-blue-500 text-on-brand grid size-11 place-items-center rounded-full">
                  <Camera className="size-5" />
                </span>
                <span className="text-12 font-medium text-neutral-700">Klik untuk pilih foto</span>
                <span className="text-[11px] text-neutral-400">
                  Maksimum ukuran file 5MB. Format JPG, PNG.
                </span>
              </button>
            )}
          </CardField>

          <CardField label="NAMA BENGKEL">
            <input
              name="name"
              className={CONTROL_CLASS}
              placeholder="Contoh: Bengkel Jaya Motor"
              defaultValue={profile.name}
              required
            />
          </CardField>

          <CardField label="NOMOR TELEPON">
            <input
              name="phone"
              type="tel"
              inputMode="tel"
              className={CONTROL_CLASS}
              placeholder="08xxxxxxxxxx"
              defaultValue={profile.phone}
            />
          </CardField>

          <CardField
            label="LOKASI DI PETA"
            hint="Geser peta sampai pin tepat di bengkel Anda. Titik inilah yang dipakai menghitung jarak ke pemilik kendaraan."
          >
            <LocationPicker value={pointOf(profile)} onPick={handlePick} />
            {point && (
              <p className="hud-readout text-11 mt-2 flex items-center gap-1.5 text-neutral-600">
                <MapPin className="size-3.5 shrink-0" />
                {point.lat.toFixed(6)}, {point.lng.toFixed(6)}
              </p>
            )}
          </CardField>

          <CardField label="ALAMAT LENGKAP">
            <textarea
              name="address"
              rows={3}
              className={TEXTAREA_CLASS}
              placeholder="Terisi otomatis dari peta, boleh Anda rapikan"
              value={address}
              onChange={(e) => setAddress(e.target.value)}
            />
          </CardField>

          <CardField label="JAM OPERASIONAL">
            <input
              name="open_hours"
              className={CONTROL_CLASS}
              placeholder="Contoh: Senin–Sabtu, 08.00–17.00"
              defaultValue={profile.openHours}
            />
          </CardField>

          <CardField label="STATUS BUKA">
            <Select
              name="open_status"
              className={CONTROL_CLASS}
              defaultValue={profile.openStatus}
              options={[...WORKSHOP_OPEN_STATUS_OPTIONS]}
            />
          </CardField>

          <CardField
            label="MENERIMA ORDER"
            hint="Matikan bila bengkel sedang tidak bisa menerima kendaraan baru."
          >
            <Select
              name="accepting_orders"
              className={CONTROL_CLASS}
              defaultValue={profile.acceptingOrders ? 'true' : 'false'}
              options={[
                { value: 'true', label: 'Ya — masih menerima kendaraan' },
                { value: 'false', label: 'Tidak — sedang berhenti menerima' },
              ]}
            />
          </CardField>

          <CardField label="BEBAN KERJA">
            <Select
              name="workload_status"
              className={CONTROL_CLASS}
              defaultValue={profile.workloadStatus}
              options={[...WORKSHOP_WORKLOAD_OPTIONS]}
            />
          </CardField>

          <CardField label="WEBSITE (OPSIONAL)">
            <input
              name="website"
              type="url"
              inputMode="url"
              className={CONTROL_CLASS}
              placeholder="https://"
              defaultValue={profile.website}
            />
          </CardField>

          <CardField
            label="PENILAIAN PELANGGAN"
            hint="Bintang dihitung dari ulasan pelanggan, jadi tidak bisa diubah dari sini."
          >
            <p className="flex items-center gap-2 text-sm font-semibold text-neutral-900">
              <Star className="text-warning size-4" fill="currentColor" />
              {profile.rating > 0 ? profile.rating.toFixed(1) : 'Belum ada ulasan'}
            </p>
          </CardField>
        </div>

        {error && <p className="text-12 text-danger mt-3">{error}</p>}

        <Button
          type="submit"
          className="mt-5"
          isLoading={mutation.isPending}
          leftIcon={<Save className="size-5" />}
        >
          Simpan Perubahan
        </Button>
      </form>
    </MitraShell>
  );
}
