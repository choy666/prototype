import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { users } from '@/lib/schema';
import { auth } from '@/lib/actions/auth';
import { eq } from 'drizzle-orm';

const documentUpdateSchema = z.object({
  documentType: z.enum(['DNI', 'CUIT']).optional().nullable(),
  documentNumber: z.string().optional().nullable(),
}).superRefine((data, ctx) => {
  const type = data.documentType || undefined;
  const rawNumber = data.documentNumber || undefined;
  const number = rawNumber?.replace(/\D/g, '');

  if (!type && !rawNumber) {
    // Permitir limpiar ambos campos (sin documento)
    return;
  }

  if (type && !rawNumber) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'El número de documento es requerido',
      path: ['documentNumber'],
    });
    return;
  }

  if (!type && rawNumber) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'El tipo de documento es requerido',
      path: ['documentType'],
    });
    return;
  }

  if (!number || !/^\d+$/.test(number)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: 'El documento solo puede contener números',
      path: ['documentNumber'],
    });
    return;
  }

  if (type === 'DNI') {
    if (number.length < 7 || number.length > 8) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El DNI debe tener entre 7 y 8 dígitos',
        path: ['documentNumber'],
      });
    }
  }

  if (type === 'CUIT') {
    if (number.length !== 11 || !isValidCUIT(number)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'El CUIT debe ser un número válido de 11 dígitos',
        path: ['documentNumber'],
      });
    }
  }
});

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

export async function GET() {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  const userId = Number(session.user.id);

  const user = await db.query.users.findFirst({
    where: eq(users.id, userId),
    columns: {
      id: true,
      documentType: true,
      documentNumber: true,
    },
  });

  if (!user) {
    return NextResponse.json({ error: 'Usuario no encontrado' }, { status: 404 });
  }

  return NextResponse.json({
    documentType: user.documentType,
    documentNumber: user.documentNumber,
  });
}

export async function PUT(request: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: 'El cuerpo de la solicitud no es un JSON válido' },
      { status: 400 },
    );
  }

  const parsed = documentUpdateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Error de validación',
        details: parsed.error.issues.map((issue) => ({
          field: issue.path.join('.'),
          message: issue.message,
        })),
      },
      { status: 400 },
    );
  }

  const { documentType, documentNumber } = parsed.data;
  const userId = Number(session.user.id);

  const [updated] = await db
    .update(users)
    .set({
      documentType: documentType || null,
      documentNumber: documentNumber?.replace(/\D/g, '') || null,
    })
    .where(eq(users.id, userId))
    .returning({
      id: users.id,
      documentType: users.documentType,
      documentNumber: users.documentNumber,
    });

  return NextResponse.json({
    success: true,
    documentType: updated.documentType,
    documentNumber: updated.documentNumber,
  });
}
