import { Suspense } from "react";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { products, productVariants } from "@/lib/schema";
import { eq, and } from "drizzle-orm";
import { StockManagement } from "@/components/admin/StockManagement";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getProductData(productId: number) {
  const product = await db
    .select({
      id: products.id,
      name: products.name,
      stock: products.stock,
    })
    .from(products)
    .where(eq(products.id, productId))
    .limit(1);

  if (!product.length) {
    return null;
  }

  const variants = await db
    .select({
      id: productVariants.id,
      attributes: productVariants.attributes,
      stock: productVariants.stock,
      isActive: productVariants.isActive,
    })
    .from(productVariants)
    .where(and(
      eq(productVariants.productId, productId),
      eq(productVariants.isActive, true)
    ));

  return {
    product: product[0],
    variants: variants.map(v => ({
      ...v,
      attributes: v.attributes as Record<string, string>,
    })),
  };
}

export default async function StockPage({ params }: PageProps) {
  const { id } = await params;
  const productId = parseInt(id);

  if (isNaN(productId)) {
    notFound();
  }

  const data = await getProductData(productId);

  if (!data) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">
          Gestión de Stock - {data.product.name}
        </h1>
        <p className="text-gray-600 mt-2">
          Administra el stock del producto y sus variantes
        </p>
      </div>

      <Suspense fallback={<div>Cargando...</div>}>
        <StockManagement
          productId={productId}
          productStock={data.product.stock}
          variants={data.variants}
        />
      </Suspense>
    </div>
  );
}
