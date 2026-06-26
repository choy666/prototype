import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getProductStockData } from "@/lib/actions/product-stock";
import { StockManagement } from "@/components/admin/StockManagement";

interface PageProps {
  params: Promise<{ id: string }>;
}

export default async function StockPage({ params }: PageProps) {
  const { id } = await params;
  const productId = parseInt(id);

  if (isNaN(productId)) {
    notFound();
  }

  const data = await getProductStockData(productId);

  if (!data) {
    notFound();
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">
          Gestión de Stock - {data.product.name}
        </h1>
        <p className="text-gray-600 mt-2">
          Administra el stock del producto y sus variantes con nombres personalizados
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
