import { z } from 'zod';

export const userSchema = z.object({
  email: z.string().email('Email inválido'),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
  role: z.enum(['user', 'admin'] as const).default('user'),
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
    .min(6, 'La contraseña debe tener al menos 6 caracteres'),
});

export const registerSchema = z
  .object({
    name: z
      .string()
      .min(2, 'El nombre debe tener al menos 2 caracteres')
      .max(50, 'El nombre no puede tener más de 50 caracteres')
      .trim(),
    email: z
      .string()
      .email('Email inválido')
      .min(1, 'El email es requerido')
      .toLowerCase()
      .trim(),
    password: z
      .string()
      .min(6, 'La contraseña debe tener al menos 6 caracteres')
      .regex(
        /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{6,}$/,
        'La contraseña debe contener al menos una mayúscula, una minúscula y un número'
      ),
    confirmPassword: z.string().min(1, 'Por favor confirma tu contraseña'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Las contraseñas no coinciden',
    path: ['confirmPassword'],
  });
  export const userResponseSchema = z.object({
    id: z.string(),
    name: z.string().nullable(),
    email: z.string().email(),
    role: z.enum(['user', 'admin']).optional(),
    image: z.string().nullable().optional(),
  });
export type UserResponse = z.infer<typeof userResponseSchema>;
export type LoginFormValues = z.infer<typeof loginSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;