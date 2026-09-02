import { Outlet } from 'react-router-dom';
import { PageContainer } from './PageContainer';
import { BottomNav } from './BottomNav';
import { ActiveTowingBar } from '@/features/towing/components/ActiveTowingBar';

/** Layout untuk halaman bertab (Beranda & Profil) dengan navigasi bawah. */
export function AppShell() {
  return (
    <PageContainer>
      <main className="flex-1">
        <Outlet />
      </main>
      {/* <div className="h-20" /> */}
      <ActiveTowingBar />
      <BottomNav />
    </PageContainer>
  );
}
