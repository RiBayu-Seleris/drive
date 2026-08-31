import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
  BadgeCheck,
  Camera,
  CarFront,
  ChevronRight,
  ClipboardList,
  FileText,
  Info,
  Languages,
  Lock,
  LogOut,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Star,
  type LucideIcon,
} from 'lucide-react';
import { confirm } from '@/components/feedback/confirm';
import { toast } from '@/components/feedback/toast';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Modal } from '@/components/ui/Modal';
import { ROUTES } from '@/app/routes';
import { APP_INFO } from '@/config/constants';
import { DEFAULT_AVATAR, resolveAvatarSrc } from '@/lib/utils/avatar';
import { extractErrorMessage } from '@/lib/api/client';
import { storage } from '@/lib/storage/storage';
import {
  changePassword,
  fetchProfile,
  updateProfile,
  uploadProfileImage,
} from '@/features/auth/api/authApi';
import { useAuthStore } from '@/features/auth/store/authStore';
import type { User } from '@/features/auth/types';

const PROFILE_QUERY_KEY = ['member-profile'];
const PROFILE_COUNTRY_KEY = 'profile_country';
const PROFILE_LANGUAGE_KEY = 'profile_language';

interface ProfileForm {
  fullname: string;
  email: string;
  phone: string;
  imageName: string;
  avatarPreview: string;
}

interface PasswordForm {
  currentPassword: string;
  newPassword: string;
  retypePassword: string;
}

type InfoDialog = 'country' | 'language' | 'guide' | 'about' | null;

export function ProfilePage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [editOpen, setEditOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [infoDialog, setInfoDialog] = useState<InfoDialog>(null);
  const [country, setCountry] = useState(
    () => storage.getString(PROFILE_COUNTRY_KEY) ?? 'Indonesia',
  );
  const [language, setLanguage] = useState(
    () => storage.getString(PROFILE_LANGUAGE_KEY) ?? 'Bahasa Indonesia',
  );
  const [profileForm, setProfileForm] = useState<ProfileForm>(() => emptyProfileForm(user));
  const [passwordForm, setPasswordForm] = useState<PasswordForm>({
    currentPassword: '',
    newPassword: '',
    retypePassword: '',
  });

  const profileQuery = useQuery({
    queryKey: PROFILE_QUERY_KEY,
    queryFn: fetchProfile,
    staleTime: 60_000,
  });

  const activeUser = profileQuery.data ?? user;

  useEffect(() => {
    if (profileQuery.data) setUser(profileQuery.data);
  }, [profileQuery.data, setUser]);

  useEffect(() => {
    const preview = profileForm.avatarPreview;
    return () => {
      if (preview.startsWith('blob:')) URL.revokeObjectURL(preview);
    };
  }, [profileForm.avatarPreview]);

  const uploadAvatarMutation = useMutation({
    mutationFn: uploadProfileImage,
    onSuccess: (imageName) => {
      setProfileForm((current) => ({ ...current, imageName }));
      toast.success('Foto profil berhasil diunggah.');
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error, 'Foto profil gagal diunggah.'));
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: (updatedUser) => {
      setUser(updatedUser);
      queryClient.setQueryData(PROFILE_QUERY_KEY, updatedUser);
      setEditOpen(false);
      toast.success('Profil berhasil diperbarui.');
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error, 'Profil gagal diperbarui.'));
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: changePassword,
    onSuccess: () => {
      setPasswordForm({ currentPassword: '', newPassword: '', retypePassword: '' });
      setPasswordOpen(false);
      toast.success('Kata sandi berhasil diperbarui.');
    },
    onError: (error) => {
      toast.error(extractErrorMessage(error, 'Kata sandi gagal diperbarui.'));
    },
  });

  const openEditProfile = () => {
    setProfileForm(emptyProfileForm(activeUser));
    setEditOpen(true);
  };

  const handleProfileSubmit = () => {
    const fullname = profileForm.fullname.trim();
    const email = profileForm.email.trim();
    const phone = profileForm.phone.trim();

    if (!fullname) {
      toast.warning('Nama lengkap wajib diisi.');
      return;
    }
    if (!email) {
      toast.warning('Email akun tidak ditemukan.');
      return;
    }
    if (!phone) {
      toast.warning('Nomor telepon wajib diisi.');
      return;
    }

    updateProfileMutation.mutate({
      fullname,
      email,
      phone,
      imageName: profileForm.imageName.trim(),
    });
  };

  const handleAvatarFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.warning('Gunakan file gambar untuk foto profil.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.warning('Ukuran foto profil maksimal 5 MB.');
      return;
    }

    const preview = URL.createObjectURL(file);
    setProfileForm((current) => ({ ...current, avatarPreview: preview }));
    uploadAvatarMutation.mutate(file);
  };

  const handlePasswordSubmit = () => {
    const currentPassword = passwordForm.currentPassword.trim();
    const newPassword = passwordForm.newPassword.trim();
    const retypePassword = passwordForm.retypePassword.trim();

    if (!currentPassword || !newPassword || !retypePassword) {
      toast.warning('Lengkapi semua kolom kata sandi.');
      return;
    }
    if (newPassword.length < 8) {
      toast.warning('Kata sandi baru minimal 8 karakter.');
      return;
    }
    if (newPassword !== retypePassword) {
      toast.warning('Konfirmasi kata sandi baru tidak sama.');
      return;
    }

    changePasswordMutation.mutate({ currentPassword, newPassword, retypePassword });
  };

  const handleLogout = async () => {
    const ok = await confirm({
      title: 'Keluar',
      message: 'Anda yakin ingin keluar dari akun DRIVE?',
      confirmText: 'Keluar',
      cancelText: 'Batal',
      tone: 'danger',
    });
    if (ok) {
      logout();
      navigate(ROUTES.home, { replace: true });
    }
  };

  const handleCountryChange = (value: string) => {
    setCountry(value);
    storage.setString(PROFILE_COUNTRY_KEY, value);
    toast.success('Negara berhasil disimpan.');
  };

  const handleLanguageChange = (value: string) => {
    setLanguage(value);
    storage.setString(PROFILE_LANGUAGE_KEY, value);
    toast.success('Bahasa berhasil disimpan.');
  };

  return (
    <div className="relative w-full bg-neutral-200 pb-10">
      {/*
        Pita berfoto yang DIAM saat digulir.

        `sticky`, bukan `fixed`: elemen fixed keluar dari alur dan melebar
        seukuran layar, sehingga di layar lebar fotonya menyembur keluar dari
        wadah aplikasi yang lebarnya terbatas. Sticky tetap terikat wadahnya.

        Kartu di bawahnya diberi z-index lebih tinggi dan latar pekat, jadi ia
        naik MENUTUPI foto saat digulir — bukan fotonya yang ikut naik. Itu yang
        memberi kesan berlapis.

        Sebelumnya di sini ada grafis ScanHero ukuran 112px yang menggantung di
        tengah ruang kosong — ia mengulang pesan yang sama dengan halaman masuk,
        dan di halaman profil tidak menjelaskan apa pun. Foto memberi kedalaman
        sekaligus menyamakan halaman ini dengan beranda dan halaman masuk, yang
        keduanya sudah memakai foto yang sama (jadi sudah ada di cache).
      */}
      <div className="sticky top-0 z-0 h-72 w-full overflow-hidden">
        <img
          src="/assets/home/home.webp"
          alt=""
          className="absolute inset-0 size-full object-cover object-[64%_62%]"
        />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(7,12,17,0.55)_0%,rgba(7,12,17,0.35)_35%,rgba(15,23,32,0.9)_78%,var(--color-neutral-200)_100%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(100%_70%_at_18%_6%,rgba(173,237,31,0.26),transparent_58%)]" />
        <div className="drive-header drive-fade-b absolute inset-0 opacity-30" />
      </div>

      <div className="relative z-10 -mt-16 w-full rounded-t-3xl bg-neutral-100 pb-12 shadow-lg">
        <div className="relative flex flex-col items-center px-6">
          <img
            src={resolveAvatarSrc(activeUser?.imageName)}
            className="border-deep-blue-500/50 -mt-20 size-[160px] rounded-full border-4 bg-neutral-200 object-cover shadow-lg"
            alt="Foto profil"
          />
          <div className="mt-3 flex max-w-[90%] items-center gap-2">
            <h1 className="truncate text-lg font-semibold text-neutral-900">
              {activeUser?.fullname || 'Pengguna DRIVE'}
            </h1>
            <BadgeCheck className="text-deep-blue-500 size-5 shrink-0" aria-hidden />
          </div>
          <p className="text-sm text-neutral-500">{statusLabel(activeUser?.accountStatus)}</p>
          <button
            type="button"
            onClick={openEditProfile}
            className="mt-4 rounded-lg bg-deep-blue-500/20 px-4 py-2 text-sm font-medium text-deep-blue-500 transition hover:bg-deep-blue-500"
          >
            Edit Profil
          </button>
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 px-4">
          <InfoPill icon={Mail} value={activeUser?.email || '-'} />
          <InfoPill icon={Phone} value={activeUser?.phone || '-'} />
        </div>

        <div className="mx-4 mt-6 space-y-4">
          <MenuSection>
            <MenuRow
              icon={ClipboardList}
              label="Aktivitas Terkini"
              onClick={() => navigate(ROUTES.recentActivity)}
            />
            <MenuRow
              icon={CarFront}
              label="Kendaraan Saya"
              onClick={() => navigate(ROUTES.myVehicles)}
            />
            <MenuRow
              icon={ShieldCheck}
              label="Klaim Saya"
              onClick={() => navigate(ROUTES.claims)}
            />
			<MenuRow
				icon={FileText}
				label="Polis Saya"
				onClick={() => navigate(ROUTES.insurancePolicies)}
			/>
          </MenuSection>

          <MenuSection>
            <MenuRow icon={Lock} label="Ubah Kata Sandi" onClick={() => setPasswordOpen(true)} />
            <MenuRow
              icon={MapPin}
              label="Negara"
              value={country}
              onClick={() => setInfoDialog('country')}
            />
            <MenuRow
              icon={Languages}
              label="Bahasa"
              value={language}
              onClick={() => setInfoDialog('language')}
            />
            <MenuRow
              icon={FileText}
              label="Panduan Penggunaan"
              onClick={() => setInfoDialog('guide')}
            />
            <MenuRow icon={Star} label="Rating DRIVE" onClick={() => navigate(ROUTES.rating)} />
            <MenuRow icon={Info} label="Tentang DRIVE" onClick={() => setInfoDialog('about')} />
          </MenuSection>

          <button
            type="button"
            onClick={handleLogout}
            className="drive-card flex w-full items-center justify-between rounded-2xl p-4 text-xs font-medium text-danger"
          >
            <span>Keluar</span>
            <LogOut className="size-5 text-danger" />
          </button>
        </div>
      </div>

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Profil"
        variant="sheet"
        footer={
          <Button
            onClick={handleProfileSubmit}
            isLoading={updateProfileMutation.isPending || uploadAvatarMutation.isPending}
          >
            Simpan Perubahan
          </Button>
        }
      >
        <div className="space-y-5">
          <div className="flex flex-col items-center">
            <img
              src={profileForm.avatarPreview || DEFAULT_AVATAR}
              alt="Foto profil"
              className="size-28 rounded-full border-4 border-white object-cover shadow-md"
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarFile}
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              fullWidth={false}
              className="mt-3"
              leftIcon={<Camera className="size-4" />}
              onClick={() => fileInputRef.current?.click()}
              isLoading={uploadAvatarMutation.isPending}
            >
              Ganti Foto
            </Button>
          </div>

          <Input
            label="Nama Lengkap"
            value={profileForm.fullname}
            onChange={(event) =>
              setProfileForm((current) => ({ ...current, fullname: event.target.value }))
            }
          />
          <Input label="Email" value={profileForm.email} disabled />
          <Input
            label="Nomor Telepon"
            value={profileForm.phone}
            inputMode="tel"
            onChange={(event) =>
              setProfileForm((current) => ({ ...current, phone: event.target.value }))
            }
          />
        </div>
      </Modal>

      <Modal
        open={passwordOpen}
        onClose={() => setPasswordOpen(false)}
        title="Ubah Kata Sandi"
        variant="sheet"
        footer={
          <Button onClick={handlePasswordSubmit} isLoading={changePasswordMutation.isPending}>
            Simpan Kata Sandi
          </Button>
        }
      >
        <div className="space-y-4">
          <Input
            label="Kata Sandi Lama"
            type="password"
            value={passwordForm.currentPassword}
            onChange={(event) =>
              setPasswordForm((current) => ({
                ...current,
                currentPassword: event.target.value,
              }))
            }
          />
          <Input
            label="Kata Sandi Baru"
            type="password"
            value={passwordForm.newPassword}
            onChange={(event) =>
              setPasswordForm((current) => ({ ...current, newPassword: event.target.value }))
            }
          />
          <Input
            label="Ulangi Kata Sandi Baru"
            type="password"
            value={passwordForm.retypePassword}
            onChange={(event) =>
              setPasswordForm((current) => ({ ...current, retypePassword: event.target.value }))
            }
          />
        </div>
      </Modal>

      <ProfileInfoDialog
        open={infoDialog !== null}
        type={infoDialog}
        country={country}
        language={language}
        onCountryChange={handleCountryChange}
        onLanguageChange={handleLanguageChange}
        onClose={() => setInfoDialog(null)}
      />
    </div>
  );
}

function MenuSection({ children }: { children: ReactNode }) {
  return <div className="drive-card overflow-hidden rounded-2xl">{children}</div>;
}

function MenuRow({
  icon: Icon,
  label,
  value,
  onClick,
}: {
  icon: LucideIcon;
  label: string;
  value?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between border-b border-neutral-200 p-4 text-left text-xs last:border-b-0"
    >
      <div className="flex min-w-0 items-center gap-3">
        <Icon className="size-5 shrink-0 text-neutral-600" />
        <span className="truncate text-xs text-neutral-800">{label}</span>
      </div>
      <div className="flex max-w-[45%] shrink-0 items-center gap-2">
        {value && <span className="truncate text-sm text-neutral-500">{value}</span>}
        <ChevronRight className="size-5 text-neutral-500" />
      </div>
    </button>
  );
}

function InfoPill({ icon: Icon, value }: { icon: LucideIcon; value: string }) {
  return (
    <div className="drive-card flex items-center space-x-2 rounded-xl p-3">
      <Icon className="size-5 shrink-0 text-neutral-500" />
      <span className="truncate text-xs text-neutral-700">{value}</span>
    </div>
  );
}

function ProfileInfoDialog({
  open,
  type,
  country,
  language,
  onCountryChange,
  onLanguageChange,
  onClose,
}: {
  open: boolean;
  type: InfoDialog;
  country: string;
  language: string;
  onCountryChange: (value: string) => void;
  onLanguageChange: (value: string) => void;
  onClose: () => void;
}) {
  if (!type) return null;

  const title = {
    country: 'Negara',
    language: 'Bahasa',
    guide: 'Panduan Penggunaan',
    about: 'Tentang DRIVE',
  }[type];

  return (
    <Modal open={open} onClose={onClose} title={title} variant="sheet">
      {type === 'country' && (
        <div className="space-y-3">
          <ChoiceButton
            selected={country === 'Indonesia'}
            onClick={() => onCountryChange('Indonesia')}
          >
            Indonesia
          </ChoiceButton>
          <p className="text-xs leading-5 text-neutral-500">
            Layanan DRIVE saat ini tersedia untuk Indonesia.
          </p>
        </div>
      )}

      {type === 'language' && (
        <div className="space-y-3">
          <ChoiceButton
            selected={language === 'Bahasa Indonesia'}
            onClick={() => onLanguageChange('Bahasa Indonesia')}
          >
            Bahasa Indonesia
          </ChoiceButton>
          <p className="text-xs leading-5 text-neutral-500">
            Bahasa Indonesia digunakan sebagai bahasa utama aplikasi.
          </p>
        </div>
      )}

      {type === 'guide' && (
        <div className="space-y-3 text-sm leading-6 text-neutral-700">
          <GuideItem
            number="1"
            text="Pilih cek kondisi kendaraan, foto plat, lalu ambil foto empat sisi mobil."
          />
          <GuideItem
            number="2"
            text="Buka detail analisis agar rincian kerusakan dan estimasi biaya tersedia."
          />
          <GuideItem
            number="3"
            text="Jika memiliki polis aktif, ajukan klaim dari halaman estimasi biaya."
          />
          <GuideItem
            number="4"
            text="Pilih rekomendasi bengkel atau pantau status klaim dari menu aktivitas."
          />
        </div>
      )}

      {type === 'about' && (
        <div className="space-y-4 text-sm leading-6 text-neutral-700">
          <div>
            <p className="font-semibold text-neutral-900">{APP_INFO.name}</p>
            <p>{APP_INFO.tagline}</p>
          </div>
          <div className="rounded-xl bg-neutral-200 p-4">
            <p className="text-xs font-medium text-neutral-500">Bantuan</p>
            <p className="mt-1">{APP_INFO.supportEmail}</p>
            <p>{APP_INFO.supportWhatsapp}</p>
          </div>
        </div>
      )}
    </Modal>
  );
}

function ChoiceButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-xl border border-neutral-300 px-4 py-3 text-sm font-medium text-neutral-800"
    >
      <span>{children}</span>
      {selected && <BadgeCheck className="text-deep-blue-500 size-5" />}
    </button>
  );
}

function GuideItem({ number, text }: { number: string; text: string }) {
  return (
    <div className="flex gap-3">
      <span className="bg-deep-blue-50 text-deep-blue-600 flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold">
        {number}
      </span>
      <p>{text}</p>
    </div>
  );
}

function emptyProfileForm(user?: User | null): ProfileForm {
  return {
    fullname: user?.fullname ?? '',
    email: user?.email ?? '',
    phone: user?.phone ?? '',
    imageName: user?.imageName ?? '',
    avatarPreview: resolveAvatarSrc(user?.imageName),
  };
}

function statusLabel(status?: string): string {
  if (!status) return 'Akun aktif';
  if (status === 'ACTIVE') return 'Akun aktif';
  if (status === 'PENDING_VERIFICATION') return 'Menunggu verifikasi';
  if (status === 'APPROVED_PENDING_ACTIVATION') return 'Menunggu aktivasi';
  if (status === 'SUSPENDED') return 'Akun ditangguhkan';
  return status.replaceAll('_', ' ').toLowerCase();
}
