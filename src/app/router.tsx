import { lazy, type ReactNode } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { ROUTES } from './routes';
import { RootGate, RequireAuth } from './guards';
import { APP_FEATURES } from '@/config/constants';
import { AppShell } from '@/components/layout/AppShell';
import { ComingSoon } from '@/components/feedback/ComingSoon';

// Code-splitting: tiap halaman dimuat ON-DEMAND saat rutenya diakses (lazy),
// bukan disatukan ke bundel awal. Ini memangkas ukuran muat pertama drastis.
// Boundary <Suspense> ada di RootGate (guards.tsx). Layout & guard sengaja
// tetap eager karena dibutuhkan untuk kerangka & keputusan redirect.
const GetStartedPage = lazy(() =>
  import('@/features/auth/pages/GetStartedPage').then((m) => ({ default: m.GetStartedPage })),
);
const LoginSelectorPage = lazy(() =>
  import('@/features/auth/pages/LoginSelectorPage').then((m) => ({
    default: m.LoginSelectorPage,
  })),
);
const UserLoginPage = lazy(() =>
  import('@/features/auth/pages/LoginPage').then((m) => ({ default: m.UserLoginPage })),
);
const MitraLoginPage = lazy(() =>
  import('@/features/auth/pages/LoginPage').then((m) => ({ default: m.MitraLoginPage })),
);
const SopirLoginPage = lazy(() =>
  import('@/features/auth/pages/LoginPage').then((m) => ({ default: m.SopirLoginPage })),
);
const ActivatePage = lazy(() =>
  import('@/features/auth/pages/ActivatePage').then((m) => ({ default: m.ActivatePage })),
);
const VerifyEmailPage = lazy(() =>
  import('@/features/auth/pages/VerifyEmailPage').then((m) => ({ default: m.VerifyEmailPage })),
);
const RegisterSuccessPage = lazy(() =>
  import('@/features/auth/pages/RegisterSuccessPage').then((m) => ({
    default: m.RegisterSuccessPage,
  })),
);
const ForgotPasswordPage = lazy(() =>
  import('@/features/auth/pages/ForgotPasswordPage').then((m) => ({
    default: m.ForgotPasswordPage,
  })),
);
const VerifyResetCodePage = lazy(() =>
  import('@/features/auth/pages/VerifyResetCodePage').then((m) => ({
    default: m.VerifyResetCodePage,
  })),
);
const ResetPasswordPage = lazy(() =>
  import('@/features/auth/pages/ResetPasswordPage').then((m) => ({ default: m.ResetPasswordPage })),
);
const RegisterPage = lazy(() =>
  import('@/features/auth/pages/RegisterPage').then((m) => ({ default: m.RegisterPage })),
);
const HomePage = lazy(() =>
  import('@/features/home/pages/HomePage').then((m) => ({ default: m.HomePage })),
);
const ProfilePage = lazy(() =>
  import('@/features/profile/pages/ProfilePage').then((m) => ({ default: m.ProfilePage })),
);
const CheckConditionPage = lazy(() =>
  import('@/features/checkup/pages/CheckConditionPage').then((m) => ({
    default: m.CheckConditionPage,
  })),
);
const CheckupPermissionPage = lazy(() =>
  import('@/features/checkup/pages/CheckupPermissionPage').then((m) => ({
    default: m.CheckupPermissionPage,
  })),
);
const EmergencyPage = lazy(() =>
  import('@/features/checkup/pages/EmergencyPage').then((m) => ({ default: m.EmergencyPage })),
);
const EmergencyServicePage = lazy(() =>
  import('@/features/checkup/pages/EmergencyServicePage').then((m) => ({
    default: m.EmergencyServicePage,
  })),
);
const LicensePlatePage = lazy(() =>
  import('@/features/checkup/pages/LicensePlatePage').then((m) => ({
    default: m.LicensePlatePage,
  })),
);
const VehicleDataPage = lazy(() =>
  import('@/features/checkup/pages/VehicleDataPage').then((m) => ({
    default: m.VehicleDataPage,
  })),
);
const VehicleSidesPage = lazy(() =>
  import('@/features/checkup/pages/VehicleSidesPage').then((m) => ({
    default: m.VehicleSidesPage,
  })),
);
const PreviewVehiclePage = lazy(() =>
  import('@/features/checkup/pages/PreviewVehiclePage').then((m) => ({
    default: m.PreviewVehiclePage,
  })),
);
const AnalyzingPage = lazy(() =>
  import('@/features/checkup/pages/AnalyzingPage').then((m) => ({
    default: m.AnalyzingPage,
  })),
);
const DamageAnalysisPage = lazy(() =>
  import('@/features/damage/pages/DamageAnalysisPage').then((m) => ({
    default: m.DamageAnalysisPage,
  })),
);
const DetailDamagePage = lazy(() =>
  import('@/features/damage/pages/DetailDamagePage').then((m) => ({ default: m.DetailDamagePage })),
);
const EstimatedCostPage = lazy(() =>
  import('@/features/damage/pages/EstimatedCostPage').then((m) => ({
    default: m.EstimatedCostPage,
  })),
);
const PaymentPage = lazy(() =>
  import('@/features/payment/pages/PaymentPage').then((m) => ({ default: m.PaymentPage })),
);
const PaymentWaitingPage = lazy(() =>
  import('@/features/payment/pages/PaymentWaitingPage').then((m) => ({
    default: m.PaymentWaitingPage,
  })),
);
const PaymentSuccessPage = lazy(() =>
  import('@/features/payment/pages/PaymentSuccessPage').then((m) => ({
    default: m.PaymentSuccessPage,
  })),
);
const TowingOrderPage = lazy(() =>
  import('@/features/towing/pages/TowingOrderPage').then((m) => ({ default: m.TowingOrderPage })),
);
const TowingOrdersPage = lazy(() =>
  import('@/features/towing/pages/TowingOrdersPage').then((m) => ({ default: m.TowingOrdersPage })),
);
const TowingStatusPage = lazy(() =>
  import('@/features/towing/pages/TowingStatusPage').then((m) => ({ default: m.TowingStatusPage })),
);
const TowingTrackingPage = lazy(() =>
  import('@/features/towing/pages/TowingTrackingPage').then((m) => ({
    default: m.TowingTrackingPage,
  })),
);
const DriverGate = lazy(() =>
  import('@/features/driver/pages/DriverGate').then((m) => ({ default: m.DriverGate })),
);
const MitraGate = lazy(() =>
  import('@/features/mitra-portal/pages/MitraGate').then((m) => ({ default: m.MitraGate })),
);
const MitraGuard = lazy(() =>
  import('@/features/mitra-portal/pages/MitraGuard').then((m) => ({ default: m.MitraGuard })),
);
const MitraAkunPage = lazy(() =>
  import('@/features/mitra-portal/pages/MitraAkunPage').then((m) => ({ default: m.MitraAkunPage })),
);
const LaporanPage = lazy(() =>
  import('@/features/mitra-portal/pages/LaporanPage').then((m) => ({ default: m.LaporanPage })),
);
const LaporanDetailPage = lazy(() =>
  import('@/features/mitra-portal/pages/LaporanDetailPage').then((m) => ({
    default: m.LaporanDetailPage,
  })),
);
const LaporanSuccessPage = lazy(() =>
  import('@/features/mitra-portal/pages/LaporanSuccessPage').then((m) => ({
    default: m.LaporanSuccessPage,
  })),
);
const SaldoPage = lazy(() =>
  import('@/features/mitra-portal/pages/SaldoPage').then((m) => ({ default: m.SaldoPage })),
);
const TarikSaldoPage = lazy(() =>
  import('@/features/mitra-portal/pages/TarikSaldoPage').then((m) => ({
    default: m.TarikSaldoPage,
  })),
);
const KemitraanPage = lazy(() =>
  import('@/features/mitra-portal/pages/towing/KemitraanPage').then((m) => ({
    default: m.KemitraanPage,
  })),
);
const WorkshopKemitraanPage = lazy(() =>
  import('@/features/mitra-portal/pages/workshop/KemitraanPage').then((m) => ({
    default: m.WorkshopKemitraanPage,
  })),
);
const SopirListPage = lazy(() =>
  import('@/features/mitra-portal/pages/towing/SopirListPage').then((m) => ({
    default: m.SopirListPage,
  })),
);
const SopirDetailPage = lazy(() =>
  import('@/features/mitra-portal/pages/towing/SopirDetailPage').then((m) => ({
    default: m.SopirDetailPage,
  })),
);
const SopirTambahPage = lazy(() =>
  import('@/features/mitra-portal/pages/towing/SopirTambahPage').then((m) => ({
    default: m.SopirTambahPage,
  })),
);
const ArmadaListPage = lazy(() =>
  import('@/features/mitra-portal/pages/towing/ArmadaListPage').then((m) => ({
    default: m.ArmadaListPage,
  })),
);
const ArmadaDetailPage = lazy(() =>
  import('@/features/mitra-portal/pages/towing/ArmadaDetailPage').then((m) => ({
    default: m.ArmadaDetailPage,
  })),
);
const ArmadaTambahPage = lazy(() =>
  import('@/features/mitra-portal/pages/towing/ArmadaTambahPage').then((m) => ({
    default: m.ArmadaTambahPage,
  })),
);
const ArmadaEditPage = lazy(() =>
  import('@/features/mitra-portal/pages/towing/ArmadaEditPage').then((m) => ({
    default: m.ArmadaEditPage,
  })),
);
const OrderListPage = lazy(() =>
  import('@/features/mitra-portal/pages/towing/OrderListPage').then((m) => ({
    default: m.OrderListPage,
  })),
);
const OrderTerimaPage = lazy(() =>
  import('@/features/mitra-portal/pages/towing/OrderTerimaPage').then((m) => ({
    default: m.OrderTerimaPage,
  })),
);
const OrderTrackingPage = lazy(() =>
  import('@/features/mitra-portal/pages/towing/OrderTrackingPage').then((m) => ({
    default: m.OrderTrackingPage,
  })),
);
const PenugasanPage = lazy(() =>
  import('@/features/mitra-portal/pages/towing/PenugasanPage').then((m) => ({
    default: m.PenugasanPage,
  })),
);
const PenugasanReadyPage = lazy(() =>
  import('@/features/mitra-portal/pages/towing/PenugasanReadyPage').then((m) => ({
    default: m.PenugasanReadyPage,
  })),
);
const WorkshopQueuePage = lazy(() =>
  import('@/features/mitra-portal/pages/workshop/WorkshopQueuePage').then((m) => ({
    default: m.WorkshopQueuePage,
  })),
);
const WorkshopJobDetailPage = lazy(() =>
  import('@/features/mitra-portal/pages/workshop/WorkshopJobDetailPage').then((m) => ({
    default: m.WorkshopJobDetailPage,
  })),
);
const WorkshopProfilPage = lazy(() =>
  import('@/features/mitra-portal/pages/workshop/WorkshopProfilPage').then((m) => ({
    default: m.WorkshopProfilPage,
  })),
);
const TarifPage = lazy(() =>
  import('@/features/mitra-portal/pages/towing/TarifPage').then((m) => ({
    default: m.TarifPage,
  })),
);
const MitraRegisterPage = lazy(() =>
  import('@/features/mitra/pages/MitraRegisterPage').then((m) => ({
    default: m.MitraRegisterPage,
  })),
);
const MitraResubmitPage = lazy(() =>
  import('@/features/mitra/pages/MitraResubmitPage').then((m) => ({
    default: m.MitraResubmitPage,
  })),
);
const RecentActivityPage = lazy(() =>
  import('@/features/activity/pages/RecentActivityPage').then((m) => ({
    default: m.RecentActivityPage,
  })),
);
const MyVehiclesPage = lazy(() =>
  import('@/features/vehicle/pages/MyVehiclesPage').then((m) => ({ default: m.MyVehiclesPage })),
);
const VehicleFormPage = lazy(() =>
  import('@/features/vehicle/pages/VehicleFormPage').then((m) => ({ default: m.VehicleFormPage })),
);
const SelectVehiclePage = lazy(() =>
  import('@/features/vehicle/pages/SelectVehiclePage').then((m) => ({
    default: m.SelectVehiclePage,
  })),
);
const WorkshopListPage = lazy(() =>
  import('@/features/workshop/pages/WorkshopListPage').then((m) => ({
    default: m.WorkshopListPage,
  })),
);
const WorkshopDetailPage = lazy(() =>
  import('@/features/workshop/pages/WorkshopDetailPage').then((m) => ({
    default: m.WorkshopDetailPage,
  })),
);
const WorkshopRoutePage = lazy(() =>
  import('@/features/workshop/pages/WorkshopRoutePage').then((m) => ({
    default: m.WorkshopRoutePage,
  })),
);
const WorkshopReviewPage = lazy(() =>
  import('@/features/workshop/pages/WorkshopReviewPage').then((m) => ({
    default: m.WorkshopReviewPage,
  })),
);
const NotificationsPage = lazy(() =>
  import('@/features/notifications/pages/NotificationsPage').then((m) => ({
    default: m.NotificationsPage,
  })),
);
const InsuranceSearchPage = lazy(() =>
  import('@/features/insurance/pages/InsuranceSearchPage').then((m) => ({
    default: m.InsuranceSearchPage,
  })),
);
const InsuranceDetailPage = lazy(() =>
  import('@/features/insurance/pages/InsuranceDetailPage').then((m) => ({
    default: m.InsuranceDetailPage,
  })),
);
const InsurancePurchasePage = lazy(() =>
  import('@/features/insurance/pages/InsurancePurchasePage').then((m) => ({
    default: m.InsurancePurchasePage,
  })),
);
const InsurancePoliciesPage = lazy(() =>
  import('@/features/insurance/pages/InsurancePoliciesPage').then((m) => ({
    default: m.InsurancePoliciesPage,
  })),
);
const InsurancePolicyDetailPage = lazy(() =>
  import('@/features/insurance/pages/InsurancePolicyDetailPage').then((m) => ({
    default: m.InsurancePolicyDetailPage,
  })),
);
const ClaimsPage = lazy(() =>
  import('@/features/claim/pages/ClaimsPage').then((m) => ({ default: m.ClaimsPage })),
);
const ClaimInsuranceDataPage = lazy(() =>
  import('@/features/claim/pages/ClaimInsuranceDataPage').then((m) => ({
    default: m.ClaimInsuranceDataPage,
  })),
);
const ClaimSelectPolicyPage = lazy(() =>
  import('@/features/claim/pages/ClaimSelectPolicyPage').then((m) => ({
    default: m.ClaimSelectPolicyPage,
  })),
);
const ClaimFormPage = lazy(() =>
  import('@/features/claim/pages/ClaimFormPage').then((m) => ({ default: m.ClaimFormPage })),
);
const ClaimDocumentsPage = lazy(() =>
  import('@/features/claim/pages/ClaimDocumentsPage').then((m) => ({
    default: m.ClaimDocumentsPage,
  })),
);
const ClaimDocumentsViewPage = lazy(() =>
  import('@/features/claim/pages/ClaimDocumentsViewPage').then((m) => ({
    default: m.ClaimDocumentsViewPage,
  })),
);
const ClaimDetailPage = lazy(() =>
  import('@/features/claim/pages/ClaimDetailPage').then((m) => ({ default: m.ClaimDetailPage })),
);
const ClaimReviewPage = lazy(() =>
  import('@/features/claim/pages/ClaimReviewPage').then((m) => ({ default: m.ClaimReviewPage })),
);
const ClaimStatusPage = lazy(() =>
  import('@/features/claim/pages/ClaimStatusPage').then((m) => ({ default: m.ClaimStatusPage })),
);
const PolicyTakeoverPage = lazy(() =>
  import('@/features/insurance/pages/PolicyTakeoverPage').then((m) => ({
    default: m.PolicyTakeoverPage,
  })),
);
const ClaimTicketPage = lazy(() =>
  import('@/features/claim/pages/ClaimTicketPage').then((m) => ({ default: m.ClaimTicketPage })),
);
const ClaimApprovedPage = lazy(() =>
  import('@/features/claim/pages/ClaimApprovedPage').then((m) => ({
    default: m.ClaimApprovedPage,
  })),
);
const RatingPage = lazy(() =>
  import('@/features/rating/RatingPage').then((m) => ({ default: m.RatingPage })),
);

/** Bungkus elemen dengan guard sesi user. */
const protect = (element: ReactNode): ReactNode => <RequireAuth>{element}</RequireAuth>;
const disabledSavedVehicleRedirect = <Navigate to={ROUTES.home} replace />;

/**
 * Pembagian akses:
 * - Publik (guest): onboarding, auth, beranda, dan SELURUH alur scanning
 *   (check-condition → plat → sisi → preview). Ini disengaja agar fitur baru
 *   bekerja: guest memindai dulu, lalu diminta register/login saat hendak klaim.
 * - Terproteksi: hasil kerusakan ke atas (klaim, pembayaran, kendaraan, dst).
 * - Portal sopir towing punya sesi sendiri (ditangani di dalam halamannya).
 */
export const router = createBrowserRouter([
  {
    element: <RootGate />,
    children: [
      // Onboarding & auth
      { path: ROUTES.getStarted, element: <GetStartedPage /> },
      { path: ROUTES.login, element: <LoginSelectorPage /> },
      { path: ROUTES.loginUser, element: <UserLoginPage /> },
      { path: ROUTES.loginMitra, element: <MitraLoginPage /> },
      { path: ROUTES.loginSopir, element: <SopirLoginPage /> },
      { path: ROUTES.activate, element: <ActivatePage /> },
      { path: ROUTES.register, element: <RegisterPage /> },
      { path: ROUTES.verifyEmail, element: <VerifyEmailPage /> },
      { path: ROUTES.registerSuccess, element: <RegisterSuccessPage /> },
      { path: ROUTES.forgotPassword, element: <ForgotPasswordPage /> },
      { path: ROUTES.verifyResetCode, element: <VerifyResetCodePage /> },
      { path: ROUTES.resetPassword, element: <ResetPasswordPage /> },
      { path: ROUTES.mitraRegister, element: <MitraRegisterPage /> },
      { path: ROUTES.mitraResubmit, element: <MitraResubmitPage /> },

      // Tab utama (dengan navigasi bawah)
      {
        element: <AppShell />,
        children: [
          { path: ROUTES.home, element: <HomePage /> },
          { path: ROUTES.profile, element: protect(<ProfilePage />) },
        ],
      },

      // Alur scanning (publik untuk guest)
      { path: ROUTES.checkCondition, element: <CheckConditionPage /> },
      { path: ROUTES.checkupPermission, element: <CheckupPermissionPage /> },
      { path: ROUTES.emergency, element: <EmergencyPage /> },
      { path: ROUTES.emergencyHospitals, element: <EmergencyServicePage variant="hospital" /> },
      { path: ROUTES.emergencyTowing, element: <EmergencyServicePage variant="towing" /> },
      {
        path: ROUTES.selectVehicle,
        element: APP_FEATURES.savedVehicles ? (
          <SelectVehiclePage />
        ) : (
          <Navigate to={ROUTES.licensePlate} replace />
        ),
      },
      { path: ROUTES.vehicleData, element: <VehicleDataPage /> },
      { path: ROUTES.licensePlate, element: <LicensePlatePage /> },
      { path: ROUTES.vehicleSides, element: <VehicleSidesPage /> },
      { path: ROUTES.previewVehicle, element: <PreviewVehiclePage /> },
      { path: ROUTES.analyzing, element: <AnalyzingPage /> },
      // Hasil kerusakan: PUBLIK agar guest melihat hasil ter-blur + prompt login.
      { path: ROUTES.damageAnalysis, element: <DamageAnalysisPage /> },

      // Terproteksi
      { path: ROUTES.detailDamage, element: protect(<DetailDamagePage />) },
      { path: ROUTES.estimatedCost, element: protect(<EstimatedCostPage />) },
      { path: ROUTES.workshopList, element: protect(<WorkshopListPage />) },
      { path: ROUTES.workshopDetail, element: protect(<WorkshopDetailPage />) },
      { path: ROUTES.workshopRoute, element: protect(<WorkshopRoutePage />) },
      { path: ROUTES.workshopReview, element: protect(<WorkshopReviewPage />) },
      { path: ROUTES.payment, element: protect(<PaymentPage />) },
      { path: ROUTES.paymentWaiting, element: protect(<PaymentWaitingPage />) },
      { path: ROUTES.paymentSuccess, element: protect(<PaymentSuccessPage />) },
      { path: ROUTES.recentActivity, element: protect(<RecentActivityPage />) },
      {
        path: ROUTES.myVehicles,
        element: APP_FEATURES.savedVehicles
          ? protect(<MyVehiclesPage />)
          : disabledSavedVehicleRedirect,
      },
      {
        path: ROUTES.vehicleForm,
        element: APP_FEATURES.savedVehicles
          ? protect(<VehicleFormPage />)
          : disabledSavedVehicleRedirect,
      },
      { path: ROUTES.notifications, element: protect(<NotificationsPage />) },
      { path: ROUTES.insuranceSearch, element: protect(<InsuranceSearchPage />) },
      { path: ROUTES.insuranceDetail, element: protect(<InsuranceDetailPage />) },
      { path: ROUTES.insurancePurchase, element: protect(<InsurancePurchasePage />) },
      { path: ROUTES.insurancePolicies, element: protect(<InsurancePoliciesPage />) },
      { path: ROUTES.insurancePolicyDetail, element: protect(<InsurancePolicyDetailPage />) },
      { path: ROUTES.claims, element: protect(<ClaimsPage />) },
      { path: ROUTES.claimInsuranceData, element: protect(<ClaimInsuranceDataPage />) },
      { path: ROUTES.claimSelectPolicy, element: protect(<ClaimSelectPolicyPage />) },
      { path: ROUTES.claimForm, element: protect(<ClaimFormPage />) },
      { path: ROUTES.claimDocuments, element: protect(<ClaimDocumentsPage />) },
      { path: ROUTES.claimDocumentsView, element: protect(<ClaimDocumentsViewPage />) },
      { path: ROUTES.claimDetail, element: protect(<ClaimDetailPage />) },
      { path: ROUTES.claimReview, element: protect(<ClaimReviewPage />) },
      { path: ROUTES.claimStatus, element: protect(<ClaimStatusPage />) },
      { path: ROUTES.policyTakeover, element: protect(<PolicyTakeoverPage />) },
      { path: ROUTES.claimTicket, element: protect(<ClaimTicketPage />) },
      { path: ROUTES.claimApproved, element: protect(<ClaimApprovedPage />) },
      { path: ROUTES.rating, element: protect(<RatingPage />) },
      { path: ROUTES.towingOrder, element: protect(<TowingOrderPage />) },
      { path: ROUTES.towingOrders, element: protect(<TowingOrdersPage />) },
      { path: ROUTES.towingStatus, element: protect(<TowingStatusPage />) },
      { path: ROUTES.towingTracking, element: protect(<TowingTrackingPage />) },

      // Portal sopir towing (sesi sendiri)
      { path: ROUTES.driver, element: <DriverGate /> },

      // Portal mitra bengkel/towing (sesi mitra sendiri)
      { path: ROUTES.mitra, element: <MitraGate /> },
      {
        element: <MitraGuard />,
        children: [
          { path: ROUTES.mitraSopir, element: <SopirListPage /> },
          { path: ROUTES.mitraSopirTambah, element: <SopirTambahPage /> },
          { path: ROUTES.mitraSopirDetail, element: <SopirDetailPage /> },
          { path: ROUTES.mitraArmada, element: <ArmadaListPage /> },
          { path: ROUTES.mitraArmadaTambah, element: <ArmadaTambahPage /> },
          { path: ROUTES.mitraArmadaDetail, element: <ArmadaDetailPage /> },
          { path: ROUTES.mitraArmadaEdit, element: <ArmadaEditPage /> },
          { path: ROUTES.mitraKemitraan, element: <KemitraanPage /> },
          { path: ROUTES.mitraBengkelKemitraan, element: <WorkshopKemitraanPage /> },
          { path: ROUTES.mitraBengkelProfil, element: <WorkshopProfilPage /> },
          { path: ROUTES.mitraTarif, element: <TarifPage /> },
          { path: ROUTES.mitraOrder, element: <OrderListPage /> },
          { path: ROUTES.mitraOrderTerima, element: <OrderTerimaPage /> },
          { path: ROUTES.mitraOrderTracking, element: <OrderTrackingPage /> },
          { path: ROUTES.mitraPenugasan, element: <PenugasanPage /> },
          { path: ROUTES.mitraPenugasanKonfirmasi, element: <PenugasanReadyPage /> },
          { path: ROUTES.mitraLaporan, element: <LaporanPage /> },
          { path: ROUTES.mitraLaporanBerhasil, element: <LaporanSuccessPage /> },
          { path: ROUTES.mitraLaporanDetail, element: <LaporanDetailPage /> },
          { path: ROUTES.mitraSaldo, element: <SaldoPage /> },
          { path: ROUTES.mitraTarikSaldo, element: <TarikSaldoPage /> },
          { path: ROUTES.mitraWorkshopJobs, element: <WorkshopQueuePage /> },
          { path: ROUTES.mitraWorkshopJobDetail, element: <WorkshopJobDetailPage /> },
          { path: ROUTES.mitraAkun, element: <MitraAkunPage /> },
        ],
      },

      // 404
      { path: '*', element: <ComingSoon title="Halaman tidak ditemukan" /> },
    ],
  },
]);
