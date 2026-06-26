import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/actions/auth";
import { db } from "@/lib/db";
import { productVariants, products, categories } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { z } from "zod";
import {
  getCategoryME2Rules,
  normalizeVariantAttributeCombinations,
  fetchMLAttributeDefinitions,
  type MLAttributeDefinition,
  type ME2CategoryRules,
  type NormalizedAttributeCombination,
} from "@/lib/mercado-envios/me2Rules";

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

type VariantRow = typeof productVariants.$inferSelect;
type NormalizedVariantResponse = VariantRow & { normalizationWarnings?: string[] };

const isMLAttributeDefinition = (attr: unknown): attr is MLAttributeDefinition => {
  if (!attr || typeof attr !== "object") return false;
  const candidate = attr as { id?: unknown };
  return typeof candidate.id === "string";
};

async function getNormalizationContext(productId: number) {
  const product = await db.query.products.findFirst({
    where: eq(products.id, productId),
    columns: {
      id: true,
      mlCategoryId: true,
    },
  });

  if (!product) {
    throw new Error("Producto no encontrado");
  }

  const [rules, storedCategory] = await Promise.all([
    getCategoryME2Rules(product.mlCategoryId),
    product.mlCategoryId
      ? db.query.categories.findFirst({
          where: eq(categories.mlCategoryId, product.mlCategoryId),
          columns: { attributes: true },
        })
      : Promise.resolve(null),
  ]);

  let attributeDefinitions: MLAttributeDefinition[] = [];
  const storedAttributes = storedCategory?.attributes;
  if (Array.isArray(storedAttributes)) {
    attributeDefinitions = (storedAttributes as unknown[])
      .filter(isMLAttributeDefinition)
      .map((attr) => ({
        id: attr.id,
        name: attr.name ?? attr.id,
        tags: attr.tags,
        values: attr.values,
      }));
  }

  if (attributeDefinitions.length === 0) {
    attributeDefinitions = await fetchMLAttributeDefinitions(product.mlCategoryId);
  }

  return {
    product,
    rules,
    attributeDefinitions,
  };
}

function buildVariantResponse(
  variant: VariantRow,
  attributeDefinitions: MLAttributeDefinition[],
  rules: ME2CategoryRules
): NormalizedVariantResponse {
  const additionalAttributes =
    (variant.additionalAttributes as Record<string, string> | null) ?? null;
  const normalization = normalizeVariantAttributeCombinations(
    additionalAttributes,
    attributeDefinitions,
    rules
  );

  const storedCombinations = Array.isArray(variant.mlAttributeCombinations)
    ? (variant.mlAttributeCombinations as NormalizedAttributeCombination[])
    : null;

  return {
    ...variant,
    mlAttributeCombinations:
      storedCombinations && storedCombinations.length > 0
        ? storedCombinations
        : normalization.combinations,
    normalizationWarnings: normalization.warnings,
  };
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

    const { attributeDefinitions, rules } = await getNormalizationContext(productId);

    const variants = await db
      .select()
      .from(productVariants)
      .where(eq(productVariants.productId, productId))
      .orderBy(productVariants.created_at);

    const normalizedVariants = variants.map((variant) =>
      buildVariantResponse(variant, attributeDefinitions, rules)
    );

    return NextResponse.json(normalizedVariants);
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

    const { attributeDefinitions, rules } = await getNormalizationContext(productId);

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

    const normalization = normalizeVariantAttributeCombinations(
      validatedData.additionalAttributes || null,
      attributeDefinitions,
      rules
    );

    if (normalization.errors.length > 0) {
      return NextResponse.json(
        {
          error: "No se pudieron normalizar los atributos de la variante",
          details: normalization.errors,
        },
        { status: 400 }
      );
    }

    const mlAttributeCombinations =
      normalization.combinations.length > 0 ? normalization.combinations : null;

    const newVariant = await db
      .insert(productVariants)
      .values({
        productId,
        ...dataToInsert,
        mlAttributeCombinations,
      })
      .returning();

    const responsePayload = buildVariantResponse(
      newVariant[0],
      attributeDefinitions,
      rules
    );

    return NextResponse.json(responsePayload, { status: 201 });
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

    const { attributeDefinitions, rules } = await getNormalizationContext(productId);

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
      const normalization = normalizeVariantAttributeCombinations(
        validatedData.additionalAttributes || null,
        attributeDefinitions,
        rules
      );

      if (normalization.errors.length > 0) {
        return NextResponse.json(
          {
            error: "No se pudieron normalizar los atributos de la variante",
            details: normalization.errors,
          },
          { status: 400 }
        );
      }

      finalData.mlAttributeCombinations =
        normalization.combinations.length > 0 ? normalization.combinations : null;
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

    const responsePayload = buildVariantResponse(
      updatedVariant[0],
      attributeDefinitions,
      rules
    );

    return NextResponse.json(responsePayload);
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
