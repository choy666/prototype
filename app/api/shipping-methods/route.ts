import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { shippingMethods } from '@/lib/schema';
import { eq } from 'drizzle-orm';

export async function GET() {
  try {
    const methods = await db
      .select()
      .from(shippingMethods)
      .where(eq(shippingMethods.isActive, true));

    return NextResponse.json(methods);
  } catch (error) {
    console.error('Error fetching shipping methods:', error);
    return NextResponse.json(
      { error: 'Error al cargar métodos de envío' },
      { status: 500 }
    );
  }
}
