import { NextResponse } from 'next/server';
import { auth } from '@/lib/actions/auth';
import {
  getProductAttributes,
  createProductAttribute,
  type ProductAttributePayload,
  type ProductAttributeValue,
} from '@/lib/actions/productAttributes';

export async function GET(request: Request) {
  try {
    const session = await auth();
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || undefined;

    const attributes = await getProductAttributes(search || undefined);
    return NextResponse.json(attributes);
  } catch (error) {
    console.error('Error fetching product attributes:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name, mlAttributeId, values } = body ?? {};

    if (!name || typeof name !== 'string') {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    const safeValues: ProductAttributeValue[] = Array.isArray(values) ? values : [];

    const payload: ProductAttributePayload = {
      name: name.trim(),
      mlAttributeId: typeof mlAttributeId === 'string' ? mlAttributeId.trim() : null,
      values: safeValues,
    };

    const attribute = await createProductAttribute(payload);

    return NextResponse.json(attribute, { status: 201 });
  } catch (error) {
    console.error('Error creating product attribute:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
