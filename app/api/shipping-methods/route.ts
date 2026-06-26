import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { shippingMethods } from '@/lib/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { authOptions } from '@/lib/auth/session';
import type { ShippingMethod as DBShippingMethod } from '@/lib/schema';

export async function GET() {
  try {
    const methods = await db
      .select()
      .from(shippingMethods);

    return NextResponse.json(methods);
  } catch (error) {
    console.error('Error fetching shipping methods:', error);
    return NextResponse.json(
      { error: 'Error al cargar métodos de envío' },
      { status: 500 }
    );
  }
}

const updateShippingMethodSchema = z.object({
  id: z.number(),
  name: z.string().min(1).optional(),
  baseCost: z.number().nonnegative().optional(),
  freeThreshold: z.number().nonnegative().nullable().optional(),
  isActive: z.boolean().optional(),
});

export async function PUT(request: Request) {
  try {
    const session = await authOptions();

    if (!session?.user || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const payload = updateShippingMethodSchema.parse(body);

    const updateData: Partial<Pick<DBShippingMethod, 'name' | 'baseCost' | 'freeThreshold' | 'isActive' | 'updatedAt'>> = {};

    if (payload.name !== undefined) {
      updateData.name = payload.name;
    }
    if (payload.baseCost !== undefined) {
      updateData.baseCost = payload.baseCost.toString();
    }
    if (payload.freeThreshold !== undefined) {
      updateData.freeThreshold =
        payload.freeThreshold === null ? null : payload.freeThreshold.toString();
    }
    if (payload.isActive !== undefined) {
      updateData.isActive = payload.isActive;
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: 'No hay campos para actualizar' },
        { status: 400 }
      );
    }

    updateData.updatedAt = new Date();

    const [updated] = await db
      .update(shippingMethods)
      .set(updateData)
      .where(eq(shippingMethods.id, payload.id))
      .returning();

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating shipping method:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Error al actualizar método de envío' },
      { status: 500 }
    );
  }
}
