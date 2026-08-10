import { useQuery } from '@tanstack/react-query';
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
import { getInsurancePolicies, type InsurancePolicy } from '../api';

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
	const query = useQuery({ queryKey: ['insurance-policies'], queryFn: getInsurancePolicies });
	const policy = query.data?.find((item) => item.policyNumber === policyNumber);

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
	const underwritingApproved = policy.underwritingStatus === 'APPROVED';
	const underwritingRejected = policy.underwritingStatus === 'REJECTED';
	return (
		<PageContainer>
			<AppHeader title="Detail Polis" />
			<div className="flex flex-1 flex-col gap-4 px-5 py-5">
				<Card className="space-y-3">
					<div className="flex items-start justify-between gap-3">
						<div><p className="text-16 font-bold text-neutral-900">{policy.productName}</p><p className="text-12 text-neutral-600">{policy.provider}</p></div>
						<Badge tone={underwritingRejected ? 'red' : policy.status === 'ACTIVE' ? 'green' : waitingSurvey ? 'yellow' : 'blue'}>{policy.status}</Badge>
					</div>
					<DetailRow label="Nomor polis" value={policy.policyNumber} />
					<DetailRow label="Kendaraan" value={`${policy.vehiclePlate} · ${policy.vehicleBrand} ${policy.vehicleModel}`} />
					<DetailRow label="Total premi" value={formatCurrency(policy.totalAmount)} />
					<DetailRow label="Status pembayaran" value={policy.paymentStatus} />
				</Card>
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
					<Button onClick={() => navigate(ROUTES.payment, { state: { payment_type: 'POLICY_PREMIUM', policy_number: policy.policyNumber, amount: policy.totalAmount, item_name: `Premi ${policy.productName}`, redirect_route: ROUTES.insurancePolicies } })}>
						Bayar Premi
					</Button>
				)}
			</div>
		</PageContainer>
	);
}

function DetailRow({ label, value }: { label: string; value: string }) {
	return <div className="flex justify-between gap-4 text-13"><span className="text-neutral-600">{label}</span><span className="text-right font-medium text-neutral-900">{value}</span></div>;
}
