import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { productVariants } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";

// Schema de validación para crear variante
const createVariantSchema = z.object({
  attributes: z.record(z.string(), z.string()),
  price: z.string().optional(),
  stock: z.number().min(0).default(0),
  images: z.array(z.string()).optional(),
  isActive: z.boolean().default(true),
});

// Schema de validación para actualizar variante
const updateVariantSchema = z.object({
  attributes: z.record(z.string(), z.string()).optional(),
  price: z.string().optional(),
  stock: z.number().min(0).optional(),
  images: z.array(z.string()).optional(),
  isActive: z.boolean().optional(),
});

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

    // Verificar que no exista una variante con los mismos atributos
    const existingVariant = await db
      .select()
      .from(productVariants)
      .where(
        and(
          eq(productVariants.productId, productId),
          eq(productVariants.attributes, validatedData.attributes)
        )
      )
      .limit(1);

    if (existingVariant.length > 0) {
      return NextResponse.json(
        { error: "Ya existe una variante con estos atributos" },
        { status: 400 }
      );
    }

    const newVariant = await db
      .insert(productVariants)
      .values({
        productId,
        ...validatedData,
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

    const updatedVariant = await db
      .update(productVariants)
      .set(validatedData)
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
