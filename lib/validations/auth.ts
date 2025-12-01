import { z } from 'zod';

const documentTypeEnum = z.enum(['DNI', 'CUIT']);

export const userSchema = z.object({
  name: z
    .string()
    .min(2, 'El nombre debe tener al menos 2 caracteres')
    .max(50, 'El nombre no puede tener más de 50 caracteres')
    .regex(/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/, 'El nombre solo puede contener letras y espacios')
    .trim(),
  email: z
    .string()
    .email('Email inválido')
    .min(1, 'El email es requerido')
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(8, 'La contraseña debe tener al menos 8 caracteres')
    .regex(/[A-Z]/, 'Debe contener al menos una letra mayúscula')
    .regex(/[a-z]/, 'Debe contener al menos una letra minúscula')
    .regex(/[0-9]/, 'Debe contener al menos un número')
    .regex(/[^A-Za-z0-9]/, 'Debe contener al menos un carácter especial'),
  role: z.enum(['user', 'admin']).default('user'),
});

export const loginSchema = z.object({
  email: z
    .string()
    .email('Email inválido')
    .min(1, 'El email es requerido')
    .toLowerCase()
    .trim(),
  password: z
    .string()
    .min(1, 'La contraseña es requerida')
    .min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

export const registerSchema = userSchema
  .pick({ name: true, email: true, password: true })
  .extend({
    confirmPassword: z.string().min(1, 'Por favor confirma tu contraseña'),
    documentType: documentTypeEnum.optional(),
    documentNumber: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.password !== data.confirmPassword) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Las contraseñas no coinciden',
        path: ['confirmPassword'],
      });
    }

    if (data.documentType && !data.documentNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El número de documento es requerido',
        path: ['documentNumber'],
      });
    }

    if (!data.documentType && data.documentNumber) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El tipo de documento es requerido',
        path: ['documentType'],
      });
    }

    if (data.documentType && data.documentNumber) {
      const num = data.documentNumber.replace(/\D/g, '');

      if (!/^\d+$/.test(num)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'El documento solo puede contener números',
          path: ['documentNumber'],
        });
        return;
      }

      if (data.documentType === 'DNI') {
        if (num.length < 7 || num.length > 8) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'El DNI debe tener entre 7 y 8 dígitos',
            path: ['documentNumber'],
          });
        }
      }

      if (data.documentType === 'CUIT') {
        if (num.length !== 11 || !isValidCUIT(num)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'El CUIT debe ser un número válido de 11 dígitos',
            path: ['documentNumber'],
          });
        }
      }
    }
  });

export const userResponseSchema = z.object({
  id: z.string(),
  name: z.string().nullable(),
  email: z.string().email(),
  role: z.enum(['user', 'admin']).optional(),
  image: z.string().nullable().optional(),
});

// Tipos
export type UserResponse = z.infer<typeof userResponseSchema>;
export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;
export type UserRole = 'user' | 'admin';

function isValidCUIT(value: string): boolean {
  const cuit = value.replace(/\D/g, '');
  if (cuit.length !== 11) return false;

  const digits = cuit.split('').map((d) => parseInt(d, 10));
  const multipliers = [5, 4, 3, 2, 7, 6, 5, 4, 3, 2];

  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += digits[i] * multipliers[i];
  }

  const mod11 = sum % 11;
  let checkDigit = 11 - mod11;
  if (checkDigit === 11) checkDigit = 0;
  if (checkDigit === 10) checkDigit = 9;

  return digits[10] === checkDigit;
}