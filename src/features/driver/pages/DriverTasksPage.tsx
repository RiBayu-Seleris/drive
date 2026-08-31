import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  BadgeCheck,
  Bell,
  CarFront,
  ChartColumn,
  Check,
  ChevronRight,
  CircleHelp,
  CircleUser,
  ClipboardList,
  FileText,
  Flag,
  Headphones,
  History,
  House,
  KeyRound,
  Lightbulb,
  LogOut,
  MapPin,
  Navigation,
  PackageCheck,
  Phone,
  Search,
  Star,
  Truck,
  UserPen,
  UserRound,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';
import { PageContainer } from '@/components/layout/PageContainer';
import { AppHeader } from '@/components/layout/AppHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/TextArea';
import { LoadingState } from '@/components/ui/Spinner';
import { ErrorState, EmptyState } from '@/components/feedback/StateViews';
import { confirm } from '@/components/feedback/confirm';
import { toast } from '@/components/feedback/toast';
import { MapView, type MapMarker, type MapPoint } from '@/components/map/MapView';
import { DEFAULT_MAP_POINT } from '@/components/map/leafletConfig';
import { ROUTES } from '@/app/routes';
import { useDriverStore } from '@/features/auth/store/driverStore';
import { extractErrorMessage } from '@/lib/api/client';
import { cn } from '@/lib/utils/cn';
import { keepDigits, keepPhone } from '@/lib/utils/inputFilters';
import { uploadFilePublic } from '@/lib/upload/publicUpload';
import { formatCurrency, formatDateTime } from '@/lib/utils/format';
import { Logo } from '@/components/brand/Logo';
import {
  changeDriverPassword,
  getDriverProfile,
  getDriverTasks,
  rejectDriverOrder,
  scanDriverSettlementCode,
  setDriverAvailability,
  settleDriverSettlementCode,
  subscribeDriverTowingOrderChanges,
  updateDriverLocation,
  updateDriverProfile,
  updateDriverTaskStatus,
  type DriverProfile,
} from '../api/driverApi';
import { DropoffProof } from '../components/DropoffProof';
import { FleetInspection } from '../components/FleetInspection';
import {
  driverDestinationLabel,
  driverNeedsInspection,
  driverNextActionLabel,
  driverNextStatus,
  driverStatusLabel,
  driverTaskPlate,
  driverTaskProblem,
  driverTaskRevenue,
  isDriverTaskCanceled,
  isDriverTaskFinished,
  type DriverTask,
} from '../types';

type DriverTab = 'home' | 'orders' | 'history' | 'account';
type DriverScreen =
  | { kind: 'tabs' }
  | { kind: 'detail'; task: DriverTask }
  | { kind: 'accepted'; task: DriverTask }
  | { kind: 'inspection'; task: DriverTask }
  | { kind: 'dropoffProof'; task: DriverTask }
  | { kind: 'tracking'; task: DriverTask }
  | { kind: 'biodata' }
  | { kind: 'editProfile' }
  | { kind: 'changePassword' };
type BadgeTone = 'neutral' | 'blue' | 'green' | 'yellow' | 'red';
type AdvanceAfter = 'accepted' | 'inspection' | 'tracking' | 'stay';

const ACTIVE_STATUSES = new Set([
  'ASSIGNED',
  'ACCEPTED_BY_DRIVER',
  'EN_ROUTE_TO_PICKUP',
  'ARRIVED_PICKUP',
  'PICKED_UP',
  'EN_ROUTE_TO_DROPOFF',
]);

const TRACKING_STEPS = [
  {
    key: 'pickup',
    label: 'Menuju Lokasi',
    caption: 'Menuju titik jemput pelanggan',
    statuses: ['EN_ROUTE_TO_PICKUP'],
  },
  {
    key: 'arrived',
    label: 'Sampai di Lokasi',
    caption: 'Konfirmasi tiba di lokasi',
    statuses: ['ARRIVED_PICKUP'],
  },
  {
    key: 'towing',
    label: 'Proses Towing',
    caption: 'Cek keamanan & mobil dinaikkan',
    statuses: ['PICKED_UP', 'EN_ROUTE_TO_DROPOFF'],
  },
  {
    key: 'done',
    label: 'Selesai',
    caption: 'Drop-off di tujuan & pembayaran',
    statuses: ['DROPPED_OFF', 'COMPLETED'],
  },
] as const;

const PAGE_BG = 'bg-[#131c24]';
const DRIVER_CARD =
  'drive-card rounded-xl border border-[#223039]/30 flex flex-col gap-y-3 p-5';

function hasCoord(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);
}

function statusTone(status: string): BadgeTone {
  if (isDriverTaskFinished(status)) return 'green';
  if (isDriverTaskCanceled(status)) return 'red';
  if (status === 'ASSIGNED') return 'yellow';
  return 'blue';
}

function taskTime(task: DriverTask): string {
  return task.assignedAt ?? task.requestedAt ?? task.completedAt ?? '';
}

function finishedInLast30Days(tasks: DriverTask[]): number {
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  return tasks.filter((task) => {
    if (!isDriverTaskFinished(task.status)) return false;
    const timestamp = new Date(task.completedAt ?? taskTime(task)).getTime();
    return Number.isFinite(timestamp) && timestamp >= cutoff;
  }).length;
}

function destinationPoint(task: DriverTask): MapPoint | null {
  if (!hasCoord(task.dropoffLatitude, task.dropoffLongitude)) return null;
  return { lat: task.dropoffLatitude, lng: task.dropoffLongitude };
}

function pickupPoint(task: DriverTask): MapPoint | null {
  if (!hasCoord(task.pickupLatitude, task.pickupLongitude)) return null;
  return { lat: task.pickupLatitude, lng: task.pickupLongitude };
}

/** Kode tampilan sopir, mis. DRV-0003. */
function driverCodeLabel(id: number): string {
  return `DRV-${String(id).padStart(4, '0')}`;
}

function driverInitial(name: string): string {
  const initial = name.trim().charAt(0).toUpperCase();
  return initial || 'S';
}

function trackingProgressIndex(status: string): number {
  const index = TRACKING_STEPS.findIndex((step) =>
    step.statuses.some((stepStatus) => stepStatus === status),
  );
  if (status === 'ACCEPTED_BY_DRIVER') return -1;
  return index >= 0 ? index : 0;
}

function taskVehicleTitle(task: DriverTask): string {
  const plate = driverTaskPlate(task);
  return plate && plate !== '-' ? plate : task.orderCode;
}

function kmEstimate(tasks: DriverTask[]): number {
  const total = tasks.reduce((sum, task) => sum + (tripKm(task) ?? 0), 0);
  return Math.round(total * 10) / 10;
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const earthRadiusKm = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return Math.round(earthRadiusKm * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * 10) / 10;
}

function tripKm(task: DriverTask): number | null {
  if (
    !hasCoord(task.pickupLatitude, task.pickupLongitude) ||
    !hasCoord(task.dropoffLatitude, task.dropoffLongitude)
  ) {
    return null;
  }
  return haversineKm(
    task.pickupLatitude,
    task.pickupLongitude,
    task.dropoffLatitude,
    task.dropoffLongitude,
  );
}

function tripDistanceLabel(task: DriverTask): string {
  const km = tripKm(task);
  return km === null ? '-' : `${km.toFixed(1)} KM`;
}

/** Estimasi waktu tempuh kasar (asumsi 40 km/jam), minimal 5 menit. */
function tripEtaMnt(km: number): number {
  return Math.max(5, Math.round((km / 40) * 60));
}

function tripEtaLabel(task: DriverTask): string {
  const km = tripKm(task);
  return km === null ? '-' : `~${tripEtaMnt(km)} mnt`;
}

function orderKindLabel(task: DriverTask): 'KLAIM' | 'UMUM' {
  return task.claimNumber ? 'KLAIM' : 'UMUM';
}

function driverRating(): string {
  // API tugas sopir belum mengirim agregat rating. Jangan mengisi angka contoh.
  return '-';
}

function taskAddressExcerpt(address: string): string {
  return address.split(',')[0]?.trim() || address || '-';
}

function historyTitle(task: DriverTask): string {
  const plate = driverTaskPlate(task);
  if (plate === '-') return task.orderCode;
  return plate;
}

const TAB_VALUES: readonly DriverTab[] = ['home', 'orders', 'history', 'account'];
const PLAIN_SCREENS = ['biodata', 'editProfile', 'changePassword'] as const;
const TASK_SCREENS = ['detail', 'accepted', 'inspection', 'dropoffProof', 'tracking'] as const;
type PlainScreenKind = (typeof PLAIN_SCREENS)[number];
type TaskScreenKind = (typeof TASK_SCREENS)[number];

export function DriverTasksPage() {
  const navigate = useNavigate();
  const name = useDriverStore((s) => s.name);
  const logout = useDriverStore((s) => s.logout);
  const queryClient = useQueryClient();
  // Tab & layar disimpan di URL (?tab=&screen=&code=) supaya gestur back/forward
  // browser berjalan alami di dalam portal — bukan melempar keluar ke login.
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab: DriverTab = TAB_VALUES.includes(tabParam as DriverTab)
    ? (tabParam as DriverTab)
    : 'home';
  const screenParam = searchParams.get('screen');
  const codeParam = searchParams.get('code') ?? '';

  const {
    data = [],
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['driver-tasks'],
    queryFn: getDriverTasks,
    staleTime: 10_000,
  });

  // Profil sopir (biodata, foto, dokumen) — dipakai layar Account/Data Sopir/Edit.
  const { data: profile } = useQuery({
    queryKey: ['driver-profile'],
    queryFn: getDriverProfile,
    staleTime: 30_000,
  });

  useEffect(() => {
    return subscribeDriverTowingOrderChanges({
      onChange: () => {
        void queryClient.invalidateQueries({ queryKey: ['driver-tasks'] });
      },
      // Admin mengubah status atau menonaktifkan sopir dari papan dispatch.
      // Tanpa ini layar sopir tetap menampilkan status lamanya sampai halaman
      // dimuat ulang — dan dia baru sadar saat menekan tombol.
      onSelfChange: () => {
        void queryClient.invalidateQueries({ queryKey: ['driver-profile'] });
        void queryClient.invalidateQueries({ queryKey: ['driver-tasks'] });
      },
    });
  }, [queryClient]);

  const taskByCode = useMemo(() => {
    const map = new Map<string, DriverTask>();
    data.forEach((task) => map.set(task.orderCode, task));
    return map;
  }, [data]);

  // Layar aktif diturunkan dari URL; layar ber-task butuh datanya sudah termuat.
  const screen: DriverScreen = useMemo(() => {
    if ((PLAIN_SCREENS as readonly string[]).includes(screenParam ?? '')) {
      return { kind: screenParam as PlainScreenKind };
    }
    if ((TASK_SCREENS as readonly string[]).includes(screenParam ?? '') && codeParam) {
      const task = taskByCode.get(codeParam);
      if (task) return { kind: screenParam as TaskScreenKind, task };
    }
    return { kind: 'tabs' };
  }, [screenParam, codeParam, taskByCode]);

  /** Susun query-string untuk tab/layar (tab dipertahankan agar back kembali ke tab asal). */
  const paramsFor = (t: DriverTab, scr?: string, code?: string): Record<string, string> => {
    const params: Record<string, string> = {};
    if (t !== 'home') params.tab = t;
    if (scr) params.screen = scr;
    if (code) params.code = code;
    return params;
  };
  const goTab = (t: DriverTab, replace = false) => setSearchParams(paramsFor(t), { replace });
  const goScreen = (kind: PlainScreenKind | TaskScreenKind, task?: DriverTask, replace = false) =>
    setSearchParams(paramsFor(tab, kind, task?.orderCode), { replace });
  const goBack = () => navigate(-1);

  const activeTasks = useMemo(
    () =>
      data
        .filter((task) => ACTIVE_STATUSES.has(task.status))
        .sort((a, b) => {
          const left = new Date(taskTime(a)).getTime() || 0;
          const right = new Date(taskTime(b)).getTime() || 0;
          return right - left;
        }),
    [data],
  );
  const finishedTasks = useMemo(
    () => data.filter((task) => isDriverTaskFinished(task.status)),
    [data],
  );
  const currentTask = activeTasks[0] ?? null;

  const advance = useMutation({
    mutationFn: ({
      task,
      status,
      proof,
    }: {
      task: DriverTask;
      status: string;
      after: AdvanceAfter;
      proof?: { front: string; rear: string };
    }) => updateDriverTaskStatus(task.orderCode, status, proof),
    onSuccess: (status, variables) => {
      // Cache diperbarui langsung agar layar turunan URL menampilkan status baru
      // tanpa menunggu refetch.
      queryClient.setQueryData<DriverTask[]>(['driver-tasks'], (old) =>
        (old ?? []).map((t) => (t.orderCode === variables.task.orderCode ? { ...t, status } : t)),
      );
      void queryClient.invalidateQueries({ queryKey: ['driver-tasks'] });
      // Perpindahan antar-langkah alur memakai REPLACE: gestur back dari layar
      // alur kembali ke daftar Orderan, bukan ke langkah alur yang sudah basi.
      if (variables.after === 'accepted') {
        goScreen('accepted', variables.task, true);
      } else if (variables.after === 'inspection') {
        goScreen('inspection', variables.task, true);
      } else if (variables.after === 'tracking') {
        goScreen('tracking', variables.task, true);
      }
      toast.success('Status order diperbarui.');
    },
    onError: (error) => toast.error(extractErrorMessage(error, 'Status order gagal diperbarui.')),
  });

  // Saklar Online/Offline sopir; BUSY ditolak backend (milik sistem).
  const availability = useMutation({
    mutationFn: (status: 'AVAILABLE' | 'OFFLINE') => setDriverAvailability(status),
    onSuccess: (_data, status) => {
      queryClient.setQueryData<DriverProfile | undefined>(['driver-profile'], (old) =>
        old ? { ...old, status } : old,
      );
      void queryClient.invalidateQueries({ queryKey: ['driver-profile'] });
      toast.success(status === 'AVAILABLE' ? 'Anda kini Online.' : 'Anda kini Offline.');
    },
    onError: (error) => toast.error(extractErrorMessage(error, 'Gagal mengubah status.')),
  });

  const reject = useMutation({
    mutationFn: ({ code, note }: { code: string; note: string }) => rejectDriverOrder(code, note),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['driver-tasks'] });
      toast.success('Order ditolak dan dikembalikan ke admin mitra.');
      goTab('orders', true);
    },
    onError: (error) => toast.error(extractErrorMessage(error, 'Order gagal ditolak.')),
  });

  const selectedTask =
    screen.kind === 'detail' ||
    screen.kind === 'accepted' ||
    screen.kind === 'inspection' ||
    screen.kind === 'dropoffProof' ||
    screen.kind === 'tracking'
      ? (taskByCode.get(screen.task.orderCode) ?? screen.task)
      : null;

  // Membuka layar kerja sesuai tahap: ASSIGNED→detail, ACCEPTED_BY_DRIVER→cek
  // armada, selain itu→tracking.
  const openTask = (task: DriverTask) => {
    if (task.status === 'ASSIGNED') {
      goScreen('detail', task);
    } else if (driverNeedsInspection(task.status)) {
      goScreen('inspection', task);
    } else {
      goScreen('tracking', task);
    }
  };

  const handleAccept = (task: DriverTask) => {
    if (task.status === 'ASSIGNED') {
      // Terima → tampilkan layar diterima dulu; cek armada dimulai dari tombol berikutnya.
      advance.mutate({ task, status: 'ACCEPTED_BY_DRIVER', after: 'accepted' });
      return;
    }
    openTask(task);
  };

  const handleReject = async (task: DriverTask) => {
    const ok = await confirm({
      title: 'Tolak order ini?',
      message: 'Order dikembalikan ke admin mitra untuk ditugaskan ke sopir lain.',
      confirmText: 'Tolak',
      tone: 'danger',
    });
    if (!ok) return;
    const note = window.prompt('Alasan menolak (boleh dikosongkan):') ?? '';
    reject.mutate({ code: task.orderCode, note });
  };

  const handleAdvanceTracking = (task: DriverTask) => {
    const next = driverNextStatus(task.status);
    if (!next) return;
    // Menandai tiba wajib disertai foto serah-terima — backend menolak tanpa
    // itu, jadi sopir diarahkan ke layar kamera lebih dulu.
    if (next === 'DROPPED_OFF') {
      goScreen('dropoffProof', task);
      return;
    }
    advance.mutate({ task, status: next, after: 'tracking' });
  };

  const handleDropoffProofDone = async (task: DriverTask, front: string, rear: string) => {
    await advance.mutateAsync({
      task,
      status: 'DROPPED_OFF',
      after: 'tracking',
      proof: { front, rear },
    });
  };

  const handleTabChange = (nextTab: DriverTab) => {
    if (nextTab === tab && screen.kind === 'tabs') return;
    goTab(nextTab);
  };

  const handleLogout = async () => {
    const ok = await confirm({
      title: 'Keluar akun sopir',
      message: 'Anda akan kembali ke portal login DRIVE.',
      confirmText: 'Keluar',
      tone: 'danger',
    });
    if (!ok) return;
    logout();
    navigate(ROUTES.loginSopir, { replace: true });
  };

  if (isLoading) {
    return (
      <PageContainer className={PAGE_BG}>
        <LoadingState label="Memuat portal sopir..." />
      </PageContainer>
    );
  }

  if (isError) {
    return (
      <PageContainer className={PAGE_BG}>
        <AppHeader title="Portal Sopir" showBack={false} />
        <ErrorState onRetry={() => void refetch()} />
      </PageContainer>
    );
  }

  if (screen.kind === 'detail' && selectedTask) {
    return (
      <OrderDetailScreen
        task={selectedTask}
        isUpdating={advance.isPending || reject.isPending}
        onBack={goBack}
        onAccept={() => handleAccept(selectedTask)}
        onReject={() => handleReject(selectedTask)}
        onTrack={() => openTask(selectedTask)}
      />
    );
  }

  if (screen.kind === 'accepted' && selectedTask) {
    return (
      <AcceptedOrderScreen
        task={selectedTask}
        onBack={goBack}
        onStart={() => goScreen('inspection', selectedTask, true)}
      />
    );
  }

  if (screen.kind === 'dropoffProof' && selectedTask) {
    return (
      <DropoffProof
        task={selectedTask}
        onBack={goBack}
        onDone={(front, rear) => handleDropoffProofDone(selectedTask, front, rear)}
      />
    );
  }

  if (screen.kind === 'inspection' && selectedTask) {
    return (
      <FleetInspection
        task={selectedTask}
        onBack={goBack}
        onDone={(verdict) => {
          void queryClient.invalidateQueries({ queryKey: ['driver-tasks'] });
          if (verdict === 'FIT') {
            advance.mutate({ task: selectedTask, status: 'EN_ROUTE_TO_PICKUP', after: 'tracking' });
          } else {
            goTab('orders', true);
          }
        }}
      />
    );
  }

  if (screen.kind === 'tracking' && selectedTask) {
    return (
      <TrackingOrderScreen
        task={selectedTask}
        isUpdating={advance.isPending}
        onBack={goBack}
        onAdvance={() => handleAdvanceTracking(selectedTask)}
        onTabChange={handleTabChange}
      />
    );
  }

  if (screen.kind === 'biodata') {
    return (
      <BiodataScreen
        name={name}
        tasks={data}
        activeTask={currentTask}
        profile={profile ?? null}
        onEdit={() => goScreen('editProfile')}
        onBack={goBack}
      />
    );
  }

  if (screen.kind === 'editProfile') {
    return (
      <EditProfileScreen
        key={profile ? `profile-${profile.id}` : 'profile-loading'}
        profile={profile ?? null}
        onBack={goBack}
        onSaved={() => {
          void queryClient.invalidateQueries({ queryKey: ['driver-profile'] });
          goBack();
        }}
      />
    );
  }

  if (screen.kind === 'changePassword') {
    return <ChangePasswordScreen onBack={goBack} />;
  }

  return (
    <PageContainer className={PAGE_BG}>
      {tab === 'home' && (
        <DriverHome
          name={name}
          tasks={data}
          activeTasks={activeTasks}
          finishedTasks={finishedTasks}
          profile={profile ?? null}
          onOpenOrders={() => handleTabChange('orders')}
          onOpenHistory={() => handleTabChange('history')}
          onOpenBiodata={() => goScreen('biodata')}
          onOpenDetail={(task) => goScreen('detail', task)}
        />
      )}
      {tab === 'orders' && (
        <DriverOrders
          tasks={data}
          activeTasks={activeTasks}
          finishedCount={finishedTasks.length}
          isUpdating={advance.isPending || reject.isPending}
          profile={profile ?? null}
          isTogglingAvailability={availability.isPending}
          onToggleAvailability={(status) => availability.mutate(status)}
          onOpenDetail={(task) => goScreen('detail', task)}
          onAccept={(task) => handleAccept(task)}
          onTrack={openTask}
          onBack={() => handleTabChange('home')}
        />
      )}
      {tab === 'history' && <DriverHistory tasks={data} onBack={() => handleTabChange('home')} />}
      {tab === 'account' && (
        <DriverAccount
          name={name}
          tasks={data}
          activeTask={currentTask}
          profile={profile ?? null}
          onOpenBiodata={() => goScreen('biodata')}
          onOpenEditProfile={() => goScreen('editProfile')}
          onOpenChangePassword={() => goScreen('changePassword')}
          onLogout={handleLogout}
          onBack={() => handleTabChange('home')}
        />
      )}
      <DriverBottomNav active={tab} onChange={handleTabChange} />
    </PageContainer>
  );
}

function DriverHome({
  name,
  tasks,
  activeTasks,
  finishedTasks,
  profile,
  onOpenOrders,
  onOpenHistory,
  onOpenBiodata,
  onOpenDetail,
}: {
  name: string;
  tasks: DriverTask[];
  activeTasks: DriverTask[];
  finishedTasks: DriverTask[];
  profile: DriverProfile | null;
  onOpenOrders: () => void;
  onOpenHistory: () => void;
  onOpenBiodata: () => void;
  onOpenDetail: (task: DriverTask) => void;
}) {
  const displayName = profile?.fullname || name || 'Sopir Towing';
  const assignedTasks = activeTasks.filter((task) => task.status === 'ASSIGNED');
  const serviceName =
    profile?.towingName || tasks.find((task) => task.towingName)?.towingName || 'Mitra Towing';
  const finishedCount = finishedTasks.length;
  const monthlyFinishedCount = finishedInLast30Days(finishedTasks);
  const rating = driverRating();
  const completionPct = tasks.length > 0 ? Math.round((finishedCount / tasks.length) * 100) : 0;

  return (
    <main className="flex flex-1 flex-col bg-neutral-200 pb-20">
      {/* HERO FOTO — perlakuannya sama persis dengan hero beranda user:
          foto full-bleed, peluruhan gradien ke bawah, lalu sapuan hijau merek
          dari kiri atas. Mitra dulu cuma dapat strip gelap. */}
      <section className="relative overflow-hidden text-white">
        <img
          src="/assets/mitra/hero-driver-towing.webp"
          alt=""
          fetchPriority="high"
          className="pointer-events-none absolute inset-0 size-full object-cover object-center"
        />
        {/* Peluruhan ke bawah: foto melebur ke warna halaman, tanpa garis potong. */}
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgba(7,12,17,0.55)_0%,rgba(7,12,17,0.35)_30%,rgba(15,23,32,0.92)_76%,#0f1720_100%)]" />
        {/* Sapuan hijau merek dari kiri atas — sumber cahaya yang sama dengan kartu. */}
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(100%_68%_at_16%_6%,rgba(173,237,31,0.3),transparent_58%)]" />
        <div className="drive-header drive-fade-b pointer-events-none absolute inset-0 opacity-35" />
        {/* `pt-12` menyamakan jarak dari tepi atas dengan beranda admin derek dan
            bengkel. Sebelumnya `pt-4` — di peramban tidak kentara, tapi di ponsel
            logo berisiko tertimpa bilah status. */}
        <div className="relative z-10 px-4 pt-12 pb-24">
          <div className="flex justify-center">
            <Logo className="[&_img]:h-8" />
          </div>

          <div className="mt-10 flex items-center justify-between gap-4">
            <div className="flex min-w-0 items-center gap-3">
              {profile?.photoUrl ? (
                <img
                  src={profile.photoUrl}
                  alt={displayName}
                  className="size-11 shrink-0 rounded-full border-2 border-white object-cover"
                />
              ) : (
                <div className="grid size-11 shrink-0 place-items-center rounded-full bg-neutral-200 text-lg font-semibold text-[#c2f347]">
                  {driverInitial(displayName)}
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-14 truncate leading-tight font-semibold">{displayName}</h1>
                <p className="mt-1 truncate text-[12px] text-white/85">{serviceName}</p>
              </div>
            </div>
            <button
              type="button"
              className="relative grid size-10 shrink-0 place-items-center text-white"
              aria-label="Notifikasi"
            >
              <Bell className="size-6" />
              {assignedTasks.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 grid min-w-5 place-items-center rounded-full bg-[#df3a4f] px-1 text-[12px] font-bold text-white">
                  {assignedTasks.length}
                </span>
              )}
            </button>
          </div>
        </div>
      </section>

      <section className="relative z-10 -mt-14 grid grid-cols-3 gap-3.5 px-5">
        <HomeMenuCard
          icon={UserRound}
          tint="bg-deep-blue-50 text-deep-blue-600"
          label="Data Sopir Towing"
          onClick={onOpenBiodata}
        />
        <HomeMenuCard
          icon={PackageCheck}
          tint="bg-green-cust/15 text-green-cust"
          label="Order"
          onClick={onOpenOrders}
        />
        <HomeMenuCard
          icon={FileText}
          tint="bg-warning/15 text-warning"
          label="Laporan Sopir Towing"
          onClick={onOpenHistory}
        />
      </section>

      <section className="flex flex-col gap-4 px-[26px] pt-5">
        <h2 className="text-12 font-semibold text-neutral-900">Info Orderan</h2>

        {assignedTasks.length > 0 ? (
          <div className="overflow-hidden bg-transparent">
            {assignedTasks.map((task) => (
              <HomeOrderRow key={task.orderCode} task={task} onOpen={() => onOpenDetail(task)} />
            ))}
          </div>
        ) : (
          <EmptyDriverPanel
            icon={<Truck className="size-7" />}
            title="Belum ada order aktif"
            description="Order baru akan muncul otomatis saat admin mitra menugaskan Anda."
          />
        )}

        <div className="relative min-h-[110px] overflow-hidden rounded-2xl bg-[#131c24] p-4">
          <div className="relative z-10 max-w-[62%]">
            <div className="flex items-center gap-0.5">
              {[0, 1, 2, 3, 4].map((value) => (
                <Star key={value} className="size-4 fill-[#e7bd6a] text-[#e7bd6a]" />
              ))}
              <span className="text-14 ml-2 font-bold text-neutral-900">{rating}</span>
            </div>
            <p className="mt-2 text-[12px] whitespace-nowrap text-[#eef4f8]">
              Telah mengantar {monthlyFinishedCount} kali dalam 1 bulan
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-neutral-200">
              <div
                className="h-full rounded-full bg-[#aded1f]"
                style={{ width: `${completionPct}%` }}
              />
            </div>
          </div>
          <img
            src="/assets/driver/rating-worker.svg"
            alt=""
            className="pointer-events-none absolute right-0 bottom-0 h-full w-auto max-w-none object-contain"
          />
        </div>
      </section>
    </main>
  );
}

/** Judul & pill kartu status berdasarkan status sopir yang sebenarnya. */
function availabilityCopy(status: string): { title: string; pill: string; dot: string } {
  if (status === 'BUSY') {
    return { title: 'Sedang Bertugas', pill: 'Sedang mengerjakan order', dot: '#dfa73a' };
  }
  if (status === 'OFFLINE') {
    return { title: 'Sedang Offline', pill: 'Tidak menerima order', dot: '#223039' };
  }
  return { title: 'Sopir Towing Aktif', pill: 'Online & Siap Melayani', dot: '#3adf58' };
}

function DriverOrders({
  tasks,
  activeTasks,
  finishedCount,
  isUpdating,
  profile,
  isTogglingAvailability,
  onToggleAvailability,
  onOpenDetail,
  onAccept,
  onTrack,
  onBack,
}: {
  tasks: DriverTask[];
  activeTasks: DriverTask[];
  finishedCount: number;
  isUpdating: boolean;
  profile: DriverProfile | null;
  isTogglingAvailability: boolean;
  onToggleAvailability: (status: 'AVAILABLE' | 'OFFLINE') => void;
  onOpenDetail: (task: DriverTask) => void;
  onAccept: (task: DriverTask) => void;
  onTrack: (task: DriverTask) => void;
  onBack: () => void;
}) {
  const assigned = activeTasks.filter((task) => task.status === 'ASSIGNED');
  const ongoing = activeTasks.filter((task) => task.status !== 'ASSIGNED');
  const rating = driverRating();
  const driverStatus = profile?.status || 'AVAILABLE';
  const copy = availabilityCopy(driverStatus);
  const busy = driverStatus === 'BUSY';
  const online = driverStatus === 'AVAILABLE';

  return (
    <>
      <AppHeader showLogo onBack={onBack} />
      <main className="flex flex-1 flex-col gap-4 px-4 pt-4 pb-24">
        <section className="relative min-h-[120px] overflow-hidden rounded-xl bg-linear-to-br from-[#c2f347] to-[#83bd04] p-4 text-on-brand shadow-sm">
          <div className="relative z-10">
            <p className="text-[12px] font-semibold tracking-wide text-on-brand/70 uppercase">
              Status Driver
            </p>
            <h1 className="mt-1 text-[20px] leading-tight font-medium">{copy.title}</h1>
            <span className="text-12 mt-3 inline-flex items-center gap-2 rounded-full bg-on-brand/12 px-3 py-1.5 font-medium">
              <span className="size-2 rounded-full" style={{ backgroundColor: copy.dot }} />
              {copy.pill}
            </span>
          </div>
          {/* Saklar Online/Offline milik sopir; terkunci saat BUSY (milik sistem). */}
          <button
            type="button"
            role="switch"
            aria-checked={online}
            aria-label={online ? 'Set offline' : 'Set online'}
            disabled={busy || isTogglingAvailability}
            onClick={() => onToggleAvailability(online ? 'OFFLINE' : 'AVAILABLE')}
            className={cn(
              'absolute top-3.5 right-3.5 z-10 flex h-7 w-12 items-center rounded-full px-1 transition-colors disabled:opacity-50',
              online || busy ? 'bg-[#3adf6e]' : 'bg-white/30',
            )}
          >
            <span
              className={cn(
                'size-5 rounded-full bg-neutral-200 shadow transition-transform',
                (online || busy) && 'translate-x-5',
              )}
            />
          </button>
          <Truck className="absolute right-4 bottom-3 size-24 text-white/20" />
        </section>

        <section className="drive-card grid grid-cols-3 divide-x divide-[#223039]/30 rounded-xl border border-[#223039]/30 p-3 text-center">
          <OrderStat value={String(finishedCount)} label="Selesai" />
          <OrderStat value={rating} label="Rating" />
          <OrderStat value={`${kmEstimate(tasks)}`} label="KM Total" />
        </section>

        <div className="flex items-center justify-between">
          <h2 className="text-18 font-medium text-neutral-900">Permintaan Masuk</h2>
          <button type="button" className="text-12 font-semibold text-[#c2f347]">
            Lihat Semua
          </button>
        </div>

        {assigned.length > 0 && (
          <div className="flex flex-col gap-3">
            {assigned.map((task) => (
              <IncomingOrderCard
                key={task.orderCode}
                task={task}
                isUpdating={isUpdating}
                onDetail={() => onOpenDetail(task)}
                onAccept={() => onAccept(task)}
              />
            ))}
          </div>
        )}

        {ongoing.length > 0 && (
          <section className="flex flex-col gap-3">
            <h2 className="text-16 font-semibold text-neutral-900">Sedang Dikerjakan</h2>
            {ongoing.map((task) => (
              <OngoingOrderCard key={task.orderCode} task={task} onTrack={() => onTrack(task)} />
            ))}
          </section>
        )}

        {activeTasks.length === 0 && (
          <EmptyState
            icon={<ClipboardList className="size-7" />}
            title="Belum ada order"
            description="Order towing baru akan muncul otomatis saat ditugaskan ke akun Anda."
          />
        )}

        <SafetyTip />

        <FloatingSupport />
      </main>
    </>
  );
}

function DriverHistory({ tasks, onBack }: { tasks: DriverTask[]; onBack: () => void }) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'done' | 'canceled' | 'progress'>('done');

  const filtered = useMemo(() => {
    const keyword = query.trim().toLowerCase();
    return tasks.filter((task) => {
      const matchesFilter =
        filter === 'done'
          ? isDriverTaskFinished(task.status)
          : filter === 'canceled'
            ? isDriverTaskCanceled(task.status)
            : ACTIVE_STATUSES.has(task.status);
      if (!matchesFilter) return false;
      if (!keyword) return true;
      return [
        task.orderCode,
        driverTaskPlate(task),
        task.pickupAddress,
        driverDestinationLabel(task),
        formatDateTime(taskTime(task)),
      ]
        .join(' ')
        .toLowerCase()
        .includes(keyword);
    });
  }, [filter, query, tasks]);

  return (
    <>
      <AppHeader showLogo onBack={onBack} />
      <main className="flex flex-1 flex-col gap-4 px-4 pt-4 pb-24">
        <label className="flex h-12 items-center gap-3 rounded-xl border border-[#223039] bg-transparent px-3">
          <Search className="size-5 text-[#aebbc4]" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari plat nomor atau tanggal..."
            className="text-12 min-w-0 flex-1 bg-transparent text-neutral-900 outline-none placeholder:text-[#aebbc4]"
          />
        </label>

        <div className="flex gap-2">
          <HistoryFilter
            active={filter === 'done'}
            label="Selesai"
            onClick={() => setFilter('done')}
          />
          <HistoryFilter
            active={filter === 'canceled'}
            label="Dibatalkan"
            onClick={() => setFilter('canceled')}
          />
          <HistoryFilter
            active={filter === 'progress'}
            label="Dalam Proses"
            onClick={() => setFilter('progress')}
          />
        </div>

        {filtered.length === 0 ? (
          <EmptyDriverPanel
            icon={<History className="size-7" />}
            title="Riwayat kosong"
            description="Riwayat sesuai filter akan muncul di sini."
          />
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((task) => (
              <HistoryCard key={task.orderCode} task={task} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}

function DriverAccount({
  name,
  tasks,
  activeTask,
  profile,
  onOpenBiodata,
  onOpenEditProfile,
  onOpenChangePassword,
  onLogout,
  onBack,
}: {
  name: string;
  tasks: DriverTask[];
  activeTask: DriverTask | null;
  profile: DriverProfile | null;
  onOpenBiodata: () => void;
  onOpenEditProfile: () => void;
  onOpenChangePassword: () => void;
  onLogout: () => void;
  onBack: () => void;
}) {
  const displayName = profile?.fullname || name || 'Sopir Towing';
  const finished = tasks.filter((task) => isDriverTaskFinished(task.status));
  const total = tasks.length;
  const finishedPct = total > 0 ? Math.round((finished.length / total) * 100) : 0;
  const rating = driverRating();

  return (
    <>
      <AppHeader showLogo onBack={onBack} />
      <main className="flex flex-1 flex-col gap-4 px-4 pt-7 pb-24">
        <section className="flex flex-col items-center text-center">
          <div className="relative">
            {profile?.photoUrl ? (
              <img
                src={profile.photoUrl}
                alt={displayName}
                className="size-26 rounded-xl object-cover shadow-sm"
              />
            ) : (
              <div className="grid size-22 place-items-center rounded-xl bg-[#aded1f] text-on-brand text-3xl font-semibold shadow-sm">
                {driverInitial(displayName)}
              </div>
            )}
            <span className="absolute -right-2 -bottom-2 grid size-8 place-items-center rounded-full bg-neutral-200 text-[#c2f347] shadow-md">
              <BadgeCheck className="size-5" />
            </span>
          </div>
          <h1 className="mt-4 text-[18px] leading-tight font-semibold text-neutral-900">
            {displayName}
          </h1>
          <p className="text-12 mt-1 flex items-center gap-1 font-medium text-[#aebbc4]">
            <Star className="size-4 fill-[#e7bd6a] text-[#e7bd6a]" />
            {rating} Rating
          </p>
        </section>

        <section className="grid grid-cols-3 gap-3">
          <ProfileStat value={String(finished.length)} label="Total Trip" />
          <ProfileStat value={`${kmEstimate(tasks)} KM`} label="Jarak Tempuh" />
          <ProfileStat value={`${finishedPct}%`} label="Selesai" />
        </section>

        <Card className={DRIVER_CARD}>
          <div className="flex items-center justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-[#aded1f] text-on-brand">
                <Truck className="size-6" />
              </span>
              <div className="min-w-0">
                <p className="text-14 truncate font-medium text-neutral-900">
                  {activeTask ? activeTask.fleetType || 'Towing' : 'Armada Bertugas'}
                </p>
                <p className="text-12 text-neutral-600">
                  Plat Nomor:{' '}
                  <span className="font-medium text-[#c2f347]">
                    {activeTask?.fleetPlateNumber || '-'}
                  </span>
                </p>
              </div>
            </div>
            <span
              className={cn(
                'text-11 rounded-full px-3 py-1 font-bold whitespace-nowrap',
                activeTask ? 'bg-[#131c24] text-[#6ae795]' : 'bg-[#131c24] text-neutral-500',
              )}
            >
              {activeTask ? 'Bertugas' : 'Standby'}
            </span>
          </div>
        </Card>

        <section>
          <p className="mb-3 text-[12px] font-bold tracking-wide text-[#aebbc4] uppercase">
            Akun Saya
          </p>
          <div className="drive-card overflow-hidden rounded-xl border border-[#223039]/30">
            <AccountMenuItem
              icon={<UserPen className="size-5" />}
              label="Ubah Profil"
              onClick={onOpenEditProfile}
            />
            <AccountMenuItem
              icon={<FileText className="size-5" />}
              label="Dokumen & Izin"
              onClick={onOpenBiodata}
            />
            <AccountMenuItem
              icon={<KeyRound className="size-5" />}
              label="Ganti Kata Sandi"
              onClick={onOpenChangePassword}
            />
            <AccountMenuItem
              icon={<CircleHelp className="size-5" />}
              label="Pusat Bantuan"
              onClick={() => toast.info('Nomor bantuan belum tersedia')}
            />
            <AccountMenuItem
              icon={<LogOut className="size-5" />}
              label="Keluar"
              tone="danger"
              onClick={onLogout}
            />
          </div>
        </section>
      </main>
    </>
  );
}

function OrderDetailScreen({
  task,
  isUpdating,
  onBack,
  onAccept,
  onReject,
  onTrack,
}: {
  task: DriverTask;
  isUpdating: boolean;
  onBack: () => void;
  onAccept: () => void;
  onReject: () => void;
  onTrack: () => void;
}) {
  const isAssigned = task.status === 'ASSIGNED';
  const needsInspection = driverNeedsInspection(task.status);
  const plate = driverTaskPlate(task);

  return (
    <PageContainer className={PAGE_BG}>
      <AppHeader showLogo onBack={onBack} />
      <main className="flex flex-1 flex-col gap-4 px-4 py-6 pb-28">
        <Card className={DRIVER_CARD}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <OrderKindBadge task={task} />
              <h1 className="text-16 mt-3 truncate font-medium text-neutral-900">
                {task.userFullname || taskVehicleTitle(task)}
              </h1>
              <p className="text-14 mt-1 font-medium tracking-[0.2em] text-[#aebbc4] uppercase">
                {plate === '-' ? task.orderCode : plate}
              </p>
            </div>
            <CarFront className="mt-1 size-6 shrink-0 text-[#c2f347]" />
          </div>
          <div className="my-4 h-px bg-neutral-200" />
          <p className="text-13 flex items-start gap-2 text-neutral-800">
            <span className="mt-1.5 size-2 shrink-0 rounded-full bg-[#df463a]" />
            <span>
              <b>Masalah:</b> {driverTaskProblem(task)}
            </span>
          </p>
        </Card>

        <Card className={DRIVER_CARD}>
          <p className="text-12 font-medium text-[#aebbc4] uppercase">Rute Pengiriman</p>
          <DetailRouteLine task={task} />
        </Card>

        <Card className={DRIVER_CARD}>
          <div className="flex items-center justify-between gap-3">
            <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#131c24] text-neutral-600">
              <UserRound className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-11 font-medium text-[#aebbc4]">Pelanggan</p>
              <p className="text-14 truncate font-medium text-neutral-900">
                {task.userFullname || '-'}
              </p>
            </div>
            {task.userPhone && (
              <a
                href={`tel:${task.userPhone}`}
                className="ml-auto grid size-10 shrink-0 place-items-center rounded-full border border-[#aded1f] text-[#c2f347]"
                aria-label="Telepon customer"
              >
                <Phone className="size-5" />
              </a>
            )}
          </div>
        </Card>

        <div className="flex items-center justify-between rounded-xl bg-[#131c24] p-4">
          <p className="text-14 text-[#aebbc4]">Estimasi Pendapatan</p>
          <p className="text-18 font-semibold text-[#c2f347]">
            {formatCurrency(driverTaskRevenue(task))}
          </p>
        </div>

        {isAssigned ? (
          <div className="fixed right-0 bottom-0 left-0 z-40 mx-auto grid w-full max-w-md grid-cols-[46px_1fr] gap-3 border-t border-[#223039] bg-white/95 px-4 py-4 backdrop-blur">
            <Button
              variant="outline"
              className="h-[46px] rounded-xl border-[#2f3f4a] px-0 text-[#aebbc4] hover:bg-[#131c24]"
              disabled={isUpdating}
              onClick={onReject}
              aria-label="Tolak order"
            >
              <X className="size-5" />
            </Button>
            <Button
              className="h-[46px] rounded-lg bg-[#aded1f] font-medium"
              isLoading={isUpdating}
              onClick={onAccept}
            >
              Konfirmasi Terima
            </Button>
          </div>
        ) : (
          <div className="mt-auto grid grid-cols-[56px_1fr] gap-3">
            <Button
              variant="danger"
              className="h-12 rounded-2xl px-0"
              onClick={onBack}
              aria-label="Tutup"
            >
              <X className="size-5" />
            </Button>
            <Button className="h-12 rounded-2xl" isLoading={isUpdating} onClick={onTrack}>
              {needsInspection ? 'Cek Armada' : 'Buka Tracking'}
            </Button>
          </div>
        )}
      </main>
    </PageContainer>
  );
}

function AcceptedOrderScreen({
  task,
  onBack,
  onStart,
}: {
  task: DriverTask;
  onBack: () => void;
  onStart: () => void;
}) {
  const pickup = pickupPoint(task);
  const destination = destinationPoint(task);
  const markers = routeMarkers(task);
  const km = tripKm(task);
  const plate = driverTaskPlate(task);

  return (
    <PageContainer className={PAGE_BG}>
      <AppHeader showLogo onBack={onBack} />
      <main className="flex flex-1 flex-col gap-4 px-4 pt-12 pb-24">
        <section className="mb-4 flex flex-col items-center text-center">
          <div className="grid size-16 place-items-center rounded-full bg-[#0f1720] text-[#6ae791]">
            <Check className="size-8" />
          </div>
          <h1 className="mt-5 text-[22px] leading-tight font-medium text-neutral-900">
            Pesanan Diterima
          </h1>
          <p className="text-13 mt-1 text-[#aebbc4]">
            Permintaan derek telah berhasil dikonfirmasi.
          </p>
        </section>

        <Card className={DRIVER_CARD}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-12 text-[#aebbc4]">Estimasi Pendapatan</p>
              <p className="mt-1 text-[20px] font-semibold text-[#c2f347]">
                {formatCurrency(driverTaskRevenue(task))}
              </p>
            </div>
            <span className="grid size-11 place-items-center rounded-xl bg-[#131c24] text-[#c2f347]">
              <Wallet className="size-5" />
            </span>
          </div>
        </Card>

        <Card className={DRIVER_CARD}>
          <p className="text-[12px] font-medium text-[#aebbc4] uppercase">Kendaraan</p>
          <h2 className="text-16 mt-2 font-medium text-neutral-900">
            {task.userFullname || taskVehicleTitle(task)}
          </h2>
          <span className="text-12 mt-2 inline-flex rounded-lg bg-[#131c24] px-3 py-1 font-bold tracking-[0.2em] text-neutral-600 uppercase">
            {plate === '-' ? task.orderCode : plate}
          </span>
          <p className="text-13 mt-3 flex items-center gap-2 font-medium text-[#e7736a]">
            <span className="size-2 rounded-full bg-[#df463a]" />
            {driverTaskProblem(task)}
          </p>
        </Card>

        <Card className={DRIVER_CARD}>
          <TimelinePoint
            title="Titik Jemput"
            text={task.pickupAddress || '-'}
            tone="indigo"
            showLine
          />
          <TimelinePoint title="Tujuan Antar" text={driverDestinationLabel(task)} tone="outline" />
        </Card>

        {markers.length > 0 && (
          <div className="relative overflow-hidden rounded-xl border border-[#223039]">
            <MapView
              center={pickup ?? destination ?? DEFAULT_MAP_POINT}
              markers={markers}
              polyline={pickup && destination ? [pickup, destination] : undefined}
              fitToMarkers={markers.length > 1}
              className="h-40 rounded-xl"
            />
            {km !== null && (
              <span className="text-12 absolute bottom-3 left-3 z-[500] rounded-full bg-neutral-200 px-3 py-1.5 font-bold text-neutral-900 shadow">
                {km.toFixed(1)} KM • {tripEtaMnt(km)} Menit
              </span>
            )}
          </div>
        )}

        <div className="fixed right-0 bottom-0 left-0 z-40 mx-auto grid w-full max-w-md grid-cols-[1fr_86px] gap-4 border-t border-[#223039] bg-white/95 px-4 py-4 backdrop-blur">
          <Button
            className="h-[46px] rounded-lg bg-[#aded1f] font-medium"
            onClick={onStart}
            leftIcon={<Navigation className="size-5" />}
          >
            Mulai Perjalanan
          </Button>
          {task.userPhone && (
            <a
              href={`tel:${task.userPhone}`}
              className="drive-card grid h-[46px] place-items-center rounded-xl border border-[#223039] text-[#c2f347]"
              aria-label="Telepon customer"
            >
              <Phone className="size-5" />
            </a>
          )}
        </div>
      </main>
    </PageContainer>
  );
}

function TrackingOrderScreen({
  task,
  isUpdating,
  onBack,
  onAdvance,
  onTabChange,
}: {
  task: DriverTask;
  isUpdating: boolean;
  onBack: () => void;
  onAdvance: () => void;
  onTabChange: (tab: DriverTab) => void;
}) {
  useEffect(() => {
    if (!('geolocation' in navigator)) return undefined;
    let lastSent = 0;
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const now = Date.now();
        if (now - lastSent < 10_000) return;
        lastSent = now;
        void updateDriverLocation(position.coords.latitude, position.coords.longitude).catch(
          () => undefined,
        );
      },
      () => undefined,
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 10_000 },
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [task.orderCode]);

  const pickup = pickupPoint(task);
  const destination = destinationPoint(task);
  const markers = routeMarkers(task);
  const next = driverNextStatus(task.status);
  const plate = driverTaskPlate(task);

  return (
    <PageContainer className="bg-neutral-200">
      <AppHeader showLogo onBack={onBack} />
      <div className="relative h-[42dvh] min-h-[348px] shrink-0 overflow-hidden bg-[#0f1720] [&_.leaflet-control-zoom]:hidden">
        <MapView
          center={pickup ?? destination ?? DEFAULT_MAP_POINT}
          markers={markers}
          polyline={pickup && destination ? [pickup, destination] : undefined}
          fitToMarkers={markers.length > 1}
          className="h-full rounded-none"
        />
        <div className="absolute inset-x-5 top-4 z-[500] flex items-center justify-between gap-3 rounded-full bg-neutral-200 px-5 py-3 shadow-md">
          <span className="text-12 flex min-w-0 items-center gap-3 font-medium text-[#c2f347]">
            <Truck className="size-4 shrink-0" />
            <span className="truncate">{driverStatusLabel(task.status)}</span>
          </span>
          {tripEtaLabel(task) !== '-' && (
            <>
              <span className="h-4 w-px shrink-0 bg-neutral-200" />
              <span className="text-12 whitespace-nowrap text-[#eef4f8]">
                {tripEtaLabel(task)} lagi
              </span>
            </>
          )}
        </div>
      </div>

      <main className="-mt-6 flex flex-1 flex-col gap-4 rounded-t-[28px] bg-neutral-200 px-4 pt-5 pb-24 shadow-[0_-12px_28px_rgb(31_48_91_/_0.10)]">
        <div className="mx-auto h-1.5 w-12 rounded-full bg-neutral-300" />
        <div className="flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <div className="text-16 grid size-12 shrink-0 place-items-center rounded-full bg-[#131c24] font-bold text-[#c2f347]">
              {driverInitial(task.userFullname || 'Pelanggan')}
            </div>
            <div className="min-w-0">
              <h1 className="text-16 truncate font-medium text-neutral-900">
                {task.userFullname || '-'}
              </h1>
              <p className="text-12 truncate text-[#aebbc4]">
                {plate === '-' ? task.orderCode : plate}
              </p>
            </div>
          </div>
          {task.userPhone && (
            <a
              href={`tel:${task.userPhone}`}
              className="text-12 flex h-10 shrink-0 items-center gap-2 rounded-full border border-[#aded1f] px-3 font-semibold text-[#c2f347]"
              aria-label="Telepon customer"
            >
              <Phone className="size-4" />
              Hubungi
            </a>
          )}
        </div>

        <p className="text-12 font-medium text-[#aebbc4] uppercase">Order Progress</p>
        <DriverProgress status={task.status} />

        {next ? (
          <Button
            className="mt-auto h-12 rounded-lg bg-[#aded1f] font-medium"
            isLoading={isUpdating}
            onClick={onAdvance}
          >
            {driverNextActionLabel(task.status)}
          </Button>
        ) : task.claimNumber ? (
          <DriverSettlementBox task={task} />
        ) : (
          <div className="text-14 mt-auto rounded-2xl bg-[#131c24] p-4 text-center font-semibold text-[#6ae78b]">
            Tugas drop-off selesai
          </div>
        )}
      </main>
      <DriverBottomNav active="orders" onChange={onTabChange} />
    </PageContainer>
  );
}

function DriverSettlementBox({ task }: { task: DriverTask }) {
  const queryClient = useQueryClient();
  const [code, setCode] = useState(task.orderCode);

  useEffect(() => {
    setCode(task.orderCode);
  }, [task.orderCode]);

  const scan = useMutation({
    mutationFn: () => scanDriverSettlementCode(code.trim()),
    onSuccess: () => {
      toast.success('Tiket klaim valid.');
    },
    onError: (error) => toast.error(extractErrorMessage(error, 'Tiket klaim tidak valid.')),
  });

  const settle = useMutation({
    mutationFn: () => settleDriverSettlementCode(code.trim()),
    onSuccess: (flag) => {
      void queryClient.invalidateQueries({ queryKey: ['driver-tasks'] });
      if (flag.status === 'SETTLED') {
        toast.success('Tiket klaim towing selesai.');
      } else if (flag.status === 'AWAITING_PAYMENT') {
        toast.success('Tiket tervalidasi. Menunggu pembayaran user.');
      } else {
        toast.success('Tiket klaim diperbarui.');
      }
    },
    onError: (error) => toast.error(extractErrorMessage(error, 'Tiket klaim gagal diselesaikan.')),
  });

  const disabled = code.trim().length === 0 || scan.isPending || settle.isPending;

  return (
    <div className="mt-auto flex flex-col gap-3 rounded-2xl bg-[#131c24] p-4">
      <div>
        <p className="text-12 font-semibold text-neutral-900">Kode tiket klaim</p>
        <p className="text-11 mt-1 text-neutral-600">
          Input kode dari tiket user setelah drop-off selesai.
        </p>
      </div>
      <label className="drive-card flex h-12 items-center rounded-xl border border-neutral-300 px-4">
        <input
          value={code}
          onChange={(event) => setCode(event.target.value.toUpperCase())}
          className="text-14 min-w-0 flex-1 bg-transparent font-semibold tracking-wide text-neutral-900 outline-none placeholder:text-neutral-500"
          placeholder="Masukkan kode tiket"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          className="h-12 rounded-2xl"
          disabled={disabled}
          isLoading={scan.isPending}
          onClick={() => scan.mutate()}
        >
          Scan
        </Button>
        <Button
          className="h-12 rounded-2xl"
          disabled={disabled}
          isLoading={settle.isPending}
          onClick={() => settle.mutate()}
        >
          Selesaikan
        </Button>
      </div>
    </div>
  );
}

/** Format tanggal YYYY-MM-DD ke tampilan id-ID; '-' bila kosong. */
function formatProfileDate(value: string | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).format(date);
}

function BiodataScreen({
  name,
  tasks,
  activeTask,
  profile,
  onEdit,
  onBack,
}: {
  name: string;
  tasks: DriverTask[];
  activeTask: DriverTask | null;
  profile: DriverProfile | null;
  onEdit: () => void;
  onBack: () => void;
}) {
  const displayName = profile?.fullname || name || 'Sopir Towing';
  const serviceName = profile?.towingName || activeTask?.towingName || '-';
  const finishedCount = tasks.filter((task) => isDriverTaskFinished(task.status)).length;
  const rating = driverRating();
  // Sopir tidak terikat kendaraan — armada hanya bermakna saat ada order aktif.
  const vehicleLabel = activeTask
    ? `${activeTask.fleetType || 'Towing'} (${activeTask.fleetPlateNumber || '-'})`
    : '-';

  return (
    <PageContainer className={PAGE_BG}>
      <AppHeader showLogo onBack={onBack} />
      <main className="flex flex-1 flex-col gap-7 bg-neutral-200 px-4 pt-7 pb-8">
        <section className="flex flex-col items-center text-center">
          <div className="relative">
            {profile?.photoUrl ? (
              <img
                src={profile.photoUrl}
                alt={displayName}
                className="size-26 rounded-xl object-cover shadow-sm"
              />
            ) : (
              <div className="grid size-22 place-items-center rounded-xl bg-[#aded1f] text-on-brand text-3xl font-semibold shadow-sm">
                {driverInitial(displayName)}
              </div>
            )}
            <span className="text-12 absolute -right-3 -bottom-2 rounded-full bg-[#df4e3a] px-2.5 py-1 font-bold text-white shadow-sm">
              ★ {rating}
            </span>
          </div>
          <h1 className="mt-5 text-[22px] leading-tight font-medium text-neutral-900">
            {displayName}
          </h1>
          <p className="text-12 mt-1 text-[#aebbc4]">
            Driver ID: {profile ? driverCodeLabel(profile.id) : '-'}
          </p>
          <span
            className={cn(
              'text-12 mt-3 inline-flex items-center gap-2 rounded-full border px-3 py-1 font-semibold',
              profile?.status === 'OFFLINE'
                ? 'border-[#223039]/50 text-[#aebbc4]'
                : profile?.status === 'BUSY'
                  ? 'border-[#dda22c]/40 text-[#e7b66a]'
                  : 'border-[#2cdd69]/30 text-[#6ae795]',
            )}
          >
            <span
              className={cn(
                'size-2 rounded-full',
                profile?.status === 'OFFLINE'
                  ? 'bg-[#223039]'
                  : profile?.status === 'BUSY'
                    ? 'bg-[#dfa73a]'
                    : 'bg-[#3adf72]',
              )}
            />
            {profile?.status === 'OFFLINE'
              ? 'Offline'
              : profile?.status === 'BUSY'
                ? 'Bertugas'
                : 'Aktif'}
          </span>
        </section>

        <Card className={DRIVER_CARD}>
          <SectionIconTitle icon={<UserRound className="size-5" />} title="Informasi Pribadi" />
          <div className="flex h-auto w-full flex-col gap-y-3">
            <InfoRow label="Nomor Telepon" value={profile?.phone || '-'} />
            <InfoRow label="Email" value={profile?.email || '-'} />
            <InfoRow label="Nomor SIM" value={profile?.licenseNumber || '-'} />
            <InfoRow
              label="Masa Berlaku SIM"
              value={formatProfileDate(profile?.licenseExpiry ?? null)}
            />
            <InfoRow label="Alamat" value={profile?.address || '-'} />
            <InfoRow label="Perusahaan" value={serviceName} />
          </div>
        </Card>

        <Card className={DRIVER_CARD}>
          <SectionIconTitle
            icon={<ChartColumn className="size-[24px]" />}
            title="Status Pekerjaan"
          />
          <div className="flex h-auto w-full flex-col gap-y-4">
            <div className="grid grid-cols-2 gap-3">
              <StatusTile label="Total Perjalanan" value={String(finishedCount)} />
              <StatusTile label="KM Total" value={`${kmEstimate(tasks)}`} />
            </div>
            <div className="flex items-center gap-3 rounded-xl border border-[#223039]/40 bg-[#131c24] p-3">
              <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#aded1f] text-on-brand">
                <Truck className="size-5" />
              </span>
              <div className="min-w-0">
                <p className="text-11 font-medium text-[#aebbc4]">Armada Bertugas</p>
                <p className="text-13 truncate font-medium text-neutral-900">{vehicleLabel}</p>
              </div>
            </div>
          </div>
        </Card>

        <Button
          className="h-12 rounded-lg bg-[#aded1f] font-medium"
          leftIcon={<UserPen className="size-5" />}
          onClick={onEdit}
        >
          Edit Profil
        </Button>

        <section className="flex flex-col gap-3">
          <h2 className="text-18 font-medium text-neutral-900">Dokumen Digital</h2>
          <div className="grid gap-3">
            <DocumentCard title="Foto Diri" url={profile?.photoUrl ?? ''} />
            <DocumentCard title="Foto KTP" url={profile?.ktpImageUrl ?? ''} />
            <DocumentCard title="Scan SIM" url={profile?.simImageUrl ?? ''} />
          </div>
        </section>
      </main>
    </PageContainer>
  );
}

/** Tile unggah dokumen: pilih file → unggah ke storage publik → simpan URL. */
function ProfileUploadTile({
  label,
  url,
  uploading,
  onPick,
}: {
  label: string;
  url: string;
  uploading: boolean;
  onPick: (file: File) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (file) onPick(file);
  };
  return (
    <div className="drive-card rounded-xl border border-[#223039]/40 p-3">
      <p className="text-11 font-medium text-[#aebbc4]">{label}</p>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleChange}
      />
      {url ? (
        <div className="mt-2 flex items-center gap-3">
          <img src={url} alt={label} className="h-14 w-20 rounded-lg object-cover" />
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="text-12 font-semibold text-[#c2f347] disabled:opacity-60"
          >
            {uploading ? 'Mengunggah…' : 'Ganti'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          className="text-12 mt-2 flex h-14 w-full items-center justify-center rounded-lg border-2 border-dashed border-[#223039] font-medium text-[#aebbc4] disabled:opacity-60"
        >
          {uploading ? 'Mengunggah…' : 'Pilih foto'}
        </button>
      )}
    </div>
  );
}

/** Edit profil oleh sopir sendiri (HP, alamat, SIM, dokumen). */
function EditProfileScreen({
  profile,
  onBack,
  onSaved,
}: {
  profile: DriverProfile | null;
  onBack: () => void;
  onSaved: () => void;
}) {
  const [phone, setPhone] = useState(profile?.phone ?? '');
  const [address, setAddress] = useState(profile?.address ?? '');
  const [licenseNumber, setLicenseNumber] = useState(profile?.licenseNumber ?? '');
  const [licenseExpiry, setLicenseExpiry] = useState(profile?.licenseExpiry ?? '');
  const [photoUrl, setPhotoUrl] = useState(profile?.photoUrl ?? '');
  const [ktpImageUrl, setKtpImageUrl] = useState(profile?.ktpImageUrl ?? '');
  const [simImageUrl, setSimImageUrl] = useState(profile?.simImageUrl ?? '');
  const [uploadingKey, setUploadingKey] = useState<'photo' | 'ktp' | 'sim' | null>(null);
  const [saving, setSaving] = useState(false);

  if (!profile) {
    return (
      <PageContainer className={PAGE_BG}>
        <AppHeader title="Edit Profil" onBack={onBack} />
        <LoadingState label="Memuat profil..." />
      </PageContainer>
    );
  }

  const pickAndUpload = async (
    key: 'photo' | 'ktp' | 'sim',
    file: File,
    setter: (url: string) => void,
  ) => {
    setUploadingKey(key);
    try {
      const url = await uploadFilePublic(file, `driver_${key}_${Date.now()}.jpg`);
      setter(url);
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Gagal mengunggah foto.'));
    } finally {
      setUploadingKey(null);
    }
  };

  const handleSave = async () => {
    if (uploadingKey) {
      toast.error('Tunggu unggahan foto selesai dulu.');
      return;
    }
    setSaving(true);
    try {
      await updateDriverProfile({
        phone: phone.trim(),
        address: address.trim(),
        licenseNumber: licenseNumber.trim(),
        licenseExpiry,
        photoUrl,
        ktpImageUrl,
        simImageUrl,
      });
      toast.success('Profil tersimpan.');
      onSaved();
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Gagal menyimpan profil.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer className={PAGE_BG}>
      <AppHeader title="Edit Profil" onBack={onBack} />
      <main className="flex flex-1 flex-col gap-4 px-4 py-5 pb-10">
        <Card className={DRIVER_CARD}>
          <SectionIconTitle icon={<UserRound className="size-5" />} title="Data Kontak" />
          <div className="flex flex-col gap-4">
            <Input
              label="Nomor HP (WhatsApp aktif)"
              value={phone}
              inputMode="tel"
              maxLength={20}
              placeholder="08xxxxxxxxxx"
              onChange={(event) => {
                keepPhone(event);
                setPhone(event.currentTarget.value);
              }}
            />
            <TextArea
              label="Alamat Domisili"
              rows={2}
              value={address}
              placeholder="Alamat tempat tinggal"
              onChange={(event) => setAddress(event.target.value)}
            />
          </div>
        </Card>

        <Card className={DRIVER_CARD}>
          <SectionIconTitle icon={<FileText className="size-5" />} title="Data SIM" />
          <div className="flex flex-col gap-4">
            <Input
              label="Nomor SIM"
              value={licenseNumber}
              inputMode="numeric"
              maxLength={16}
              placeholder="Nomor SIM (angka)"
              onChange={(event) => {
                keepDigits(event);
                setLicenseNumber(event.currentTarget.value);
              }}
            />
            <Input
              label="Masa Berlaku SIM"
              type="date"
              value={licenseExpiry}
              onChange={(event) => setLicenseExpiry(event.target.value)}
            />
          </div>
        </Card>

        <Card className={DRIVER_CARD}>
          <SectionIconTitle icon={<FileText className="size-5" />} title="Dokumen" />
          <div className="flex flex-col gap-3">
            <ProfileUploadTile
              label="Foto Diri"
              url={photoUrl}
              uploading={uploadingKey === 'photo'}
              onPick={(file) => void pickAndUpload('photo', file, setPhotoUrl)}
            />
            <ProfileUploadTile
              label="Foto KTP"
              url={ktpImageUrl}
              uploading={uploadingKey === 'ktp'}
              onPick={(file) => void pickAndUpload('ktp', file, setKtpImageUrl)}
            />
            <ProfileUploadTile
              label="Scan SIM"
              url={simImageUrl}
              uploading={uploadingKey === 'sim'}
              onPick={(file) => void pickAndUpload('sim', file, setSimImageUrl)}
            />
          </div>
        </Card>

        <Button
          className="h-12 rounded-lg bg-[#aded1f] font-medium"
          isLoading={saving}
          onClick={() => void handleSave()}
        >
          Simpan Perubahan
        </Button>
      </main>
    </PageContainer>
  );
}

/** Ganti kata sandi oleh sopir sendiri (wajib tahu kata sandi lama). */
function ChangePasswordScreen({ onBack }: { onBack: () => void }) {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async () => {
    if (!oldPassword) {
      toast.error('Isi kata sandi lama dulu.');
      return;
    }
    if (newPassword.length < 8) {
      toast.error('Kata sandi baru minimal 8 karakter.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Konfirmasi kata sandi tidak sama.');
      return;
    }
    setSaving(true);
    try {
      await changeDriverPassword(oldPassword, newPassword);
      toast.success('Kata sandi berhasil diganti.');
      onBack();
    } catch (error) {
      toast.error(extractErrorMessage(error, 'Gagal mengganti kata sandi.'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageContainer className={PAGE_BG}>
      <AppHeader title="Ganti Kata Sandi" onBack={onBack} />
      <main className="flex flex-1 flex-col gap-4 px-4 py-5">
        <Card className={DRIVER_CARD}>
          <p className="text-12 text-[#aebbc4]">
            Lupa kata sandi lama? Hubungi admin mitra Anda untuk disetel ulang, lalu ganti lagi di
            sini.
          </p>
          <div className="flex flex-col gap-4">
            <Input
              label="Kata Sandi Lama"
              type="password"
              value={oldPassword}
              onChange={(event) => setOldPassword(event.target.value)}
              autoComplete="current-password"
            />
            <Input
              label="Kata Sandi Baru"
              type="password"
              value={newPassword}
              placeholder="Minimal 8 karakter"
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
            />
            <Input
              label="Konfirmasi Kata Sandi Baru"
              type="password"
              value={confirmPassword}
              placeholder="Ulangi kata sandi baru"
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
            />
          </div>
        </Card>
        <Button
          className="h-12 rounded-lg bg-[#aded1f] font-medium"
          isLoading={saving}
          onClick={() => void handleSubmit()}
        >
          Simpan Kata Sandi
        </Button>
      </main>
    </PageContainer>
  );
}

function HomeMenuCard({
  icon: Icon,
  tint,
  label,
  onClick,
}: {
  icon: LucideIcon;
  tint: string;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[108px] flex-col items-center justify-start gap-2.5 rounded-[18px] bg-neutral-200 px-2 py-4 text-center shadow-[0_14px_28px_rgb(0_0_0_/_0.35)]"
    >
      <span className={cn('grid size-12 place-items-center rounded-xl', tint)}>
        <Icon className="size-6" />
      </span>
      {/* Tinggi dua baris dipesan di muka: tanpa ini label satu kata seperti
          "Order" membuat kartunya lebih pendek dan ikonnya tidak sebaris
          dengan kartu di kiri-kanannya. */}
      <span className="text-12 flex min-h-[2.6em] items-start justify-center leading-tight font-normal text-[#aebbc4]">
        {label}
      </span>
    </button>
  );
}

function HomeOrderRow({ task, onOpen }: { task: DriverTask; onOpen: () => void }) {
  return (
    <div className="flex min-h-[68px] items-center gap-3 border-b border-[#223039]/40 py-2.5 last:border-0">
      <img
        src="/assets/driver/row-truck.png"
        alt=""
        className="h-14 w-[72px] shrink-0 object-contain"
      />
      <div className="min-w-0 flex-1">
        <h3 className="text-13 truncate font-semibold text-neutral-900">
          {taskVehicleTitle(task)}
        </h3>
        <p className="text-11 mt-1 truncate text-[#eef4f8]">{task.pickupAddress || '-'}</p>
      </div>
      <button
        type="button"
        onClick={onOpen}
        className="text-11 h-9 w-[104px] shrink-0 rounded-[10px] bg-[#df4e3a] px-0 font-semibold text-white"
      >
        Terima orderan
      </button>
    </div>
  );
}

function OrderKindBadge({ task }: { task: DriverTask }) {
  const isClaim = task.claimNumber.length > 0;
  return (
    <span
      className={cn(
        'inline-flex rounded-full px-3 py-1 text-[10px] font-semibold tracking-wide',
        isClaim ? 'bg-[#131c24] text-[#c2f347]' : 'bg-[#131c24] text-neutral-600',
      )}
    >
      {orderKindLabel(task)}
    </span>
  );
}

function OrderInfoRow({
  icon,
  label,
  value,
  sideLabel,
  sideValue,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  sideLabel: string;
  sideValue: string;
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 shrink-0 text-neutral-400">{icon}</span>
        <div className="min-w-0">
          <p className="text-11 text-[#aebbc4]">{label}</p>
          <p className="text-12 mt-0.5 truncate font-medium text-neutral-900">{value || '-'}</p>
        </div>
      </div>
      <div className="shrink-0 text-right">
        <p className="text-11 text-[#eef4f8]">{sideLabel}</p>
        <p className="text-12 mt-0.5 font-semibold text-[#c2f347]">{sideValue}</p>
      </div>
    </div>
  );
}

function DetailRouteLine({ task }: { task: DriverTask }) {
  return (
    <div className="flex flex-col gap-4">
      <DetailRoutePoint
        icon={<MapPin className="size-4" />}
        title="Lokasi Penjemputan"
        text={task.pickupAddress || '-'}
        subText={taskAddressExcerpt(task.pickupAddress)}
        tone="red"
      />
      <DetailRoutePoint
        icon={<Flag className="size-4" />}
        title="Tujuan"
        text={driverDestinationLabel(task)}
        subText={taskAddressExcerpt(task.dropoffAddress || driverDestinationLabel(task))}
        tone="blue"
      />
    </div>
  );
}

function DetailRoutePoint({
  icon,
  title,
  text,
  subText,
  tone,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  subText: string;
  tone: 'red' | 'blue';
}) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-full text-white',
          tone === 'red' ? 'bg-[#df4e3a]' : 'bg-[#aded1f]',
        )}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-11 text-[#aebbc4]">{title}</p>
        <p className="text-13 mt-0.5 font-medium text-neutral-900">{text || '-'}</p>
        {/* Baris detail tambahan hanya bila memang berbeda dari teks utama. */}
        {subText && subText !== text && (
          <p className="text-11 mt-1 truncate text-[#aebbc4]">{subText}</p>
        )}
      </div>
    </div>
  );
}

function TimelinePoint({
  title,
  text,
  tone,
  showLine = false,
}: {
  title: string;
  text: string;
  tone: 'indigo' | 'outline';
  showLine?: boolean;
}) {
  return (
    <div className="grid grid-cols-[18px_1fr] gap-3">
      <div className="flex flex-col items-center">
        <span
          className={cn(
            'mt-1 size-4 rounded-full border-2',
            tone === 'indigo' ? 'border-[#aded1f] bg-[#aded1f]' : 'border-[#aded1f] bg-neutral-200',
          )}
        />
        {showLine && <span className="h-9 border-l border-dashed border-neutral-300" />}
      </div>
      <div className={cn(showLine && 'pb-3')}>
        <p className="text-[12px] font-medium text-[#aebbc4] uppercase">{title}</p>
        <p className="text-13 mt-1 font-medium text-neutral-900">{text || '-'}</p>
      </div>
    </div>
  );
}

function SectionIconTitle({ icon, title }: { icon: ReactNode; title: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[#c2f347]">{icon}</span>
      <h2 className="text-[16px] font-medium text-neutral-900">{title}</h2>
    </div>
  );
}

function StatusTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[#223039]/60 bg-neutral-200 p-3 text-center">
      <p className="text-[12px] text-[#eef4f8] uppercase">{label}</p>
      <p className="text-18 mt-1 font-semibold text-neutral-900">{value}</p>
    </div>
  );
}

function DocumentCard({ title, url }: { title: string; url: string }) {
  const uploaded = url.trim().length > 0;
  const body = (
    <>
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#131c24] text-[#c2f347]">
        <FileText className="size-5" />
      </span>
      <div className="min-w-0 flex-1 text-left">
        <p className="text-14 font-medium text-neutral-900">{title}</p>
        <p className={cn('text-[12px]', uploaded ? 'text-[#6ae795]' : 'text-[#aebbc4]')}>
          {uploaded ? 'Terunggah — ketuk untuk lihat' : 'Belum diunggah'}
        </p>
      </div>
      {uploaded && <ChevronRight className="size-5 shrink-0 text-neutral-400" />}
    </>
  );
  const className = 'drive-card flex items-center gap-3 rounded-xl border border-[#223039]/30 p-4';
  return uploaded ? (
    <a href={url} target="_blank" rel="noreferrer" className={className}>
      {body}
    </a>
  ) : (
    <div className={className}>{body}</div>
  );
}

function IncomingOrderCard({
  task,
  isUpdating,
  onDetail,
  onAccept,
}: {
  task: DriverTask;
  isUpdating: boolean;
  onDetail: () => void;
  onAccept: () => void;
}) {
  return (
    <Card className={DRIVER_CARD}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="grid size-11 shrink-0 place-items-center rounded-xl bg-[#131c24] text-[#c2f347]">
            <CarFront className="size-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-16 truncate font-medium text-[#c2f347]">
              {taskVehicleTitle(task)}
            </h3>
            <p className="text-11 mt-0.5 truncate text-[#eef4f8]">{driverTaskProblem(task)}</p>
          </div>
        </div>
        <OrderKindBadge task={task} />
      </div>

      <div className="my-4 h-px bg-[#223039]/40" />

      <div className="flex flex-col gap-3">
        <OrderInfoRow
          icon={<MapPin className="size-4" />}
          label="Titik Jemput"
          value={task.pickupAddress || '-'}
          sideLabel="Jarak"
          sideValue={tripDistanceLabel(task)}
        />
        <OrderInfoRow
          icon={<Navigation className="size-4" />}
          label="Tujuan"
          value={driverDestinationLabel(task)}
          sideLabel="Waktu"
          sideValue={tripEtaLabel(task)}
        />
      </div>

      <div className="mt-4 grid grid-cols-[40%_1fr] gap-3">
        <Button
          variant="outline"
          className="h-10 rounded-lg border-[#2e4a13] text-[#c2f347]"
          disabled={isUpdating}
          onClick={onDetail}
        >
          Detail
        </Button>
        <Button
          className="h-10 rounded-lg bg-[#aded1f] font-medium"
          isLoading={isUpdating}
          onClick={onAccept}
        >
          Terima Order
        </Button>
      </div>
    </Card>
  );
}

function OngoingOrderCard({ task, onTrack }: { task: DriverTask; onTrack: () => void }) {
  return (
    <Card className={DRIVER_CARD}>
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-14 truncate font-medium text-neutral-900">
            {taskVehicleTitle(task)}
          </h3>
          <p className="text-11 mt-1 truncate text-[#aebbc4]">{driverDestinationLabel(task)}</p>
          <Badge tone={statusTone(task.status)} className="mt-2">
            {driverStatusLabel(task.status)}
          </Badge>
        </div>
        <Button
          size="sm"
          fullWidth={false}
          className="shrink-0 rounded-xl bg-[#aded1f]"
          onClick={onTrack}
        >
          {driverNeedsInspection(task.status) ? 'Cek Armada' : 'Tracking'}
        </Button>
      </div>
    </Card>
  );
}

function HistoryCard({ task }: { task: DriverTask }) {
  const canceled = isDriverTaskCanceled(task.status);
  return (
    <Card className={DRIVER_CARD}>
      <div className="flex items-center justify-between gap-3">
        <p className="text-12 text-[#aebbc4]">{formatDateTime(taskTime(task))}</p>
        <HistoryStatusBadge status={task.status} />
      </div>
      <h3 className="text-13 mt-3 truncate font-medium text-neutral-900">{historyTitle(task)}</h3>
      <div className="mt-4 flex flex-col gap-2">
        <MiniRoutePoint tone="blue" text={task.pickupAddress || '-'} />
        <MiniRoutePoint tone="orange" text={driverDestinationLabel(task)} />
      </div>
      <div className="my-4 h-px bg-neutral-200" />
      <div className="flex items-center justify-between">
        <p className="text-14 text-[#aebbc4]">Pendapatan:</p>
        <p
          className={cn('text-14 font-semibold', canceled ? 'text-neutral-400' : 'text-[#c2f347]')}
        >
          {canceled ? 'Rp 0' : formatCurrency(driverTaskRevenue(task))}
        </p>
      </div>
    </Card>
  );
}

function HistoryStatusBadge({ status }: { status: string }) {
  const finished = isDriverTaskFinished(status);
  const canceled = isDriverTaskCanceled(status);
  // Riwayat memakai label ringkas seperti desain (Selesai/Dibatalkan), bukan
  // label status perjalanan.
  const label = finished ? 'Selesai' : canceled ? 'Dibatalkan' : driverStatusLabel(status);
  return (
    <span
      className={cn(
        'rounded-full px-3 py-1 text-[12px] font-medium whitespace-nowrap',
        finished && 'bg-[#131c24] text-[12px] text-[#6ae795]',
        canceled && 'bg-[#131c24] text-[12px] text-[#e7736a]',
        !finished && !canceled && 'bg-[#131c24] text-[12px] text-[#c2f347]',
      )}
    >
      {label}
    </span>
  );
}

function MiniRoutePoint({ tone, text }: { tone: 'blue' | 'orange'; text: string }) {
  return (
    <div className="flex items-start gap-3">
      <span
        className={cn(
          'mt-1 size-3 shrink-0 rounded-full border-2',
          tone === 'blue' ? 'border-[#aded1f] bg-neutral-200' : 'border-[#dd422c] bg-[#df4e3a]',
        )}
      />
      <p className="text-12 min-w-0 flex-1 text-neutral-700">{text || '-'}</p>
    </div>
  );
}

function DriverProgress({ status }: { status: string }) {
  const activeIndex = trackingProgressIndex(status);
  return (
    <div className="flex flex-col">
      {TRACKING_STEPS.map((step, index) => {
        const active = index === activeIndex;
        const done = index < activeIndex;
        return (
          <div key={step.key} className="grid grid-cols-[28px_1fr] gap-3">
            <div className="flex flex-col items-center">
              <span
                className={cn(
                  'grid size-6 shrink-0 place-items-center rounded-full border-2',
                  active && 'border-[#dd422c] bg-[#df4e3a] text-white',
                  done && 'border-[#aded1f] bg-[#aded1f] text-on-brand',
                  !active && !done && 'border-neutral-300 bg-neutral-200 text-neutral-400',
                )}
              >
                {active ? <Truck className="size-3" /> : done ? <Check className="size-3" /> : null}
              </span>
              {index < TRACKING_STEPS.length - 1 && (
                <span className="h-10 border-l-2 border-[#223039]" />
              )}
            </div>
            <div className="pb-4">
              <p
                className={cn(
                  'text-14 font-medium',
                  active ? 'text-[#c2f347]' : done ? 'text-neutral-900' : 'text-[#aebbc4]',
                )}
              >
                {step.label}
              </p>
              <p className="text-11 mt-1 text-[#94a3ae]">{step.caption}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function routeMarkers(task: DriverTask): MapMarker[] {
  const pickup = pickupPoint(task);
  const destination = destinationPoint(task);
  const markers: MapMarker[] = [];
  if (pickup) markers.push({ ...pickup, label: 'Lokasi jemput', variant: 'origin' });
  if (destination)
    markers.push({ ...destination, label: driverDestinationLabel(task), variant: 'destination' });
  return markers;
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col items-start justify-between gap-y-0.5 border-b border-neutral-200 last:border-0">
      <p className="text-12 text-neutral-600">{label}</p>
      <p className="text-12 max-w-full text-start font-semibold text-neutral-900">{value || '-'}</p>
    </div>
  );
}

function OrderStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="px-2">
      <p className="text-[18px] font-semibold text-[#c2f347]">{value}</p>
      <p className="mt-1 text-[12px] font-medium text-[#eef4f8] uppercase">{label}</p>
    </div>
  );
}

function ProfileStat({ value, label }: { value: string; label: string }) {
  return (
    <div className="min-w-0 rounded-xl border border-[#223039]/40 bg-transparent p-3 text-center">
      <p className="text-14 truncate font-medium text-[#c2f347]">{value}</p>
      <p className="text-12 mt-1 text-[#eef4f8]">{label}</p>
    </div>
  );
}

function HistoryFilter({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'text-12 h-8 rounded-full px-3 font-normal whitespace-nowrap transition',
        active ? 'bg-[#aded1f] text-on-brand' : 'bg-[#131c24] text-[#eef4f8]',
      )}
    >
      {label}
    </button>
  );
}

function AccountMenuItem({
  icon,
  label,
  href,
  tone,
  onClick,
}: {
  icon: ReactNode;
  label: string;
  href?: string;
  tone?: 'danger';
  onClick?: () => void;
}) {
  const className = cn(
    'flex min-h-14 w-full items-center justify-between border-b border-[#223039]/40 px-4 text-left last:border-0',
    tone === 'danger' ? 'text-danger' : 'text-neutral-900',
  );
  const content = (
    <>
      <span className="flex min-w-0 items-center gap-3">
        <span
          className={cn(
            'grid size-6 shrink-0 place-items-center',
            tone === 'danger' ? 'text-danger' : 'text-[#c2f347]',
          )}
        >
          {icon}
        </span>
        <span className="text-14 truncate font-normal">{label}</span>
      </span>
      {tone !== 'danger' && <ChevronRight className="size-5 shrink-0 text-[#eef4f8]" />}
    </>
  );

  if (href) {
    return (
      <a href={href} className={className}>
        {content}
      </a>
    );
  }
  return (
    <button type="button" onClick={onClick} className={className}>
      {content}
    </button>
  );
}

function EmptyDriverPanel({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="drive-card flex flex-col items-center justify-center rounded-xl border border-[#223039]/30 px-6 py-10 text-center">
      <div className="grid size-14 place-items-center rounded-full bg-[#131c24] text-[#c2f347]">
        {icon}
      </div>
      <p className="text-16 mt-4 font-semibold text-neutral-900">{title}</p>
      <p className="text-12 mt-1 text-[#aebbc4]">{description}</p>
    </div>
  );
}

function SafetyTip() {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-[#2e4a13]/60 bg-[#131c24] p-4 text-[#c2f347]">
      <Lightbulb className="mt-0.5 size-5 shrink-0 text-[#c2f347]" />
      <p className="text-12">
        Tetap gunakan sabuk pengaman dan periksa kondisi derek sebelum berangkat.
      </p>
    </div>
  );
}

function FloatingSupport() {
  return (
    <div className="pointer-events-none fixed bottom-24 left-1/2 z-40 w-full max-w-md -translate-x-1/2">
      <button
        type="button"
        onClick={() => toast.info('Nomor bantuan belum tersedia')}
        className="pointer-events-auto absolute right-6 bottom-0 grid size-14 place-items-center rounded-full bg-[#aded1f] text-on-brand shadow-lg"
        aria-label="Bantuan operasional"
      >
        <Headphones className="size-6" />
      </button>
    </div>
  );
}

function DriverBottomNav({
  active,
  onChange,
}: {
  active: DriverTab;
  onChange: (tab: DriverTab) => void;
}) {
  const items: Array<{ tab: DriverTab; label: string; icon: ReactNode }> = [
    { tab: 'home', label: 'Home', icon: <House className="size-[18px]" /> },
    { tab: 'orders', label: 'Orderan', icon: <ClipboardList className="size-[18px]" /> },
    { tab: 'history', label: 'History', icon: <History className="size-[18px]" /> },
    { tab: 'account', label: 'Account', icon: <CircleUser className="size-[18px]" /> },
  ];

  return (
    <nav className="pb-safe fixed bottom-0 left-1/2 z-50 grid w-full max-w-md -translate-x-1/2 grid-cols-4 border-t border-[#223039]/40 bg-[#131c24]/95 px-2 py-1 backdrop-blur">
      {items.map((item) => {
        const selected = item.tab === active;
        return (
          <button
            key={item.tab}
            type="button"
            onClick={() => onChange(item.tab)}
            className={cn(
              'flex h-11 flex-col items-center justify-center gap-1 text-[10px] font-normal transition',
              selected ? 'text-[#c2f347]' : 'text-[#aebbc4]',
            )}
          >
            {item.icon}
            {item.label}
          </button>
        );
      })}
    </nav>
  );
}
