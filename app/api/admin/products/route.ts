import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/actions/auth';
import { getProducts, createProduct } from '@/lib/actions/products';
import { validateMLCategory, createMLCategoryErrorResponse } from '@/lib/validations/ml-category';
import { shippingAttributesSchema } from '@/lib/validations/shipping-attributes';
import {
  validateListingTypeSelection,
  ListingTypeValidationError,
} from '@/lib/validations/listing-type';
import { z } from 'zod';

const createProductSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  price: z.string().regex(/^\d+(\.\d{1,2})?$/),
  image: z
    .string()
    .refine(
      (url) => !url || url.startsWith('https://') || url.startsWith('/uploads/'),
      'URL de imagen inválida'
    )
    .optional(),
  images: z
    .union([
      z.string(),
      z.array(
        z
          .string()
          .refine(
            (url) => url.startsWith('https://') || url.startsWith('/uploads/'),
            'URL de imagen inválida'
          )
      ),
    ])
    .optional()
    .transform((val) => {
      if (typeof val === 'string') {
        return val
          .split(',')
          .map((s) => s.trim())
          .filter((s) => s.length > 0);
      }
      return val || [];
    }),
  destacado: z.boolean().default(false),
  stock: z.number().int().min(0).default(0),
  discount: z
    .union([z.string().regex(/^\d+$/), z.number().int().min(0).max(100)])
    .transform((val) => {
      if (typeof val === 'string') {
        return parseInt(val, 10);
      }
      return val;
    }),
  weight: z
    .string()
    .regex(/^\d+(\.\d{1,2})?$/)
    .optional(),
  // Campos de Mercado Libre
  mlCondition: z.string().min(1),
  mlBuyingMode: z.string().min(1),
  mlListingTypeId: z.string().min(1),
  mlCurrencyId: z.string().min(1),
  mlCategoryId: z
    .string()
    .regex(/^MLA\d+$/, 'El ID de categoría de Mercado Libre debe tener formato MLA123'),
  warranty: z.string().optional(),
  mlVideoId: z.string().optional(),
  // Dimensiones para envío
  height: z
    .string()
    .regex(/^\d+(\.\d{1})?$/)
    .optional(),
  width: z
    .string()
    .regex(/^\d+(\.\d{1})?$/)
    .optional(),
  length: z
    .string()
    .regex(/^\d+(\.\d{1})?$/)
    .optional(),
  // Campos ME2
  me2Compatible: z.boolean().default(false),
  shippingMode: z.enum(['me1', 'me2', 'custom', 'not_specified']).default('me2'),
  shippingAttributes: shippingAttributesSchema.optional(),
  // Atributos dinámicos del producto
  attributes: z
    .array(
      z.object({
        name: z.string().min(1),
        values: z.array(z.string().min(1)).min(1),
      })
    )
    .optional(),
});

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const category = searchParams.get('category') || undefined;
    const search = searchParams.get('search') || undefined;
    const sortBy = searchParams.get('sortBy') || 'created_at';
    const sortOrder = searchParams.get('sortOrder') || 'desc';
    const minPrice = searchParams.get('minPrice')
      ? parseFloat(searchParams.get('minPrice')!)
      : undefined;
    const maxPrice = searchParams.get('maxPrice')
      ? parseFloat(searchParams.get('maxPrice')!)
      : undefined;
    const minStock = searchParams.get('minStock')
      ? parseInt(searchParams.get('minStock')!)
      : undefined;
    const maxStock = searchParams.get('maxStock')
      ? parseInt(searchParams.get('maxStock')!)
      : undefined;
    const minDiscount = searchParams.get('minDiscount')
      ? parseInt(searchParams.get('minDiscount')!)
      : undefined;
    const featured =
      searchParams.get('featured') === 'true'
        ? true
        : searchParams.get('featured') === 'false'
          ? false
          : undefined;
    const mlSyncStatusParam = searchParams.get('mlSyncStatus');

    const allowedMlSyncStatuses = new Set(['pending', 'syncing', 'synced', 'error', 'conflict']);

    const mlSyncStatus =
      mlSyncStatusParam && allowedMlSyncStatuses.has(mlSyncStatusParam)
        ? (mlSyncStatusParam as 'pending' | 'syncing' | 'synced' | 'error' | 'conflict')
        : undefined;

    // Para admin, mostrar todos los productos (activos e inactivos)
    const result = await getProducts(
      page,
      limit,
      {
        category,
        search,
        sortBy: sortBy as 'created_at' | 'name' | 'price' | 'stock' | 'discount',
        sortOrder: sortOrder as 'asc' | 'desc',
        minPrice,
        maxPrice,
        minStock,
        maxStock,
        minDiscount,
        featured,
        mlSyncStatus,
      },
      true
    ); // includeInactive = true para admin

    return NextResponse.json(result);
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    console.log('[POST /api/admin/products] Datos recibidos:', JSON.stringify(body, null, 2));

    const parsed = createProductSchema.safeParse(body);
    if (!parsed.success) {
      console.error('[POST /api/admin/products] Error de validación Zod:', parsed.error);
      console.error('[POST /api/admin/products] Issues:', parsed.error.issues);
      return NextResponse.json(
        { error: 'Validation error', issues: parsed.error.issues },
        { status: 400 }
      );
    }

    console.log('[POST /api/admin/products] Datos validados correctamente');
    const validatedData = parsed.data;

    // Validar que la categoría ML sea una categoría hoja válida
    if (validatedData.mlCategoryId) {
      const isValidCategory = await validateMLCategory(validatedData.mlCategoryId);

      if (!isValidCategory) {
        return NextResponse.json(
          {
            ...createMLCategoryErrorResponse(validatedData.mlCategoryId),
            error: createMLCategoryErrorResponse(validatedData.mlCategoryId).error,
          },
          { status: 400 }
        );
      }
    }

    const numericPrice = parseFloat(validatedData.price);
    if (Number.isNaN(numericPrice) || numericPrice <= 0) {
      return NextResponse.json(
        { error: 'El precio debe ser un número mayor a 0.' },
        { status: 400 }
      );
    }

    const userIdNumber = Number(session.user.id);
    const listingValidationUserId = Number.isNaN(userIdNumber) ? undefined : userIdNumber;

    try {
      await validateListingTypeSelection({
        userId: listingValidationUserId,
        mlCategoryId: validatedData.mlCategoryId,
        mlListingTypeId: validatedData.mlListingTypeId,
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

    const product = await createProduct({
      ...validatedData,
      price: validatedData.price,
      weight: validatedData.weight ? validatedData.weight : null,
      images: validatedData.images || [],
      attributes: validatedData.attributes || undefined,
      me2Compatible: validatedData.me2Compatible,
      shippingMode: validatedData.shippingMode,
      shippingAttributes: validatedData.shippingAttributes,
    });

    return NextResponse.json(product, { status: 201 });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Validation error', issues: error.issues },
        { status: 400 }
      );
    }
    console.error('Error creating product:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
