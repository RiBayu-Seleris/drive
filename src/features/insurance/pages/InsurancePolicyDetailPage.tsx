import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router-dom';
import { AppHeader } from '@/components/layout/AppHeader';
import { PageContainer } from '@/components/layout/PageContainer';
import { EmptyState, ErrorState } from '@/components/feedback/StateViews';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { LoadingState } from '@/components/ui/Spinner';
import { ROUTES } from '@/app/routes';
import { formatCurrency } from '@/lib/utils/format';
import { extractErrorMessage } from '@/lib/api/client';
import { toast } from '@/components/feedback/toast';
import { cancelInsurancePolicyOrder, getInsurancePolicies, type InsurancePolicy } from '../api';

function canPay(policy: InsurancePolicy): boolean {
	return (
		policy.status === 'PENDING' &&
		policy.paymentStatus === 'PENDING' &&
		(policy.underwritingStatus === 'NOT_REQUIRED' || policy.underwritingStatus === 'APPROVED')
	);
}

export function InsurancePolicyDetailPage() {
	const navigate = useNavigate();
	const { policyNumber = '' } = useParams();
	const queryClient = useQueryClient();
	const query = useQuery({ queryKey: ['insurance-policies'], queryFn: getInsurancePolicies });
	const policy = query.data?.find((item) => item.policyNumber === policyNumber);
	const cancelOrder = useMutation({
		mutationFn: () => cancelInsurancePolicyOrder(policyNumber),
		onSuccess: () => {
			toast.success('Pesanan dibatalkan.');
			void queryClient.invalidateQueries({ queryKey: ['insurance-policies'] });
			navigate(ROUTES.insurancePolicies);
		},
		onError: (error) => toast.error(extractErrorMessage(error, 'Pesanan gagal dibatalkan.')),
	});

	if (query.isLoading) {
		return <PageContainer><AppHeader title="Detail Polis" /><LoadingState label="Memuat polis…" /></PageContainer>;
	}
	if (query.isError) {
		return <PageContainer><AppHeader title="Detail Polis" /><ErrorState title="Polis tidak dapat dimuat" /></PageContainer>;
	}
	if (!policy) {
		return <PageContainer><AppHeader title="Detail Polis" /><EmptyState title="Polis tidak ditemukan" /></PageContainer>;
	}

	const waitingSurvey = policy.underwritingStatus === 'SURVEY_REQUIRED';
	const waitingStart = policy.status === 'SCHEDULED';
	const underwritingApproved = policy.underwritingStatus === 'APPROVED';
	const underwritingRejected = policy.underwritingStatus === 'REJECTED';
	return (
		<PageContainer>
			<AppHeader title="Detail Polis" />
			<div className="flex flex-1 flex-col gap-4 px-5 py-5">
				<Card className="space-y-3">
					<div className="flex items-start justify-between gap-3">
						<div><p className="text-16 font-bold text-neutral-900">{policy.productName}</p><p className="text-12 text-neutral-600">{policy.provider}</p></div>
						<Badge tone={underwritingRejected ? 'red' : policy.status === 'ACTIVE' ? 'green' : waitingSurvey ? 'yellow' : 'blue'}>{waitingStart ? 'Menunggu tanggal aktif' : policy.status}</Badge>
					</div>
					<DetailRow label="Nomor polis" value={policy.policyNumber} />
					<DetailRow label="Kendaraan" value={`${policy.vehiclePlate} · ${policy.vehicleBrand} ${policy.vehicleModel}`} />
					<DetailRow label="Total premi" value={formatCurrency(policy.totalAmount)} />
					<DetailRow label="Status pembayaran" value={policy.paymentStatus} />
				</Card>
				{waitingStart && (
					<Card className="border-deep-blue-500/40 bg-deep-blue-50 text-13 text-neutral-800">
						<p className="font-semibold">Polis sudah aktif dibeli, menunggu tanggal berlaku</p>
						<p className="mt-1">
							Produk ini punya masa tunggu. Perlindungan dan pengajuan klaim dimulai{' '}
							{formatPolicyDate(policy.startedAt)}.
						</p>
					</Card>
				)}
				{waitingSurvey && <Card className="border-warning/40 bg-warning/10 text-13 text-neutral-800">Menunggu survei. Premi belum dapat dibayar.</Card>}
				{underwritingApproved && policy.status === 'PENDING' && (
					<Card className="border-green-cust/40 bg-green-cust/10 text-13 text-neutral-800">Disetujui — silakan bayar premi.</Card>
				)}
				{underwritingRejected && (
					<Card className="border-danger/40 bg-danger/10 text-13 text-neutral-800">
						<p className="font-semibold">Ditolak</p>
						{policy.underwritingNotes && <p className="mt-1">{policy.underwritingNotes}</p>}
					</Card>
				)}
				{canPay(policy) && (
					<>
						<Card className="border-neutral-400 bg-neutral-100 text-13 text-neutral-800">
							Pesanan yang tidak dibayar dalam 24 jam akan hangus otomatis, dan kendaraan ini
							bisa dibelikan polis lain setelahnya.
						</Card>
						<Button onClick={() => navigate(ROUTES.payment, { state: { payment_type: 'POLICY_PREMIUM', policy_number: policy.policyNumber, amount: policy.totalAmount, item_name: `Premi ${policy.productName}`, redirect_route: ROUTES.insurancePolicies } })}>
							Bayar Premi
						</Button>
						{/*
						 * Jalan keluar untuk yang salah memilih produk. Tanpa ini, plat yang
						 * sama terkunci sampai pesanannya hangus sendiri.
						 */}
						<Button
							variant="secondary"
							isLoading={cancelOrder.isPending}
							onClick={() => {
								if (window.confirm('Batalkan pesanan ini? Anda bisa memesan produk lain setelahnya.')) {
									cancelOrder.mutate();
								}
							}}
						>
							Batalkan Pesanan
						</Button>
					</>
				)}
			</div>
		</PageContainer>
	);
}

function formatPolicyDate(value: string | undefined): string {
	if (!value) return 'tanggal yang tertera di polis';
	const date = new Date(value);
	if (Number.isNaN(date.getTime())) return 'tanggal yang tertera di polis';
	return new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}

function DetailRow({ label, value }: { label: string; value: string }) {
	return <div className="flex justify-between gap-4 text-13"><span className="text-neutral-600">{label}</span><span className="text-right font-medium text-neutral-900">{value}</span></div>;
}
