/** Nilai & util bersama untuk layar berkode OTP (verifikasi email & lupa sandi). */

export const OTP_CODE_LENGTH = 6;
/** Selaras dengan OTPResendCooldown di backend. */
export const DEFAULT_RESEND_COOLDOWN = 60;
/** Selaras dengan OTPTTL di backend (5 menit). */
export const CODE_LIFETIME_SECONDS = 5 * 60;

export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const minutes = Math.floor(safe / 60);
  const seconds = safe % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/** Fokuskan kotak kode pertama — dipakai halaman saat kode direset. */
export function focusFirstOtpInput(): void {
  const first = document.querySelector<HTMLInputElement>('input[autocomplete="one-time-code"]');
  first?.focus();
}

/** Menyamarkan email di layar: budi@mail.com → b•••i@mail.com */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!local || !domain) return email;
  if (local.length <= 2) return `${local[0]}•••@${domain}`;
  return `${local[0]}•••${local[local.length - 1]}@${domain}`;
}
