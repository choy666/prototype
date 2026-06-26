import { NextResponse } from 'next/server';
import { auth } from '@/lib/actions/auth';
import { db } from '@/lib/db';
import { productAttributes } from '@/lib/schema';
import { eq } from 'drizzle-orm';

type RawAttributeValue = {
  name?: string | null;
  mlValueId?: string | null;
};

type ValueSuggestion = {
  name: string;
  mlValueId?: string | null;
};

const normalize = (value: string) => value.trim().toLowerCase();

export async function GET(
  request: Request,
  { params }: { params: Promise<{ attributeName: string }> },
) {
  try {
    const session = await auth();
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { attributeName } = await params;
    const rawName = attributeName ?? '';
    const normalizedName = normalize(rawName);

    if (!normalizedName) {
      return NextResponse.json({ error: 'Attribute name is required' }, { status: 400 });
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') ?? '';
    const normalizedQ = q.trim().toLowerCase();

    // Buscar el atributo en product_attributes por nombre normalizado
    const rows = await db.select().from(productAttributes).where(eq(productAttributes.name, rawName));

    // Si no hay coincidencia exacta por nombre, intentar fallback por comparación en memoria
    const attrRow =
      rows[0] ??
      (
        (await db.select().from(productAttributes)).find(
          (row) => typeof row.name === 'string' && normalize(row.name) === normalizedName,
        ) || null
      );

    if (!attrRow) {
      // Sin configuración de catálogo para este atributo: devolver lista vacía
      return NextResponse.json<ValueSuggestion[]>([]);
    }

    const rawValues = (attrRow as unknown as { values?: unknown }).values;
    const valuesArray = Array.isArray(rawValues) ? (rawValues as RawAttributeValue[]) : [];

    const suggestions: ValueSuggestion[] = valuesArray
      .filter((v) => {
        const name = typeof v.name === 'string' ? v.name : '';
        if (!name.trim()) return false;
        if (!normalizedQ) return true;
        return name.toLowerCase().includes(normalizedQ);
      })
      .slice(0, 20)
      .map((v) => ({
        name: (v.name as string).trim(),
        mlValueId: v.mlValueId ?? null,
      }));

    return NextResponse.json(suggestions);
  } catch (error) {
    console.error('Error fetching ML attribute value suggestions:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
