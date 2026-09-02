import { Component, type ErrorInfo, type ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  /** Ditampilkan menggantikan `children` bila terjadi galat. */
  fallback: ReactNode;
  /** Dipanggil sekali saat galat pertama tertangkap. */
  onError?: (error: Error) => void;
}

interface ErrorBoundaryState {
  failed: boolean;
}

/**
 * Menahan galat render agar tidak menjatuhkan seluruh halaman.
 *
 * `Suspense` TIDAK menangkap galat — ia hanya menunggu. Jadi komponen yang
 * dimuat malas dan melempar saat render (mis. WebGL tidak tersedia, atau
 * berkas chunk-nya hilang setelah rilis baru) akan mengosongkan layar sampai
 * ke akar, bukan sekadar gagal di bagiannya sendiri.
 *
 * Kelas, bukan fungsi: React hanya menyediakan pengait penangkap galat lewat
 * `componentDidCatch`/`getDerivedStateFromError`, dan keduanya belum punya
 * padanan pada komponen fungsi.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // Dicatat, bukan ditelan diam-diam: cadangan yang bekerja terlalu rapi
    // membuat kerusakan nyata tidak pernah ketahuan.
    console.error('ErrorBoundary:', error, info.componentStack);
    this.props.onError?.(error);
  }

  override render(): ReactNode {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}
