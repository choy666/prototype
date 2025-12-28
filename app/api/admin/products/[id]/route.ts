import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/actions/auth';
import { getProductById, deleteProduct } from '@/lib/actions/products';
import { validateMLCategory, createMLCategoryErrorResponse } from '@/lib/validations/ml-category';
import {
  validateListingTypeSelection,
  ListingTypeValidationError,
} from '@/lib/validations/listing-type';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const productId = parseInt(id);
    if (isNaN(productId)) {
      return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
    }

    const product = await getProductById(productId);

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const productId = parseInt(id);
    if (isNaN(productId)) {
      return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
    }

    const body = await request.json();

    const existingProduct = await getProductById(productId);
    if (!existingProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    // Validar que la categoría ML sea una categoría hoja válida si se está actualizando
    if (body.mlCategoryId) {
      const isValidCategory = await validateMLCategory(body.mlCategoryId);

      if (!isValidCategory) {
        return NextResponse.json(
          {
            ...createMLCategoryErrorResponse(body.mlCategoryId),
            error: createMLCategoryErrorResponse(body.mlCategoryId).error,
          },
          { status: 400 }
        );
      }
    }

    const effectivePriceValue = body.price ?? existingProduct.price;
    const numericPrice =
      typeof effectivePriceValue === 'string'
        ? parseFloat(effectivePriceValue)
        : typeof effectivePriceValue === 'number'
          ? effectivePriceValue
          : NaN;

    if (Number.isNaN(numericPrice) || numericPrice <= 0) {
      return NextResponse.json(
        { error: 'El precio debe ser un número mayor a 0.' },
        { status: 400 }
      );
    }

    const effectiveListingTypeId = body.mlListingTypeId ?? existingProduct.mlListingTypeId;
    const effectiveCategoryId = body.mlCategoryId ?? existingProduct.mlCategoryId;

    const userIdNumber = Number(session.user.id);
    const listingValidationUserId = Number.isNaN(userIdNumber) ? undefined : userIdNumber;

    try {
      await validateListingTypeSelection({
        userId: listingValidationUserId,
        mlCategoryId: effectiveCategoryId,
        mlListingTypeId: effectiveListingTypeId,
        price: numericPrice,
      });
    } catch (error) {
      if (error instanceof ListingTypeValidationError) {
        return NextResponse.json(
          {
            error: error.message,
            source: error.meta?.source,
          },
          { status: 400 }
        );
      }
      throw error;
    }

    const { updateProduct } = await import('@/lib/actions/products');

    const updatedProduct = await updateProduct(productId, body);

    if (!updatedProduct) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json(updatedProduct);
  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const productId = parseInt(id);
    if (isNaN(productId)) {
      return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
    }

    const success = await deleteProduct(productId);

    if (!success) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Product deleted successfully' });
  } catch (error) {
    console.error('Error deleting product:', error);
    if (error instanceof Error && error.message.includes('órdenes asociadas')) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
