import { NextResponse } from 'next/server';
import { auth } from '@/lib/actions/auth';
import {
  getProductAttributeById,
  updateProductAttribute,
  deleteProductAttribute,
  type ProductAttributeValue,
} from '@/lib/actions/productAttributes';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: idParam } = await params;
    const id = parseInt(idParam, 10);
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const attribute = await getProductAttributeById(id);
    if (!attribute) {
      return NextResponse.json({ error: 'Product attribute not found' }, { status: 404 });
    }

    return NextResponse.json(attribute);
  } catch (error) {
    console.error('Error fetching product attribute:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: idParam } = await params;
    const id = parseInt(idParam, 10);
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const body = await request.json();
    const { name, mlAttributeId, values } = body ?? {};

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const safeValues: ProductAttributeValue[] = Array.isArray(values) ? values : [];

    const updated = await updateProductAttribute(id, {
      name: name.trim(),
      mlAttributeId: typeof mlAttributeId === 'string' ? mlAttributeId.trim() : null,
      values: safeValues,
    });

    if (!updated) {
      return NextResponse.json({ error: 'Product attribute not found' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating product attribute:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: idParam } = await params;
    const id = parseInt(idParam, 10);
    if (Number.isNaN(id)) {
      return NextResponse.json({ error: 'Invalid ID' }, { status: 400 });
    }

    const success = await deleteProductAttribute(id);
    if (!success) {
      return NextResponse.json({ error: 'Product attribute not found' }, { status: 404 });
    }

    return NextResponse.json({ message: 'Product attribute deleted successfully' });
  } catch (error) {
    console.error('Error deleting product attribute:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
