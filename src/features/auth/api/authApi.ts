import { AxiosError } from 'axios';
import { userApi, extractErrorMessage } from '@/lib/api/client';
import { parseUser, type AdminLoginOutcome, type RegisterUserPayload, type User } from '../types';

interface TokenNode {
  access_token?: string;
  refresh_token?: string;
}

export interface LoginResult {
  token: string;
  refreshToken: string;
  user: User;
}

/**
 * Deteksi error login "email belum diverifikasi" (403 + `email_verified:false`).
 * Mengembalikan email yang perlu diverifikasi, atau null bila errornya lain.
 */
export function emailNotVerifiedFrom(error: unknown): string | null {
  if (!(error instanceof AxiosError)) return null;
  if (error.response?.status !== 403) return null;
  const data = (error.response?.data as { data?: Record<string, unknown> } | undefined)?.data;
  if (!data || data.email_verified !== false) return null;
  return typeof data.email === 'string' ? data.email : '';
}

/** Login user biasa via gateway customer. */
export async function loginUser(email: string, password: string): Promise<LoginResult> {
  const res = await userApi.post<{
    data?: { token?: TokenNode; member?: Record<string, unknown> };
  }>('/v1/auth/login', { email, password });

  const data = res.data?.data;
  const token = data?.token?.access_token ?? '';
  if (!token) throw new Error('Respons login tidak valid.');

  const memberJson = data?.member ?? {};
  const user = parseUser(memberJson);
  return {
    token,
    refreshToken: data?.token?.refresh_token ?? '',
    user: user.email ? user : { ...user, email },
  };
}

/** Hasil registrasi user: menentukan apakah layar verifikasi OTP perlu dibuka. */
export interface RegisterUserResult {
  /** false = akun baru, wajib verifikasi kode email. */
  emailVerified: boolean;
  /** false padahal belum terverifikasi = email kode gagal terkirim. */
  otpSent: boolean;
}

/** Registrasi user baru (account_type = user). */
export async function registerUser(payload: RegisterUserPayload): Promise<RegisterUserResult> {
  const res = await userApi.post<{
    data?: { email_verified?: boolean; otp_sent?: boolean };
  }>('/v1/auth/register', {
    fullname: payload.fullname,
    email: payload.email,
    password: payload.password,
    retype_password: payload.retypePassword,
    account_type: 'user',
    partner_type: '',
    business_name: '',
    business_phone: '',
    business_address: '',
  });

  const data = res.data?.data;
  return {
    emailVerified: data?.email_verified === true,
    otpSent: data?.otp_sent === true,
  };
}

/**
 * Minta (atau kirim ulang) kode verifikasi email.
 * Backend selalu membalas seragam agar endpoint publik ini tidak bisa dipakai
 * menebak email mana yang punya akun — jadi sukses di sini bukan berarti
 * emailnya terdaftar.
 */
export async function requestEmailOtp(email: string): Promise<{ cooldownSeconds: number }> {
  const res = await userApi.post<{ data?: { cooldown_seconds?: number } }>(
    '/v1/auth/otp/request',
    { email },
  );
  const cooldown = res.data?.data?.cooldown_seconds;
  return { cooldownSeconds: typeof cooldown === 'number' ? cooldown : 60 };
}

/** Tukar kode 6 digit dengan sesi login (dipakai untuk menuntaskan registrasi). */
export async function verifyEmailOtp(email: string, code: string): Promise<LoginResult> {
  const res = await userApi.post<{
    data?: { token?: TokenNode; member?: Record<string, unknown> };
  }>('/v1/auth/otp/verify', { email, code });

  const data = res.data?.data;
  const token = data?.token?.access_token ?? '';
  if (!token) throw new Error('Respons verifikasi tidak valid.');

  const user = parseUser(data?.member ?? {});
  return {
    token,
    refreshToken: data?.token?.refresh_token ?? '',
    user: user.email ? user : { ...user, email },
  };
}

/**
 * Minta kode setel ulang kata sandi.
 * Seperti `requestEmailOtp`, backend membalas seragam untuk email terdaftar
 * maupun tidak — sukses di sini bukan berarti emailnya punya akun.
 */
export async function requestPasswordReset(email: string): Promise<{ cooldownSeconds: number }> {
  const res = await userApi.post<{ data?: { cooldown_seconds?: number } }>(
    '/v1/auth/password/forgot',
    { email },
  );
  const cooldown = res.data?.data?.cooldown_seconds;
  return { cooldownSeconds: typeof cooldown === 'number' ? cooldown : 60 };
}

/**
 * Langkah 1: tukarkan kode 6 digit dengan token setel ulang sekali pakai.
 * Kode habis di sini, sehingga layar kata sandi baru tidak perlu menyimpannya.
 */
export async function verifyPasswordResetCode(
  email: string,
  code: string,
): Promise<{ resetToken: string; userRole: string }> {
  const res = await userApi.post<{ data?: { reset_token?: string; user_role?: string } }>(
    '/v1/auth/password/verify-code',
    { email, code },
  );
  const resetToken = res.data?.data?.reset_token;
  if (!resetToken) throw new Error('Respons verifikasi tidak valid.');
  return { resetToken, userRole: res.data?.data?.user_role ?? 'user' };
}

/**
 * Ke mana user diarahkan untuk masuk setelah setel ulang kata sandi.
 *
 * Mitra asuransi mendaftar lewat aplikasi ini, tapi **masuknya lewat
 * Backoffice** — portal mitra di webapp-v2 hanya untuk towing & bengkel.
 * Mengarahkan mereka ke halaman masuk mitra di sini akan berujung penolakan.
 */
export type PasswordResetLoginTarget = 'user' | 'mitra' | 'backoffice';

const MITRA_PORTAL_ROLES = new Set(['towing_admin', 'workshop_admin']);
const BACKOFFICE_ROLES = new Set(['insurance_admin']);

export function loginTargetForRole(userRole: string): PasswordResetLoginTarget {
  const role = userRole.trim().toLowerCase();
  if (BACKOFFICE_ROLES.has(role)) return 'backoffice';
  if (MITRA_PORTAL_ROLES.has(role)) return 'mitra';
  return 'user';
}

export interface ResetPasswordPayload {
  email: string;
  resetToken: string;
  newPassword: string;
  retypePassword: string;
}

/** Langkah 2: pasang kata sandi baru memakai token. Tidak menerbitkan sesi. */
export async function resetPassword(payload: ResetPasswordPayload): Promise<void> {
  await userApi.post('/v1/auth/password/reset', {
    email: payload.email,
    reset_token: payload.resetToken,
    new_password: payload.newPassword,
    retype_password: payload.retypePassword,
  });
}

export async function activateAccount(token: string): Promise<User> {
  const res = await userApi.post<{ data?: Record<string, unknown> }>('/v1/auth/activate', {
    token,
  });
  return parseUser(res.data?.data ?? {});
}

/** Field profil mitra dalam bentuk camelCase (sumber form). */
export interface PartnerProfileFields {
  companyName: string;
  nib: string;
  npwp?: string;
  officeAddress: string;
  city?: string;
  province?: string;
  latitude?: number;
  longitude?: number;
  companyEmail: string;
  companyPhone?: string;
  logoUrl?: string;
  picName: string;
  picPosition?: string;
  picKtpNumber: string;
  picKtpPhotoUrl?: string;
  picPhone: string;
  picEmail?: string;
  legalDeed?: string;
  legalBusinessLicense?: string;
  legalTdpNib?: string;
  establishedYear?: string;
  skKemenkumham?: string;
}

/** Ubah field profil mitra ke bentuk snake_case yang diharapkan backend. */
export function buildPartnerProfileBody(p: PartnerProfileFields): Record<string, unknown> {
  return {
    company_name: p.companyName,
    nib: p.nib,
    npwp: p.npwp ?? '',
    office_address: p.officeAddress,
    city: p.city ?? '',
    province: p.province ?? '',
    company_email: p.companyEmail,
    company_phone: p.companyPhone ?? '',
    latitude: p.latitude ?? 0,
    longitude: p.longitude ?? 0,
    logo_url: p.logoUrl ?? '',
    pic_name: p.picName,
    pic_position: p.picPosition ?? '',
    pic_ktp_number: p.picKtpNumber,
    pic_ktp_photo_url: p.picKtpPhotoUrl ?? '',
    pic_phone: p.picPhone,
    pic_email: p.picEmail ?? '',
    legal_deed: p.legalDeed ?? '',
    legal_business_license: p.legalBusinessLicense ?? '',
    legal_tdp_nib: p.legalTdpNib ?? '',
    established_year: p.establishedYear ?? '',
    sk_kemenkumham: p.skKemenkumham ?? '',
  };
}

export interface RegisterPartnerPayload extends PartnerProfileFields {
  partnerType: string;
  email: string;
  password: string;
  retypePassword: string;
}

/**
 * Cek apakah email masih bisa dipakai mendaftar.
 *
 * Dipanggil di langkah pertama wizard mitra. Tanpa ini, bentrok email baru
 * ketahuan setelah calon mitra mengisi seluruh formulir dan mengunggah logo
 * serta foto KTP — berkasnya jadi yatim di storage dan usahanya terbuang.
 */
export async function isEmailAvailable(email: string): Promise<boolean> {
  const res = await userApi.post<{ data?: { available?: boolean } }>('/v1/auth/email-available', {
    email,
  });
  return res.data?.data?.available !== false;
}

/** Registrasi mitra (account_type = partner). Login mitra dilakukan di backoffice. */
export async function registerPartner(payload: RegisterPartnerPayload): Promise<void> {
  const accountName = payload.picName.trim() || payload.companyName.trim() || payload.email;
  const companyEmail = payload.companyEmail.trim() || payload.email;

  await userApi.post('/v1/auth/register', {
    fullname: accountName,
    email: payload.email,
    password: payload.password,
    retype_password: payload.retypePassword,
    account_type: 'partner',
    partner_type: payload.partnerType,
    business_name: payload.companyName,
    business_phone: payload.companyPhone ?? '',
    business_address: payload.officeAddress,
    partner_profile: buildPartnerProfileBody({ ...payload, companyEmail }),
  });
}

/** Upload gambar onboarding mitra sebelum akun punya token login. */
export async function uploadPartnerOnboardingImage(file: File, category: string): Promise<string> {
  const form = new FormData();
  form.append('uploadfile', file, file.name || `${category}.jpg`);
  form.append('category', category);

  const res = await userApi.post<{ data?: unknown }>('/v1/s3/onboarding/image/upload', form);
  const data = res.data?.data;
  if (typeof data === 'string') return data;
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const value = obj.file_path ?? obj.image_name ?? obj.url ?? obj.key;
    if (typeof value === 'string') return value;
  }
  throw new Error('Respons unggah gambar tidak valid.');
}

/** Ambil profil user terkini. */
export async function fetchProfile(): Promise<User> {
  const res = await userApi.get<{ data?: Record<string, unknown> }>('/v1/member/profile');
  return parseUser(res.data?.data ?? {});
}

export interface UpdateProfilePayload {
  fullname: string;
  email: string;
  phone: string;
  imageName?: string;
}

/** Simpan perubahan profil user. */
export async function updateProfile(payload: UpdateProfilePayload): Promise<User> {
  const res = await userApi.put<{ data?: Record<string, unknown> }>('/v1/member/profile', {
    fullname: payload.fullname,
    email: payload.email,
    phone: payload.phone,
    image_name: payload.imageName ?? '',
  });
  return parseUser(res.data?.data ?? {});
}

export interface ChangePasswordPayload {
  currentPassword: string;
  newPassword: string;
  retypePassword: string;
}

/** Ubah kata sandi user yang sedang login. */
export async function changePassword(payload: ChangePasswordPayload): Promise<void> {
  await userApi.put('/v1/member/password', {
    current_password: payload.currentPassword,
    new_password: payload.newPassword,
    retype_password: payload.retypePassword,
  });
}

/** Upload avatar profil user yang sudah login. */
export async function uploadProfileImage(file: File): Promise<string> {
  const form = new FormData();
  form.append('uploadfile', file, file.name || 'profile-avatar.jpg');
  form.append('category', 'profile_avatar');

  const res = await userApi.post<{ data?: unknown }>('/v1/s3/image/upload', form);
  const data = res.data?.data;
  if (typeof data === 'string') return data;
  if (data && typeof data === 'object') {
    const obj = data as Record<string, unknown>;
    const value = obj.file_path ?? obj.image_name ?? obj.url ?? obj.key;
    if (typeof value === 'string') return value;
  }
  throw new Error('Respons unggah foto profil tidak valid.');
}

/** Hasil probe login mitra/sopir: `outcome` non-null hanya bila berhasil. */
export interface AdminLoginProbe {
  outcome: AdminLoginOutcome | null;
  /** Pesan siap-tampil dari gateway bila gagal (kosong bila berhasil). */
  errorMessage: string;
}

/**
 * Login admin/partner (`/v1/admin/auth/login`) untuk halaman mitra/sopir.
 * `outcome` non-null bila berhasil; bila gagal, `errorMessage` berisi pesan
 * dari gateway (mis. akun mitra belum diaktivasi admin) untuk ditampilkan.
 */
export async function probeAdminLogin(
  email: string,
  password: string,
): Promise<AdminLoginProbe> {
  try {
    const res = await userApi.post<{
      data?: { access_token?: string; admin?: Record<string, unknown> };
    }>('/v1/admin/auth/login', { email, password }, { headers: { Authorization: undefined } });
    const data = res.data?.data;
    const admin = data?.admin ?? {};
    const token = data?.access_token ?? '';
    const role = typeof admin.role === 'string' ? admin.role : '';
    if (!token || !role) {
      return { outcome: null, errorMessage: 'Periksa kembali email dan kata sandi Anda.' };
    }
    return {
      outcome: {
        token,
        role,
        name: typeof admin.fullname === 'string' ? admin.fullname : '',
        accountStatus: typeof admin.account_status === 'string' ? admin.account_status : 'ACTIVE',
        rejectionReason: typeof admin.rejection_reason === 'string' ? admin.rejection_reason : '',
        rejectionCount: typeof admin.rejection_count === 'number' ? admin.rejection_count : 0,
      },
      errorMessage: '',
    };
  } catch (error) {
    return {
      outcome: null,
      errorMessage: extractErrorMessage(error, 'Periksa kembali email dan kata sandi Anda.'),
    };
  }
}
