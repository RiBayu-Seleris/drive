import { useState, type FormEvent, type ReactNode } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { PageContainer } from '@/components/layout/PageContainer';
import { AppHeader } from '@/components/layout/AppHeader';
import { Input } from '@/components/ui/Input';
import { TextArea } from '@/components/ui/TextArea';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/feedback/StateViews';
import { toast } from '@/components/feedback/toast';
import { extractErrorMessage } from '@/lib/api/client';
import { formatCurrency } from '@/lib/utils/format';
import { normalizePlate, isValidPlate } from '@/features/vehicle-scan/utils/plate';
import { useAuthStore } from '@/features/auth/store/authStore';
import { useDamageStore } from '@/features/damage/store/damageStore';
import { useScanStore } from '@/features/vehicle-scan/store/scanStore';
import { ROUTES, buildPath } from '@/app/routes';
import { purchaseInsurance, type InsuranceProduct } from '../api';

const PERIODS = [
  { months: 12, label: '12 bulan' },
  { months: 24, label: '24 bulan' },
  { months: 36, label: '36 bulan' },
];

const PAYMENT_METHODS = [
  { value: 'BANK_TRANSFER', label: 'Transfer Bank' },
  { value: 'CREDIT_CARD', label: 'Kartu Kredit' },
  { value: 'EWALLET', label: 'E-Wallet' },
  { value: 'QRIS', label: 'QRIS' },
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function calculatePremium(product: InsuranceProduct, periodMonths: number) {
  const annualPremium = product.annualPremium ?? 0;
  const monthlyPremium = product.monthlyPremium ?? 0;
  if (annualPremium > 0 && periodMonths >= 12) {
    const years = Math.floor(periodMonths / 12);
    const remainingMonths = periodMonths % 12;
    return years * annualPremium + remainingMonths * monthlyPremium;
  }
  return monthlyPremium * periodMonths;
}

type InsuranceRouteState =
  | InsuranceProduct
  | { product?: InsuranceProduct; requiresDamageFreeScan?: boolean }
  | null;

function isInsuranceRouteWrapper(
  state: Exclude<InsuranceRouteState, null>,
): state is { product?: InsuranceProduct; requiresDamageFreeScan?: boolean } {
  return 'product' in state || 'requiresDamageFreeScan' in state;
}

function routeProduct(state: InsuranceRouteState): InsuranceProduct | null {
  if (!state) return null;
  if (isInsuranceRouteWrapper(state)) return state.product ?? null;
  return state;
}

export function InsurancePurchasePage() {
  const navigate = useNavigate();
  const locationState = useLocation().state as InsuranceRouteState;
  const product = routeProduct(locationState);
  const user = useAuthStore((s) => s.user);
  const damageResult = useDamageStore((s) => s.result);
  // Asuransi hanya bisa dibeli untuk kendaraan tanpa kerusakan: wajib ada hasil
  // scan 0% pada SEMUA flow pembelian (bukan hanya jalur Bantuan Darurat).
  const damageFreeOk = Boolean(damageResult && damageResult.repair.percentage <= 0);

  const [plate, setPlate] = useState('');
  const [holderName, setHolderName] = useState(user?.fullname ?? '');
  const [holderNik, setHolderNik] = useState('');
  const [holderPhone, setHolderPhone] = useState(user?.phone ?? '');
  const [holderEmail, setHolderEmail] = useState(user?.email ?? '');
  const [holderAddress, setHolderAddress] = useState('');
  const [holderCity, setHolderCity] = useState('');
  const [holderPostalCode, setHolderPostalCode] = useState('');
  const [holderBirthDate, setHolderBirthDate] = useState('');
  const [vehicleBrand, setVehicleBrand] = useState('');
  const [vehicleModel, setVehicleModel] = useState('');
  const [vehicleYear, setVehicleYear] = useState('');
  const [vehicleChassisNumber, setVehicleChassisNumber] = useState('');
  const [vehicleEngineNumber, setVehicleEngineNumber] = useState('');
  const [vehicleColor, setVehicleColor] = useState('');
  const [vehicleUsage, setVehicleUsage] = useState('PRIVATE');
  const [registrationArea, setRegistrationArea] = useState('');
  const [estimatedVehicleValue, setEstimatedVehicleValue] = useState('');
  const [coverageStartDate, setCoverageStartDate] = useState(todayISO());
  const [period, setPeriod] = useState(12);
  const [paymentMethod, setPaymentMethod] = useState('BANK_TRANSFER');
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [declarationAccepted, setDeclarationAccepted] = useState(false);
  const [plateError, setPlateError] = useState<string | null>(null);

  const basePremium = product ? calculatePremium(product, period) : 0;
  const adminFee = product?.adminFee ?? 0;
  const stampDutyFee = product?.stampDutyFee ?? 0;
  const totalAmount = basePremium + adminFee + stampDutyFee;

  const mutation = useMutation({
    mutationFn: () =>
      purchaseInsurance({
        productCode: product!.code,
        vehiclePlate: normalizePlate(plate),
        holderName: holderName.trim(),
        holderNik: holderNik.trim(),
        holderPhone: holderPhone.trim(),
        holderEmail: holderEmail.trim(),
        holderAddress: holderAddress.trim(),
        holderCity: holderCity.trim(),
        holderPostalCode: holderPostalCode.trim(),
        holderBirthDate,
        vehicleBrand: vehicleBrand.trim(),
        vehicleModel: vehicleModel.trim(),
        vehicleYear: Number(vehicleYear),
        vehicleChassisNumber: vehicleChassisNumber.trim(),
        vehicleEngineNumber: vehicleEngineNumber.trim(),
        vehicleColor: vehicleColor.trim(),
        vehicleUsage,
        registrationArea: registrationArea.trim(),
        estimatedVehicleValue: Number(estimatedVehicleValue),
        periodMonths: period,
        coverageStartDate,
        paymentMethod,
        termsAccepted,
        declarationAccepted,
      }),
		onSuccess: (policy) => {
			if (product?.surveyRequired) {
				toast.success('Pengajuan dikirim, menunggu survei.');
				navigate(buildPath.insurancePolicyDetail(policy.policyNumber), { replace: true });
				return;
			}
			navigate(ROUTES.payment, {
				replace: true,
				state: {
					payment_type: 'POLICY_PREMIUM',
					policy_number: policy.policyNumber,
					amount: policy.totalAmount,
					item_name: `Premi ${policy.productName}`,
					redirect_route: ROUTES.insurancePolicies,
				},
			});
    },
    onError: (error) => toast.error(extractErrorMessage(error, 'Pembelian polis gagal.')),
  });

  if (!product) {
    return (
      <PageContainer>
        <AppHeader title="Beli Asuransi" />
        <EmptyState
          title="Produk tidak ditemukan"
          action={
            <Button fullWidth={false} onClick={() => navigate(ROUTES.insuranceSearch)}>
              Lihat Produk
            </Button>
          }
        />
      </PageContainer>
    );
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const normalizedPlate = normalizePlate(plate);
    if (!isValidPlate(normalizedPlate)) {
      setPlateError('Format plat tidak valid. Contoh: B 1234 ABC');
      return;
    }
    setPlateError(null);
    if (!/^\d{16}$/.test(holderNik.trim())) {
      toast.error('NIK harus 16 digit.');
      return;
    }
    if (!holderPhone.trim() || !holderAddress.trim() || !holderCity.trim()) {
      toast.error('Lengkapi data pemegang polis.');
      return;
    }
    if (!vehicleBrand.trim() || !vehicleModel.trim() || !Number(vehicleYear)) {
      toast.error('Lengkapi data kendaraan.');
      return;
    }
    if (Number(estimatedVehicleValue) <= 0) {
      toast.error('Estimasi nilai kendaraan wajib diisi.');
      return;
    }
    if (!termsAccepted || !declarationAccepted) {
      toast.error('Persetujuan polis wajib dicentang.');
      return;
    }
    if (!damageFreeOk) {
      toast.error(
        'Pembelian asuransi memerlukan hasil scan kendaraan 0% kerusakan. Scan kendaraan Anda terlebih dahulu.',
      );
      return;
    }
    mutation.mutate();
  };

  // Arahkan ke alur scan untuk memperoleh hasil 0% sebelum membeli polis.
  const goScan = () => {
    useScanStore.getState().reset();
    useScanStore.getState().setScanPurpose('emergency_insurance');
    useDamageStore.getState().reset();
    navigate(ROUTES.checkCondition);
  };

  return (
    <PageContainer>
      <AppHeader title="Beli Polis" />
      <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 px-5 py-5">
        {!damageFreeOk && (
          <div className="border-warning/40 bg-warning/10 rounded-lg border p-4">
            <p className="text-14 font-semibold text-neutral-900">
              Scan kendaraan dulu (wajib 0% kerusakan)
            </p>
            <p className="text-12 mt-1 text-neutral-700">
              {damageResult
                ? `Hasil scan terakhir ${damageResult.repair.percentage.toFixed(0)}% kerusakan. Asuransi hanya bisa dibeli untuk kendaraan tanpa kerusakan.`
                : 'Asuransi hanya bisa dibeli untuk kendaraan tanpa kerusakan. Lakukan scan kendaraan terlebih dahulu.'}
            </p>
            <Button
              type="button"
              variant="outline"
              fullWidth={false}
              className="mt-3"
              onClick={goScan}
            >
              Scan Kendaraan
            </Button>
          </div>
        )}
        <Card className="space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-14 font-semibold text-neutral-900">{product.name}</p>
              <p className="text-12 text-neutral-700">{product.provider}</p>
            </div>
            <span className="bg-deep-blue-50 text-10 text-deep-blue-700 rounded-lg px-2.5 py-1 font-semibold">
              {product.coverageType || product.category}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <SummaryLine label="Limit" value={formatCurrency(product.claimLimit ?? 0)} />
            <SummaryLine
              label="Risiko sendiri"
              value={formatCurrency(product.deductibleAmount ?? 0)}
            />
          </div>
        </Card>

        <Section title="Pemegang Polis">
          <Input
            label="Nama Lengkap"
            placeholder="Nama sesuai KTP"
            value={holderName}
            onChange={(e) => setHolderName(e.target.value)}
          />
          <Input
            label="NIK"
            inputMode="numeric"
            maxLength={16}
            placeholder="16 digit NIK"
            value={holderNik}
            onChange={(e) => setHolderNik(e.target.value.replace(/\D/g, '').slice(0, 16))}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Nomor HP"
              type="tel"
              placeholder="08xxxxxxxxxx"
              value={holderPhone}
              onChange={(e) => setHolderPhone(e.target.value)}
            />
            <Input
              label="Email"
              type="email"
              placeholder="nama@email.com"
              value={holderEmail}
              onChange={(e) => setHolderEmail(e.target.value)}
            />
          </div>
          <Input
            label="Tanggal Lahir"
            type="date"
            value={holderBirthDate}
            onChange={(e) => setHolderBirthDate(e.target.value)}
          />
          <TextArea
            label="Alamat Domisili"
            rows={3}
            placeholder="Alamat lengkap"
            value={holderAddress}
            onChange={(e) => setHolderAddress(e.target.value)}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Kota"
              placeholder="Jakarta Selatan"
              value={holderCity}
              onChange={(e) => setHolderCity(e.target.value)}
            />
            <Input
              label="Kode Pos"
              inputMode="numeric"
              placeholder="12345"
              value={holderPostalCode}
              onChange={(e) => setHolderPostalCode(e.target.value.replace(/\D/g, '').slice(0, 16))}
            />
          </div>
        </Section>

        <Section title="Kendaraan">
          <Input
            label="Plat Nomor"
            placeholder="B 1234 ABC"
            value={plate}
            onChange={(e) => setPlate(e.target.value.toUpperCase())}
            error={plateError ?? undefined}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Merek"
              placeholder="Toyota"
              value={vehicleBrand}
              onChange={(e) => setVehicleBrand(e.target.value)}
            />
            <Input
              label="Model/Tipe"
              placeholder="Avanza 1.5 G"
              value={vehicleModel}
              onChange={(e) => setVehicleModel(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Tahun"
              type="number"
              inputMode="numeric"
              placeholder="2022"
              value={vehicleYear}
              onChange={(e) => setVehicleYear(e.target.value)}
            />
            <SelectField
              label="Penggunaan"
              value={vehicleUsage}
              onChange={setVehicleUsage}
              options={[
                { value: 'PRIVATE', label: 'Pribadi' },
                { value: 'COMMERCIAL', label: 'Komersial' },
              ]}
            />
          </div>
          <Input
            label="Estimasi Nilai Kendaraan"
            type="number"
            inputMode="numeric"
            placeholder="150000000"
            value={estimatedVehicleValue}
            onChange={(e) => setEstimatedVehicleValue(e.target.value)}
          />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Nomor Rangka"
              placeholder="Opsional"
              value={vehicleChassisNumber}
              onChange={(e) => setVehicleChassisNumber(e.target.value.toUpperCase())}
            />
            <Input
              label="Nomor Mesin"
              placeholder="Opsional"
              value={vehicleEngineNumber}
              onChange={(e) => setVehicleEngineNumber(e.target.value.toUpperCase())}
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Warna"
              placeholder="Hitam"
              value={vehicleColor}
              onChange={(e) => setVehicleColor(e.target.value)}
            />
            <Input
              label="Wilayah Registrasi"
              placeholder="B"
              value={registrationArea}
              onChange={(e) => setRegistrationArea(e.target.value.toUpperCase())}
            />
          </div>
        </Section>

        <Section title="Perlindungan">
          <Input
            label="Tanggal Mulai"
            type="date"
            value={coverageStartDate}
            onChange={(e) => setCoverageStartDate(e.target.value)}
          />
          <div>
            <p className="text-14 mb-1.5 font-medium text-neutral-900">Periode</p>
            <div className="grid grid-cols-3 gap-2">
              {PERIODS.map((p) => (
                <button
                  key={p.months}
                  type="button"
                  onClick={() => setPeriod(p.months)}
                  className={`text-12 rounded-lg border py-2.5 font-medium ${
                    period === p.months
                      ? 'border-deep-blue-500 bg-deep-blue-50 text-deep-blue-600'
                      : 'border-neutral-400 text-neutral-700'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>
          <SelectField
            label="Metode Pembayaran"
            value={paymentMethod}
            onChange={setPaymentMethod}
            options={PAYMENT_METHODS}
          />
        </Section>

        <Card className="bg-deep-blue-50 space-y-2">
          <PriceRow label="Premi" value={basePremium} />
          <PriceRow label="Biaya admin" value={adminFee} />
          <PriceRow label="Meterai" value={stampDutyFee} />
          <div className="border-deep-blue-100 border-t pt-2">
            <PriceRow label="Total bayar" value={totalAmount} strong />
          </div>
        </Card>

        <div className="space-y-3 rounded-lg border border-neutral-300 bg-white p-4">
          <CheckRow
            checked={declarationAccepted}
            onChange={setDeclarationAccepted}
            label="Saya menyatakan data kendaraan dan pemegang polis benar."
          />
          <CheckRow
            checked={termsAccepted}
            onChange={setTermsAccepted}
            label="Saya menyetujui syarat polis dan ketentuan pengecualian."
          />
        </div>

        <div className="mt-auto pt-2">
          <Button
            type="submit"
            size="lg"
            isLoading={mutation.isPending}
            disabled={
              mutation.isPending ||
              !damageFreeOk ||
              !holderName.trim() ||
              !holderNik.trim() ||
              !holderPhone.trim() ||
              !holderEmail.trim() ||
              !plate.trim() ||
              !vehicleBrand.trim() ||
              !vehicleModel.trim()
            }
          >
            Ajukan Polis
          </Button>
        </div>
      </form>
    </PageContainer>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Card className="space-y-3">
      <h2 className="text-14 font-semibold text-neutral-900">{title}</h2>
      {children}
    </Card>
  );
}

function SummaryLine({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-10 font-medium text-neutral-600 uppercase">{label}</p>
      <p className="text-12 font-semibold text-neutral-900">{value}</p>
    </div>
  );
}

function PriceRow({
  label,
  value,
  strong = false,
}: {
  label: string;
  value: number;
  strong?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span
        className={strong ? 'text-14 font-semibold text-neutral-900' : 'text-12 text-neutral-700'}
      >
        {label}
      </span>
      <span
        className={
          strong ? 'text-16 text-deep-blue-700 font-bold' : 'text-13 font-semibold text-neutral-900'
        }
      >
        {formatCurrency(value)}
      </span>
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="block">
      <span className="mb-2 block text-sm font-medium text-neutral-800">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="focus:border-deep-blue-500 focus:ring-deep-blue-200 block h-10 w-full rounded-lg border border-gray-300 bg-white px-4 text-sm text-neutral-900 shadow-sm transition focus:ring-2 focus:outline-none"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

function CheckRow({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
}) {
  return (
    <label className="text-12 flex items-start gap-3 font-medium text-neutral-800">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="text-deep-blue-600 focus:ring-deep-blue-200 mt-0.5 h-4 w-4 rounded border-neutral-400"
      />
      <span>{label}</span>
    </label>
  );
}
