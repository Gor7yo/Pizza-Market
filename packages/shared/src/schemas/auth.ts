import { z } from 'zod';
import { LOCALES } from '../locale';
import { emailSchema, nameSchema, V } from './common';

export const passwordSchema = z
  .string({ error: V.required })
  .min(8, V.passwordMin)
  .max(128, V.tooLong)
  .regex(/\p{L}/u, V.passwordWeak)
  .regex(/\d/, V.passwordWeak);

export const registerSchema = z.strictObject({
  email: emailSchema,
  password: passwordSchema,
  firstName: nameSchema,
  lastName: z.string().trim().max(60, V.tooLong).optional(),
  locale: z.enum(LOCALES).optional(),
});
export type RegisterInput = z.input<typeof registerSchema>;

export const loginSchema = z.strictObject({
  email: emailSchema,
  password: z.string({ error: V.required }).min(1, V.required).max(128, V.tooLong),
});
export type LoginInput = z.input<typeof loginSchema>;

export const verificationCodeSchema = z
  .string({ error: V.required })
  .trim()
  .regex(/^\d{6}$/, V.codeFormat);

export const verifyEmailSchema = z.strictObject({
  email: emailSchema,
  code: verificationCodeSchema,
});
export type VerifyEmailInput = z.input<typeof verifyEmailSchema>;

export const emailOnlySchema = z.strictObject({ email: emailSchema });
export type EmailOnlyInput = z.input<typeof emailOnlySchema>;

export const resetPasswordSchema = z.strictObject({
  token: z.string({ error: V.required }).min(32, V.invalid).max(200, V.invalid),
  password: passwordSchema,
});
export type ResetPasswordInput = z.input<typeof resetPasswordSchema>;

export const changePasswordSchema = z.strictObject({
  /** Absent only for accounts created through Google that never had a password. */
  currentPassword: z.string().max(128, V.tooLong).optional(),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.input<typeof changePasswordSchema>;
