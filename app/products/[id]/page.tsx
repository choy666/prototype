// app/products/[id]/page.tsx
import { notFound } from 'next/navigation';
import { getProductById } from '@/lib/actions/products';
import ProductClient from '@/app/products/[id]/ProductClient';
import type { ProductPageProps } from '@/types';

export default async function ProductDetailPage({ params }: ProductPageProps) {
  try {
    const { id } = params;
    
    if (!id || isNaN(Number(id))) {
      notFound();
    }
    
    const product = await getProductById(Number(id));

    if (!product) {
      notFound();
    }

    return <ProductClient product={product} />;
  } catch (error) {
    console.error('Error loading product:', error);
    notFound();
  }
}
