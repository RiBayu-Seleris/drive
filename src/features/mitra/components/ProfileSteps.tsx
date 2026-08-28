import { useCallback, useId, type ChangeEvent } from 'react';
import type { FieldErrors, FieldPath, UseFormRegister, UseFormSetValue } from 'react-hook-form';
import {
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckCircle2,
  FileText,
  Hash,
  IdCard,
  Mail,
  Phone,
  Upload,
  User,
} from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/TextArea';
import { LocationPicker, type PickedLocation } from '@/components/map/LocationPicker';
import type { MapPoint } from '@/components/map/leafletConfig';
import type { PartnerProfileValues } from '../schemas';

type ProfileRegister = UseFormRegister<PartnerProfileValues>;
type ProfileErrors = FieldErrors<PartnerProfileValues>;
type ProfileSetValue = UseFormSetValue<PartnerProfileValues>;

export interface ProfileFieldProps {
  register: ProfileRegister;
  errors: ProfileErrors;
  setValue: ProfileSetValue;
}

// Props Input yang membuang karakter tak sesuai saat mengetik (react-hook-form),
// sekaligus memunculkan keyboard yang tepat & membatasi panjang.
function sanitizedField(
  register: ProfileRegister,
  name: FieldPath<PartnerProfileValues>,
  options: { strip: RegExp; maxLength: number; inputMode: 'numeric' | 'tel' },
) {
  const field = register(name);
  return {
    ...field,
    inputMode: options.inputMode,
    maxLength: options.maxLength,
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      event.target.value = event.target.value.replace(options.strip, '');
      return field.onChange(event);
    },
  };
}

/** Field angka murni (NIB, NPWP, KTP/NIK, tahun). */
const digitsField = (register: ProfileRegister, name: FieldPath<PartnerProfileValues>, maxLength: number) =>
  sanitizedField(register, name, { strip: /\D/g, maxLength, inputMode: 'numeric' });

/** Field nomor telepon: hanya angka & tanda '+'. */
const phoneField = (register: ProfileRegister, name: FieldPath<PartnerProfileValues>, maxLength: number) =>
  sanitizedField(register, name, { strip: /[^0-9+]/g, maxLength, inputMode: 'tel' });

export function StepTitle({ title, subtitle }: { title: string; subtitle: string }) {
  return (
    <div className="pt-1 pb-2 text-center">
      <h1 className="text-deep-blue-500 text-[24px] leading-[1.18] font-bold">{title}</h1>
      <p className="mt-2 text-sm text-neutral-700">{subtitle}</p>
    </div>
  );
}

export function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div className="flex items-center justify-center gap-2">
      {Array.from({ length: total }, (_, index) => (
        <span
          key={index}
          className={`h-2 rounded-full transition-all ${
            index === current ? 'bg-deep-blue-500 w-6' : 'w-2 bg-neutral-400'
          }`}
        />
      ))}
    </div>
  );
}

export function FileUploadField({
  label,
  file,
  onChange,
}: {
  label: string;
  file: File | null;
  onChange: (file: File | null) => void;
}) {
  const inputId = useId();

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.currentTarget.files?.[0] ?? null);
  };

  return (
    <div>
      <label htmlFor={inputId} className="mb-2 block text-base font-medium text-neutral-800">
        {label}
      </label>
      <label
        htmlFor={inputId}
        className="hover:border-deep-blue-500 flex min-h-12 cursor-pointer items-center gap-3 rounded-lg border border-neutral-300 bg-neutral-100 px-4 py-3 text-neutral-700 shadow-sm transition"
      >
        {file ? (
          <CheckCircle2 className="text-success size-5 shrink-0" />
        ) : (
          <Upload className="size-5 shrink-0 text-neutral-600" />
        )}
        <span className="min-w-0 flex-1 truncate text-sm">{file ? file.name : 'Pilih gambar'}</span>
        {file && <span className="text-deep-blue-500 text-xs font-semibold">Ganti</span>}
      </label>
      <input id={inputId} type="file" accept="image/*" className="sr-only" onChange={handleChange} />
    </div>
  );
}

export function StepCompany({
  register,
  errors,
  setValue,
  logoFile,
  onLogoChange,
  initialPoint,
}: ProfileFieldProps & {
  logoFile: File | null;
  onLogoChange: (file: File | null) => void;
  /** Titik awal peta (mis. koordinat tersimpan saat resubmit). */
  initialPoint?: MapPoint;
}) {
  // Titik di peta mengisi alamat + kota + provinsi + koordinat; field teks tetap
  // bisa disunting user untuk penyesuaian.
  const handlePick = useCallback(
    (location: PickedLocation) => {
      if (location.address) {
        setValue('officeAddress', location.address, { shouldValidate: true, shouldDirty: true });
      }
      if (location.city) setValue('city', location.city, { shouldDirty: true });
      if (location.province) setValue('province', location.province, { shouldDirty: true });
      setValue('latitude', location.lat, { shouldDirty: true });
      setValue('longitude', location.lng, { shouldDirty: true });
    },
    [setValue],
  );

  return (
    <div className="flex flex-col gap-4 pb-5">
      <StepTitle title="Lengkapi Data Mitra" subtitle="Lengkapi identitas perusahaan Anda" />
      <Input
        label="Nama Perusahaan (PT/CV)"
        requiredMark
        placeholder="Masukan Nama Perusahaan (PT/CV)"
        leftIcon={<Building2 className="size-5" />}
        error={errors.companyName?.message}
        {...register('companyName')}
      />
      <Input
        label="Nomor Induk Berusaha (NIB)"
        requiredMark
        placeholder="13 digit angka"
        leftIcon={<Hash className="size-5" />}
        error={errors.nib?.message}
        {...digitsField(register, 'nib', 13)}
      />
      <Input
        label="Nomor NPWP Perusahaan"
        placeholder="15–16 digit angka"
        leftIcon={<FileText className="size-5" />}
        error={errors.npwp?.message}
        {...digitsField(register, 'npwp', 16)}
      />

      <div>
        <p className="mb-2 block text-base font-medium text-neutral-800">Lokasi Usaha di Peta</p>
        <LocationPicker value={initialPoint} onPick={handlePick} />
      </div>

      <TextArea
        label="Alamat Usaha"
        requiredMark
        placeholder="Pilih di peta atau ketik manual"
        rows={2}
        error={errors.officeAddress?.message}
        {...register('officeAddress')}
      />
      <Input
        label="Kota / Kabupaten"
        placeholder="Masukan Kota / Kabupaten"
        error={errors.city?.message}
        {...register('city')}
      />
      <Input
        label="Provinsi"
        placeholder="Masukan Provinsi"
        error={errors.province?.message}
        {...register('province')}
      />
      {/* Wajib menurut skema, tapi TIDAK diberi bintang: nilainya terisi
          otomatis dari langkah akun dan field ini read-only, jadi bintang hanya
          akan menyuruh pengguna mengisi sesuatu yang tak bisa ia isi di sini. */}
      <Input
        label="Email Perusahaan"
        type="email"
        placeholder="Masukan Email Perusahaan"
        readOnly
        className="bg-neutral-300 text-neutral-700"
        leftIcon={<Mail className="size-5" />}
        error={errors.companyEmail?.message}
        hint="Untuk mengubah email, kembali ke langkah akun."
        {...register('companyEmail')}
      />
      <Input
        label="Nomor Telepon Kantor"
        type="tel"
        placeholder="Contoh: 0218xxxxxxx"
        leftIcon={<Phone className="size-5" />}
        error={errors.companyPhone?.message}
        {...phoneField(register, 'companyPhone', 20)}
      />
      <FileUploadField label="Logo Perusahaan" file={logoFile} onChange={onLogoChange} />
    </div>
  );
}

export function StepPic({
  register,
  errors,
  ktpFile,
  onKtpChange,
}: Omit<ProfileFieldProps, 'setValue'> & {
  ktpFile: File | null;
  onKtpChange: (file: File | null) => void;
}) {
  return (
    <div className="flex flex-col gap-4 pb-5">
      <StepTitle title="Data Penanggung Jawab" subtitle="Masukkan data PIC yang bertanggung jawab" />
      <Input
        label="Nama Lengkap PIC"
        requiredMark
        placeholder="Masukan nama lengkap"
        leftIcon={<User className="size-5" />}
        error={errors.picName?.message}
        {...register('picName')}
      />
      <Input
        label="Jabatan di Perusahaan"
        placeholder="Masukan jabatan"
        leftIcon={<BriefcaseBusiness className="size-5" />}
        error={errors.picPosition?.message}
        {...register('picPosition')}
      />
      <Input
        label="Nomor KTP"
        requiredMark
        placeholder="16 digit NIK"
        leftIcon={<IdCard className="size-5" />}
        error={errors.picKtpNumber?.message}
        {...digitsField(register, 'picKtpNumber', 16)}
      />
      <FileUploadField label="Foto KTP" file={ktpFile} onChange={onKtpChange} />
      <Input
        label="Nomor HP (WhatsApp aktif)"
        requiredMark
        type="tel"
        placeholder="Contoh: 08xxxxxxxxxx"
        leftIcon={<Phone className="size-5" />}
        error={errors.picPhone?.message}
        {...phoneField(register, 'picPhone', 20)}
      />
      <Input
        label="Email Pribadi PIC"
        type="email"
        placeholder="Masukan email pribadi"
        leftIcon={<Mail className="size-5" />}
        error={errors.picEmail?.message}
        {...register('picEmail')}
      />
    </div>
  );
}

export function StepLegal({
  register,
  errors,
  licenseLabel,
}: Omit<ProfileFieldProps, 'setValue'> & { licenseLabel: string }) {
  return (
    <div className="flex flex-col gap-4 pb-5">
      <StepTitle title="Dokumen Legal Perusahaan" subtitle="Lengkapi dokumen legal perusahaan" />
      <Input
        label="Akta Pendirian Perusahaan"
        placeholder="Masukan nomor akta"
        leftIcon={<FileText className="size-5" />}
        error={errors.legalDeed?.message}
        {...register('legalDeed')}
      />
      <Input
        label={licenseLabel}
        placeholder="Masukan nomor izin"
        leftIcon={<FileText className="size-5" />}
        error={errors.legalBusinessLicense?.message}
        {...register('legalBusinessLicense')}
      />
      <Input
        label="TDP / Sertifikat NIB"
        placeholder="Masukan nomor TDP / NIB"
        leftIcon={<FileText className="size-5" />}
        error={errors.legalTdpNib?.message}
        {...register('legalTdpNib')}
      />
      {/* NPWP sudah diisi di langkah Data Perusahaan — tidak diminta ulang di sini. */}
      <Input
        label="Tahun Pembuatan"
        placeholder="Contoh: 2020"
        leftIcon={<CalendarDays className="size-5" />}
        error={errors.establishedYear?.message}
        {...digitsField(register, 'establishedYear', 4)}
      />
      <Input
        label="SK Kemenkumham (opsional)"
        placeholder="Masukan nomor SK"
        leftIcon={<FileText className="size-5" />}
        error={errors.skKemenkumham?.message}
        {...register('skKemenkumham')}
      />
    </div>
  );
}
