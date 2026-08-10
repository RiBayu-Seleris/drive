import { BarChart3, ClipboardList, FileText, Wallet, Wrench } from 'lucide-react';
import { ROUTES } from '@/app/routes';
import type { QuickAction } from '../types';

const TINT_BLUE = 'bg-deep-blue-50 text-deep-blue-600';
const TINT_GREEN = 'bg-green-cust/15 text-green-cust';
const TINT_AMBER = 'bg-warning/15 text-warning';
const TINT_RED = 'bg-[#E11D48]/10 text-[#E11D48]';

export const WORKSHOP_QUICK_ACTIONS: QuickAction[] = [
  { key: 'jobs', label: 'Antrian Pekerjaan', icon: ClipboardList, tint: TINT_BLUE, to: ROUTES.mitraWorkshopJobs },
  { key: 'inspection', label: 'Inspeksi Kendaraan', icon: Wrench, tint: TINT_AMBER, to: ROUTES.mitraWorkshopJobs },
  { key: 'reports', label: 'Laporan Bengkel', icon: FileText, tint: TINT_GREEN, to: ROUTES.mitraLaporan },
  { key: 'saldo', label: 'Tarik Saldo', icon: Wallet, tint: TINT_RED, to: ROUTES.mitraTarikSaldo },
  { key: 'transactions', label: 'Transaction report', icon: BarChart3, tint: TINT_BLUE, to: ROUTES.mitraSaldo },
];
