import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { AuthLayout } from '@/components/layout/AuthLayout';
import { Button } from '@/components/ui/Button';
import { toast } from '@/components/feedback/toast';
import { extractErrorMessage } from '@/lib/api/client';
import { ROUTES } from '@/app/routes';
import { loginTargetForRole, requestPasswordReset, verifyPasswordResetCode } from '../api/authApi';
import { OtpCodeInput } from '../components/OtpCodeInput';
import {
  CODE_LIFETIME_SECONDS,
  DEFAULT_RESEND_COOLDOWN,
  OTP_CODE_LENGTH,
  focusFirstOtpInput,
  formatClock,
  maskEmail,
} from '../otp';
import type { ResetPasswordState } from './ResetPasswordPage';

/** Dibawa dari halaman "Lupa Kata Sandi". */
export interface VerifyResetCodeState {
  email: string;
}

function readState(state: unknown): VerifyResetCodeState | null {
  if (!state || typeof state !== 'object') return null;
  const email = (state as Record<string, unknown>).email;
  if (typeof email !== 'string' || !email.trim()) return null;
  return { email: email.trim() };
}

export function VerifyResetCodePage() {
  const navigate = useNavigate();
  const location = useLocation();
  const state = useMemo(() => readState(location.state), [location.state]);

  const [code, setCode] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendIn, setResendIn] = useState(DEFAULT_RESEND_COOLDOWN);
  const [expiresIn, setExpiresIn] = useState(CODE_LIFETIME_SECONDS);

  // Mencegah pengiriman ganda saat auto-submit dan klik tombol beriringan.
  const submittingRef = useRef(false);

  useEffect(() => {
    if (!state) {
      toast.error('Sesi tidak ditemukan. Mulai lagi dari Lupa Kata Sandi.');
      navigate(ROUTES.forgotPassword, { replace: true });
    }
  }, [state, navigate]);

  useEffect(() => {
    focusFirstOtpInput();
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const timer = window.setInterval(() => setResendIn((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [resendIn]);

  useEffect(() => {
    if (expiresIn <= 0) return;
    const timer = window.setInterval(() => setExpiresIn((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [expiresIn]);

  const submitCode = useCallback(
    async (value: string) => {
      if (!state || submittingRef.current) return;
      submittingRef.current = true;
      setIsVerifying(true);
      setErrorMessage('');
      try {
        const { resetToken, userRole } = await verifyPasswordResetCode(state.email, value);
        // Peran menentukan halaman masuk mana yang dituju setelah selesai,
        // jadi mitra yang masuk lewat halaman user pun tetap berakhir benar.
        const next: ResetPasswordState = {
          email: state.email,
          resetToken,
          loginTarget: loginTargetForRole(userRole),
        };
        navigate(ROUTES.resetPassword, { replace: true, state: next });
      } catch (error) {
        setErrorMessage(extractErrorMessage(error, 'Kode yang Anda masukkan salah.'));
        setCode('');
        focusFirstOtpInput();
      } finally {
        submittingRef.current = false;
        setIsVerifying(false);
      }
    },
    [state, navigate],
  );

  const handleResend = async () => {
    if (!state || resendIn > 0 || isResending) return;
    setIsResending(true);
    setErrorMessage('');
    try {
      const { cooldownSeconds } = await requestPasswordReset(state.email);
      setResendIn(cooldownSeconds || DEFAULT_RESEND_COOLDOWN);
      setExpiresIn(CODE_LIFETIME_SECONDS);
      setCode('');
      focusFirstOtpInput();
      toast.success('Kode baru sudah dikirim.');
    } catch (error) {
      setErrorMessage(extractErrorMessage(error, 'Gagal mengirim ulang kode.'));
    } finally {
      setIsResending(false);
    }
  };

  if (!state) return null;

  const isExpired = expiresIn <= 0;

  return (
    <AuthLayout
      title="Masukkan Kode"
      subtitle={`Kami mengirim kode 6 digit ke ${maskEmail(state.email)}. Masukkan kodenya untuk melanjutkan.`}
      footer={
        <button
          type="button"
          className="text-deep-blue-500 font-semibold"
          onClick={() => navigate(ROUTES.loginUser, { replace: true })}
        >
          Kembali ke halaman masuk
        </button>
      }
    >
      <div className="flex flex-col gap-4">
        <OtpCodeInput
          value={code}
          onChange={(value) => {
            setCode(value);
            setErrorMessage('');
          }}
          onComplete={(value) => void submitCode(value)}
          disabled={isVerifying}
          hasError={Boolean(errorMessage)}
        />

        {errorMessage && <p className="text-danger text-12 text-center">{errorMessage}</p>}

        <p className="text-12 text-center text-neutral-600">
          {isExpired ? (
            <span className="text-danger">Kode sudah kadaluarsa. Silakan kirim ulang.</span>
          ) : (
            <>
              Kode berlaku <span className="font-semibold">{formatClock(expiresIn)}</span>
            </>
          )}
        </p>

        <Button
          type="button"
          size="lg"
          isLoading={isVerifying}
          disabled={code.length !== OTP_CODE_LENGTH}
          onClick={() => void submitCode(code)}
        >
          Lanjutkan
        </Button>

        <Button
          type="button"
          variant="ghost"
          size="md"
          isLoading={isResending}
          disabled={resendIn > 0}
          onClick={() => void handleResend()}
        >
          {resendIn > 0 ? `Kirim ulang kode dalam ${resendIn} detik` : 'Kirim ulang kode'}
        </Button>

        <p className="text-12 text-center leading-5 text-neutral-500">
          Tidak menerima email? Periksa folder spam. Jangan berikan kode ini kepada siapa pun.
        </p>
      </div>
    </AuthLayout>
  );
}
