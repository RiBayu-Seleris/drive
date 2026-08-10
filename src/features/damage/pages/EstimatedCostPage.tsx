import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PageContainer } from '@/components/layout/PageContainer';
import { AppHeader } from '@/components/layout/AppHeader';
import { Button } from '@/components/ui/Button';
import { LoadingState } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/feedback/StateViews';
import { toast } from '@/components/feedback/toast';
import { ROUTES } from '@/app/routes';
import { STORAGE_KEYS } from '@/config/constants';
import { storage } from '@/lib/storage/storage';
import { formatCurrency } from '@/lib/utils/format';
import { useScanServices } from '@/features/vehicle-scan/services/scanServicesContext';
import {
  fetchDamageDetail,
  getRememberedInferencePlate,
  normalizeIDRLabel,
} from '../api/damageApi';
import { useDamageStore } from '../store/damageStore';
import { useScanStore } from '@/features/vehicle-scan/store/scanStore';
import { useClaimDraftStore } from '@/features/claim/store/claimDraftStore';
import FrameModal from '/assets/Estimated_repair_cost/modals-frame.png';
import Cars from '/assets/Estimated_repair_cost/cars.png';
import AutoWhiteLogo from '/assets/auth/logo_auto.png';
import CloseIcon from '/assets/Estimated_repair_cost/close.svg';

export function EstimatedCostPage() {
  const navigate = useNavigate();
  const services = useScanServices();
  const routeState = useLocation().state as {
    claimNumber?: string;
    fromApprovedClaim?: boolean;
    selfPay?: boolean;
    inferenceTicket?: string;
    /** Sisa yang benar-benar dibayar user setelah klaim disetujui. */
    customerPayable?: number;
  } | null;
  const result = useDamageStore((s) => s.result);
  const setResult = useDamageStore((s) => s.setResult);
  const reportUnlocked = useDamageStore((s) => s.reportUnlocked);
  const flowMode = useDamageStore((s) => s.flowMode);
  const setFlowMode = useDamageStore((s) => s.setFlowMode);
  const scanPlateNumber = useScanStore((state) => state.plate.number);
  const insuranceStatus = useScanStore((state) => state.insuranceStatus);
  const insuranceCoverage = useScanStore((state) => state.insuranceCoverage);
  const setPlate = useScanStore((state) => state.setPlate);
  const setInsurance = useScanStore((state) => state.setInsurance);
  const resetClaimDraft = useClaimDraftStore((state) => state.reset);
  const setClaimInferenceTicket = useClaimDraftStore((state) => state.setInferenceTicket);
  const [showInsuranceDecision, setShowInsuranceDecision] = useState(false);
  const [isRecoveringResult, setIsRecoveringResult] = useState(false);
  const claimNumber = routeState?.claimNumber ?? '';
  const inferenceTicket =
    routeState?.inferenceTicket ?? storage.getString(STORAGE_KEYS.guestInferenceTicket) ?? '';
  const selfPay = Boolean(routeState?.selfPay) || flowMode === 'self_pay';
  const fromApprovedClaim = Boolean(routeState?.fromApprovedClaim && claimNumber);
  // Angka ini datang dari layar klaim supaya tidak dihitung ulang di sini —
  // satu sumber, satu nilai, tidak mungkin berbeda antar halaman.
  const claimCustomerPayable = routeState?.customerPayable ?? 0;
  const coveredByClaim = fromApprovedClaim && typeof routeState?.customerPayable === 'number';
  const currentTicket = result?.ticket ?? inferenceTicket;
  const isReportUnlocked = reportUnlocked || Boolean(result?.reportUnlocked);
  const ticketPlateNumber = result?.plateNumber ?? getRememberedInferencePlate(currentTicket) ?? '';
  const effectivePlateNumber =
    scanPlateNumber ||
    ticketPlateNumber ||
    storage.getString(STORAGE_KEYS.lastScanPlateNumber) ||
    '';
  const showInsuranceOption =
    !fromApprovedClaim &&
    !selfPay &&
    insuranceStatus === 'insured' &&
    Boolean(insuranceCoverage?.insured);

  useEffect(() => {
    if (result || !inferenceTicket) return;

    let active = true;
    setIsRecoveringResult(true);
    fetchDamageDetail(inferenceTicket)
      .then((detail) => {
        if (active) setResult(detail);
      })
      .catch(() => {
        if (active) toast.error('Gagal memuat estimasi dari hasil analisis klaim.');
      })
      .finally(() => {
        if (active) setIsRecoveringResult(false);
      });

    return () => {
      active = false;
    };
  }, [inferenceTicket, result, setResult]);

  useEffect(() => {
    if (!ticketPlateNumber || scanPlateNumber) return;
    setPlate(ticketPlateNumber, 'manual');
  }, [scanPlateNumber, setPlate, ticketPlateNumber]);

  useEffect(() => {
    if (!result || !effectivePlateNumber || insuranceStatus !== 'idle') return;

    let active = true;
    setInsurance('checking', null);

    services.insuranceCheck
      .checkByPlate(effectivePlateNumber)
      .then((coverage) => {
        if (!active) return;
        setInsurance(coverage.insured ? 'insured' : 'not_insured', coverage);
      })
      .catch(() => {
        if (!active) return;
        setInsurance('error', null);
      });

    return () => {
      active = false;
    };
  }, [effectivePlateNumber, insuranceStatus, result, services, setInsurance]);

  useEffect(() => {
    if (!result || isReportUnlocked || !currentTicket) return;

    toast.info('Buka detail analisis terlebih dahulu sebelum melihat estimasi biaya.');
    navigate(ROUTES.payment, {
      replace: true,
      state: {
        payment_type: 'AI_REPORT',
        redirect_route: ROUTES.estimatedCost,
        redirect_state: {
          claimNumber,
          fromApprovedClaim,
          selfPay,
          inferenceTicket: currentTicket,
        },
        ticket: currentTicket,
      },
    });
  }, [claimNumber, currentTicket, fromApprovedClaim, isReportUnlocked, navigate, result, selfPay]);

  useEffect(() => {
    if (!showInsuranceDecision) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setShowInsuranceDecision(false);
    };
    const previousOverflow = document.body.style.overflow;

    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [showInsuranceDecision]);

  if (!result) {
    return (
      <PageContainer>
        <AppHeader title="Estimasi Biaya" />
        {isRecoveringResult ? (
          <LoadingState label="Memuat estimasi biaya..." />
        ) : (
          <EmptyState
            title="Belum ada estimasi"
            description="Lakukan analisis kerusakan terlebih dahulu."
            action={
              <Button fullWidth={false} onClick={() => navigate(ROUTES.checkCondition)}>
                Cek Kondisi Kendaraan
              </Button>
            }
          />
        )}
      </PageContainer>
    );
  }

  const { items, totalPrice } = result.estimation;
  const replaced = items.filter((item) => item.change_severity === 'replaced');
  const repaired = items.filter((item) => item.change_severity !== 'replaced');

  const closeInsuranceDecision = () => setShowInsuranceDecision(false);

  const handleUseInsurance = () => {
    closeInsuranceDecision();
    resetClaimDraft();
    setClaimInferenceTicket(result.ticket ?? inferenceTicket);
    setFlowMode('insurance_claim');
    navigate(ROUTES.claimInsuranceData);
  };

  const handleSkipInsurance = () => {
    closeInsuranceDecision();
  };

  return (
    <PageContainer>
      <AppHeader showLogo />
      <div className="space-y-6 p-4 pb-32">
        <div className="text-center">
          <h2 className="text-16 font-semibold text-gray-800">
            Estimasi Biaya Perbaikan Kendaraan Anda
          </h2>
          <p className="text-12 mt-1 text-gray-500">
            Berikut adalah estimasi biaya perbaikan untuk bagian yang terdeteksi mengalami kerusakan
          </p>
        </div>

        <section>
          <h3 className="text-14 mb-2 font-semibold text-gray-700">Rincian Kerusakan</h3>
          <div className="flex w-full flex-col gap-y-3">
            {items.map((item, index) => (
              <div
                key={`${item.part_name}-${index}`}
                className="flex items-center justify-between rounded-xl border border-gray-300 p-3"
              >
                <div className="flex min-w-0 items-center gap-3">
                  <img
                    src={item.damage_image}
                    alt={item.part_name}
                    className="size-14 shrink-0 rounded-md object-cover"
                  />
                  <div className="flex min-w-0 flex-col justify-between gap-y-1">
                    <p className="text-14 text-deep-blue-500 truncate font-semibold">
                      {item.part_name}
                    </p>
                    <p className="text-12 text-gray-500">Estimasi Biaya</p>
                  </div>
                </div>
                <div className="flex min-w-0 shrink-0 flex-col justify-between gap-y-1 text-right">
                  <p className="flex items-center justify-end gap-1 text-xs text-red-500">
                    <span className="size-2 rounded-full bg-red-500" />
                    {item.change_severity === 'replaced' ? 'Wajib diganti' : 'Bisa diperbaiki'}
                  </p>
                  <p className="text-12 font-semibold text-gray-800">
                    {normalizeIDRLabel(item.price_estimation)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-gray-300">
          <div className="bg-green-cust text-14 px-4 py-2 font-semibold text-white">
            Total Estimasi Biaya Perbaikan
          </div>
          <div className="space-y-2 p-4 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-600">Sparepart wajib diganti</span>
              <span className="text-14 font-medium">{replaced.length} item</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Sparepart bisa diperbaiki</span>
              <span className="text-14 font-medium">{repaired.length} item</span>
            </div>
            <div className="my-4 flex h-px w-full flex-row gap-x-2">
              {Array.from({ length: 16 }).map((_, index) => (
                <div key={index} className="h-full w-full bg-[#E5E7EB]" />
              ))}
            </div>
            <div className="text-16 flex items-baseline justify-between gap-3">
              <span className="font-medium text-[#374151]">
                {coveredByClaim ? 'Anda bayar' : 'Total'}
              </span>
              {/* Klaim disetujui: harga penuh dicoret, diganti sisa yang benar-benar
                  dibayar user. Angkanya sama dengan yang tampil di layar klaim. */}
              {coveredByClaim ? (
                <span className="flex items-baseline gap-2">
                  <span className="text-12 text-neutral-500 line-through">
                    {normalizeIDRLabel(totalPrice)}
                  </span>
                  <span className="font-[600] text-[#37AB87]">
                    {formatCurrency(claimCustomerPayable)}
                  </span>
                </span>
              ) : (
                <span className="font-[600] text-[#37AB87]">{normalizeIDRLabel(totalPrice)}</span>
              )}
            </div>
            {coveredByClaim && (
              <p className="text-11 pt-1 text-neutral-500">
                {claimCustomerPayable > 0
                  ? 'Sisanya ditanggung asuransi.'
                  : 'Seluruh biaya ditanggung asuransi.'}
              </p>
            )}
          </div>
        </section>

        <div className="flex items-center justify-center">
          <img src="/assets/Estimated_repair_cost/seru.png" className="mr-2 w-6" alt="" />
          <p className="text-12 font-semibold text-[#374151]">
            Estimasi dapat berbeda sesuai hasil pengecekan di bengkel resmi
          </p>
        </div>

        {showInsuranceOption && (
          <button
            type="button"
            onClick={() => setShowInsuranceDecision(true)}
            className="w-full rounded-xl border border-[#D8E0F2] bg-white px-4 py-3 text-left shadow-sm"
          >
            <p className="text-[12px] font-semibold text-neutral-900">
              Mobil Anda terdeteksi memiliki coverage aktif dari{' '}
              {insuranceCoverage?.insurerName ?? 'perusahaan asuransi'}.{' '}
              <span className="text-deep-blue-500 text-12 mt-1 cursor-pointer font-semibold">
                Gunakan Asuransi
              </span>
            </p>
          </button>
        )}
      </div>

      <div className="fixed right-0 bottom-4 left-0 z-50 flex justify-center px-4">
        <Button
          className="max-w-md rounded-xl shadow-lg"
          onClick={() => {
            if (fromApprovedClaim) {
              navigate(ROUTES.workshopList, {
                state: { claimNumber, inferenceTicket: currentTicket },
              });
              return;
            }
            navigate(ROUTES.workshopList);
          }}
        >
          Cari Rekomendasi Bengkel
        </Button>
      </div>

      {showInsuranceDecision && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 px-6"
          role="presentation"
          onClick={closeInsuranceDecision}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="insurance-decision-title"
            className="relative w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Bar merah */}
            <div className="absolute bottom-14 left-1/2 z-40 h-auto w-[calc(100%+40px)] -translate-x-1/2">
              <img src={Cars} alt="" srcSet="" />
            </div>

            {/* Frame */}
            <img
              src={FrameModal}
              alt=""
              className="relative z-20 w-full rounded-lg border-2 border-white bg-transparent"
            />

            {/* Content */}
            <div className="absolute inset-0 z-30 flex flex-col p-5">
              <div className="relative flex items-start justify-between">
                <div className="flex w-full justify-center">
                  <img src={AutoWhiteLogo} alt="" className="w-[40%] object-contain" />
                </div>

                <button
                  type="button"
                  onClick={closeInsuranceDecision}
                  aria-label="Tutup modal"
                  className="absolute top-0 right-0 z-50"
                >
                  <img src={CloseIcon} alt="" className="size-7" />
                </button>
              </div>

              <p className="text-16 mt-6 bg-linear-to-b from-[#FFF6E3] to-[#FFBC81] bg-clip-text text-center leading-relaxed font-semibold text-transparent">
                Biaya Perbaikan Terlalu Besar?
                <br />
                Lindungi Mobil Anda dengan
                <br />
                AutoClaim
              </p>

              <div className="absolute inset-0 z-20 h-full w-full rounded-lg bg-linear-to-b from-[#2F569B] from-[55%] to-[#2F569B] opacity-5"></div>
              <div className="relative z-20 mt-10 flex h-[130px] w-full justify-center rounded-lg bg-white/20 pt-3">
                <p className="text-16 bg-linear-to-b from-[#FFFFFF] to-[#ADFCDD] bg-clip-text text-center font-[500] text-transparent">
                  Ingin klaim asuransi?
                </p>
              </div>

              <div className="relative z-30 mt-auto grid grid-cols-2 gap-3">
                <button
                  className="rounded-md bg-linear-to-b from-white to-[#CCCCCC] py-2"
                  onClick={handleUseInsurance}
                >
                  <p className="bg-linear-to-b from-[#5A7CBB] to-[#2B3D5E] bg-clip-text text-center font-[500] text-transparent">
                    Iya
                  </p>
                </button>

                <button
                  className="rounded-md bg-linear-to-b from-white to-[#CCCCCC] py-2"
                  onClick={handleSkipInsurance}
                >
                  <p className="bg-linear-to-b from-[#5A7CBB] to-[#2B3D5E] bg-clip-text text-center font-[500] text-transparent">
                    Tidak
                  </p>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </PageContainer>
  );
}
