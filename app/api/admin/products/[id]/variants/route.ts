import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/actions/auth";
import { db } from "@/lib/db";
import { productVariants } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

// Schema de validación para crear variante
const createVariantSchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  additionalAttributes: z.record(z.string(), z.string()).optional(),
  price: z.string(),
  stock: z.number().min(0).default(0),
  images: z.array(z.string()).min(1),
  isActive: z.boolean().default(true),
});

// Schema de validación para actualizar variante
const updateVariantSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  additionalAttributes: z.record(z.string(), z.string()).optional(),
  price: z.string().optional(),
  stock: z.number().min(0).optional(),
  images: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

type MlAttributeCombination = {
  id: string;
  name?: string;
  value_id?: string;
  value_name: string;
};

function buildMlAttributeCombinations(
  additionalAttributes?: Record<string, string> | null
): MlAttributeCombination[] | null {
  if (!additionalAttributes) return null;

  const combinations: MlAttributeCombination[] = [];

  for (const [key, value] of Object.entries(additionalAttributes)) {
    const lowerKey = key.toLowerCase();

    let attrId: string | null = null;
    let attrName: string | undefined = key;

    if (lowerKey.includes("color")) {
      // Atributo estándar de ML para color
      attrId = "COLOR";
      attrName = "Color";
    } else if (
      lowerKey.includes("talle") ||
      lowerKey.includes("talla") ||
      lowerKey.includes("size")
    ) {
      // Atributo estándar de ML para talla/tamaño
      attrId = "SIZE";
      attrName = "Talle";
    }

    // Si no es un atributo conocido, no generamos combinación ML automática
    if (!attrId) continue;

    combinations.push({
      id: attrId,
      name: attrName,
      value_name: value,
    });
  }

  return combinations.length > 0 ? combinations : null;
}

// GET /api/admin/products/[id]/variants - Listar variantes de un producto
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const productId = parseInt(id);

    if (isNaN(productId)) {
      return NextResponse.json({ error: "ID de producto inválido" }, { status: 400 });
    }

    const variants = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, productId))
      .orderBy(productVariants.created_at);

    return NextResponse.json(variants);
  } catch (error) {
    console.error("Error al obtener variantes:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// POST /api/admin/products/[id]/variants - Crear nueva variante
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const productId = parseInt(id);

    if (isNaN(productId)) {
      return NextResponse.json({ error: "ID de producto inválido" }, { status: 400 });
    }

    const body = await request.json();
    const validatedData = createVariantSchema.parse(body);

    // Verificar que no exista una variante con los mismos atributos adicionales
    if (validatedData.additionalAttributes) {
      const existingVariant = await db
        .select()
        .from(productVariants)
        .where(
          and(
            eq(productVariants.productId, productId),
            eq(productVariants.additionalAttributes, validatedData.additionalAttributes)
          )
        )
        .limit(1);

      if (existingVariant.length > 0) {
        return NextResponse.json(
          { error: "Ya existe una variante con estos atributos adicionales" },
          { status: 400 }
        );
      }
    }

    // Preparar datos para insertar, tratando additionalAttributes vacío como null
    const dataToInsert = { ...validatedData };
    if (
      validatedData.additionalAttributes &&
      Object.keys(validatedData.additionalAttributes).length === 0
    ) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (dataToInsert as any).additionalAttributes = null;
    }

    const mlAttributeCombinations = buildMlAttributeCombinations(
      validatedData.additionalAttributes || null
    );

    const newVariant = await db
      .insert(productVariants)
      .values({
        productId,
        ...dataToInsert,
        mlAttributeCombinations,
      })
      .returning();

    return NextResponse.json(newVariant[0], { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Datos inválidos", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error al crear variante:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// PUT /api/admin/products/[id]/variants - Actualizar variante (requiere variantId en query)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const productId = parseInt(id);
    const { searchParams } = new URL(request.url);
    const variantId = searchParams.get("variantId");

    if (isNaN(productId)) {
      return NextResponse.json({ error: "ID de producto inválido" }, { status: 400 });
    }

    if (!variantId || isNaN(parseInt(variantId))) {
      return NextResponse.json({ error: "ID de variante requerido" }, { status: 400 });
    }

    const body = await request.json();
    const validatedData = updateVariantSchema.parse(body);

    // Si se está actualizando el stock, determinar automáticamente el estado activo/inactivo
    const finalData: Record<string, unknown> = { ...validatedData };
    if (validatedData.stock !== undefined) {
      finalData.isActive = validatedData.stock > 0;
    }

    // Preparar datos para actualizar, tratando additionalAttributes vacío como null
    if (
      validatedData.additionalAttributes &&
      Object.keys(validatedData.additionalAttributes).length === 0
    ) {
      finalData.additionalAttributes = null as unknown;
    }

    // Recalcular combinaciones ML si se actualizan los atributos adicionales
    if (validatedData.additionalAttributes !== undefined) {
      finalData.mlAttributeCombinations = buildMlAttributeCombinations(
        validatedData.additionalAttributes
      );
    }

    const updatedVariant = await db
      .update(productVariants)
      .set(finalData)
      .where(
        and(
          eq(productVariants.id, parseInt(variantId)),
          eq(productVariants.productId, productId)
        )
      )
      .returning();

    if (updatedVariant.length === 0) {
      return NextResponse.json({ error: "Variante no encontrada" }, { status: 404 });
    }

    return NextResponse.json(updatedVariant[0]);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "Datos inválidos", details: error.issues },
        { status: 400 }
      );
    }

    console.error("Error al actualizar variante:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}

// DELETE /api/admin/products/[id]/variants - Eliminar variante (requiere variantId en query)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session || session.user.role !== "admin") {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }

    const { id } = await params;
    const productId = parseInt(id);
    const { searchParams } = new URL(request.url);
    const variantId = searchParams.get("variantId");

    if (isNaN(productId)) {
      return NextResponse.json({ error: "ID de producto inválido" }, { status: 400 });
    }

    if (!variantId || isNaN(parseInt(variantId))) {
      return NextResponse.json({ error: "ID de variante requerido" }, { status: 400 });
    }

    const deletedVariant = await db
      .delete(productVariants)
      .where(
        and(
          eq(productVariants.id, parseInt(variantId)),
          eq(productVariants.productId, productId)
        )
      )
      .returning();

    if (deletedVariant.length === 0) {
      return NextResponse.json({ error: "Variante no encontrada" }, { status: 404 });
    }

    return NextResponse.json({ message: "Variante eliminada exitosamente" });
  } catch (error) {
    console.error("Error al eliminar variante:", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}
