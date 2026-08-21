import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().min(1, 'Email tidak boleh kosong.').email('Format email tidak valid.'),
  password: z.string().min(8, 'Kata sandi minimal 8 karakter.'),
});
export type LoginValues = z.infer<typeof loginSchema>;

export const registerSchema = z
  .object({
    fullname: z.string().min(1, 'Nama lengkap tidak boleh kosong.'),
    email: z.string().min(1, 'Email tidak boleh kosong.').email('Format email tidak valid.'),
    password: z.string().min(8, 'Kata sandi minimal 8 karakter.'),
    retypePassword: z.string().min(1, 'Konfirmasi kata sandi tidak boleh kosong.'),
  })
  .refine((data) => data.password === data.retypePassword, {
    message: 'Konfirmasi kata sandi tidak cocok.',
    path: ['retypePassword'],
  });
export type RegisterValues = z.infer<typeof registerSchema>;

export const forgotPasswordSchema = z.object({
  email: z.string().min(1, 'Email tidak boleh kosong.').email('Format email tidak valid.'),
});
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z
  .object({
    newPassword: z.string().min(8, 'Kata sandi minimal 8 karakter.'),
    retypePassword: z.string().min(1, 'Konfirmasi kata sandi tidak boleh kosong.'),
  })
  .refine((data) => data.newPassword === data.retypePassword, {
    message: 'Konfirmasi kata sandi tidak cocok.',
    path: ['retypePassword'],
  });
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
