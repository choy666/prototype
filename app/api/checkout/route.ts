import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { products, users, productVariants, orders, mercadopagoPreferences } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { checkoutSchema } from '@/lib/validations/checkout';
import { logger } from '@/lib/utils/logger';
import { calculateME2Shipping } from '@/lib/mercado-envios/me2Api';
import { getProductsByIds } from '@/lib/mercado-envios/me2Validator';
import { MercadoPagoConfig, Preference } from 'mercadopago';

// Tipo para items del checkout (sin stock requerido)
type CheckoutItem = {
  id: number;
  name: string;
  price: number;
  quantity: number;
  image?: string;
  discount?: number;
  weight?: number | null;
  variantId?: number | null;
};
// Configuración de Mercado Pago según documentación oficial (SDK v2)
const mpClient = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN!,
});
const mercadopago = new Preference(mpClient);

export async function POST(req: NextRequest) {
  try {
    // Verificar que el usuario no sea admin
    const { auth } = await import("@/lib/actions/auth");
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "No autorizado" }, { status: 401 });
    }
    if (session.user.role === 'admin') {
      return NextResponse.json(
        { error: "Los administradores no pueden realizar compras" },
        { status: 403 }
      );
    }

    const body = await req.json();

    // Validar datos de entrada con Zod
    const validationResult = checkoutSchema.safeParse(body);
    if (!validationResult.success) {
      return NextResponse.json(
        {
          error: "Datos de entrada inválidos",
          details: validationResult.error.issues
        },
        { status: 400 }
      );
    }

    const { items, shippingAddress, shippingMethod, userId } = validationResult.data;

    // Verificar que el usuario existe
    logger.info('Checkout: Verificando existencia de usuario', { userId });
    const userExists = await db
      .select()
      .from(users)
      .where(eq(users.id, Number(userId)))
      .limit(1);

    if (userExists.length === 0) {
      logger.error('Checkout: Usuario no encontrado', { userId });
      return NextResponse.json(
        { error: "Usuario no encontrado" },
        { status: 400 }
      );
    }

    logger.info('Checkout: Usuario verificado correctamente', { userId, userEmail: userExists[0].email });

    // Verificar stock de todos los items antes de crear preferencia
    logger.info('Checkout: Verificando stock de items', { itemCount: items.length });
    for (const item of items) {
      if (item.variantId) {
        // Verificar stock de variante y que tanto la variante como el producto estén activos
        const variant = await db
          .select({ 
            stock: productVariants.stock, 
            productId: productVariants.productId,
            isVariantActive: productVariants.isActive
          })
          .from(productVariants)
          .innerJoin(products, eq(productVariants.productId, products.id))
          .where(and(
            eq(productVariants.id, item.variantId),
            eq(productVariants.isActive, true),
            eq(products.isActive, true)
          ))
          .limit(1);

        if (!variant.length) {
          logger.error('Checkout: Variante no encontrada, inactiva o producto inactivo', { variantId: item.variantId });
          return NextResponse.json(
            { error: `Variante no disponible para producto ${item.id}` },
            { status: 400 }
          );
        }

        if (variant[0].stock < item.quantity) {
          logger.error('Checkout: Stock insuficiente para variante', {
            variantId: item.variantId,
            availableStock: variant[0].stock,
            requestedQuantity: item.quantity
          });
          return NextResponse.json(
            { error: `Stock insuficiente para la variante seleccionada` },
            { status: 400 }
          );
        }
      } else {
        // Verificar stock del producto base y si está activo
        const product = await db
          .select({ stock: products.stock, isActive: products.isActive })
          .from(products)
          .where(and(
            eq(products.id, item.id),
            eq(products.isActive, true)
          ))
          .limit(1);

        if (!product.length) {
          logger.error('Checkout: Producto no encontrado o inactivo', { productId: item.id });
          return NextResponse.json(
            { error: `Producto no disponible: ${item.id}` },
            { status: 400 }
          );
        }

        if (product[0].stock < item.quantity) {
          logger.error('Checkout: Stock insuficiente para producto', {
            productId: item.id,
            availableStock: product[0].stock,
            requestedQuantity: item.quantity
          });
          return NextResponse.json(
            { error: `Stock insuficiente para el producto` },
            { status: 400 }
          );
        }
      }
    }

    logger.info('Checkout: Verificación de stock completada exitosamente');

    // Calcular subtotal con descuentos aplicados
    const subtotal = items.reduce((acc: number, item: CheckoutItem) => {
      const basePrice = item.price;
      const finalPrice = item.discount && item.discount > 0
        ? basePrice * (1 - item.discount / 100)
        : basePrice;
      return acc + finalPrice * item.quantity;
    }, 0);

    // Calcular costo de envío usando el mismo motor ME2 que /api/shipments/calculate,
    // respetando el método seleccionado por el usuario y con fallback a métodos locales.

    // 1) Obtener productos enriquecidos desde la base de datos para ME2
    const productIds = items.map((item: CheckoutItem) => item.id);
    const dbProducts = await getProductsByIds(productIds);

    const me2Items = items.map((item: CheckoutItem) => {
      const dbProduct = dbProducts.find(p => p.id === item.id);

      const basePrice = item.price;
      const finalPrice = item.discount && item.discount > 0
        ? basePrice * (1 - item.discount / 100)
        : basePrice;

      return {
        id: item.id,
        name: dbProduct?.name || item.name,
        weight: dbProduct?.weight ?? undefined,
        height: dbProduct?.height ?? undefined,
        width: dbProduct?.width ?? undefined,
        length: dbProduct?.length ?? undefined,
        shippingMode: dbProduct?.shippingMode ?? undefined,
        shippingAttributes: dbProduct?.shippingAttributes ?? undefined,
        me2Compatible: dbProduct?.me2Compatible ?? false,
        mlItemId: dbProduct?.mlItemId ?? undefined,
        quantity: item.quantity,
        price: finalPrice,
      };
    });

    const me2Response = await calculateME2Shipping({
      zipcode: shippingAddress.codigoPostal,
      items: me2Items,
      allowFallback: true,
    });

    if (!me2Response.shippingOptions || me2Response.shippingOptions.length === 0) {
      throw new Error('No shipping methods available for this zipcode');
    }

    // 2) Intentar usar exactamente el método seleccionado por el usuario (shippingMethod.id)
    const selectedMethodFromEngine = me2Response.shippingOptions.find(opt =>
      String(opt.shipping_method_id) === String(shippingMethod.id),
    );

    // 3) Si no se encuentra (por cambios en ML o fallback), usar el más barato como respaldo
    const cheapestMethod = me2Response.shippingOptions.reduce((min, curr) =>
      (curr.cost || 0) < (min.cost || 0) ? curr : min,
    me2Response.shippingOptions[0]);

    const effectiveMethod = selectedMethodFromEngine || cheapestMethod;
    const shippingCost = effectiveMethod?.cost ?? 0;

    logger.info('Shipping cost calculated via ME2/core', { 
      zipcode: shippingAddress.codigoPostal,
      cost: shippingCost,
      method: effectiveMethod?.name,
      selectedMethodId: shippingMethod.id,
      matchedSelectedMethod: Boolean(selectedMethodFromEngine),
      source: me2Response.source,
      fallback: me2Response.fallback ?? false,
    });

    // Calcular total final
    const total = subtotal + shippingCost;

    // Crear orden local pendiente vinculada al checkout
    const [newOrder] = await db
      .insert(orders)
      .values({
        userId: userExists[0].id,
        email: userExists[0].email,
        total: total.toString(),
        status: 'pending',
        shippingAddress,
        shippingMethodId: null,
        shippingCost: shippingCost.toString(),
        shippingMode: 'me2',
        source: 'local',
        metadata: {},
      })
      .returning({ id: orders.id });

    const orderId = newOrder.id;

    // Obtener información del usuario para el pagador
    const payerInfo = {
      email: userExists[0].email,
      name: userExists[0].name || '',
    };

    // Preparar metadata incluyendo variantId en items y tracking de migración
    const metadata = {
      user_id: userId.toString(),
      order_id: orderId.toString(),
      shipping_address: JSON.stringify(shippingAddress),
      shipping_method_id: shippingMethod.id.toString(),
      items: JSON.stringify(items.map((item: CheckoutItem) => ({
        ...item,
        variantId: item.variantId || null
      }))),
      subtotal: subtotal.toString(),
      shipping_cost: shippingCost.toString(),
      total: total.toString(),
      // Metadata de tracking y versión
      checkout_version: '1.0',
      migration_applied: true,
      me2_source: me2Response.source,
      me2_fallback: me2Response.fallback ?? false,
      created_at: new Date().toISOString(),
    };

    // Crear preferencia de pago según documentación oficial de Mercado Pago
    const preference = await mercadopago.create({
      body: {
        items: [
          // Items del carrito
          ...items.map((item: CheckoutItem) => ({
            id: item.id.toString(),
            title: item.name,
            description: `Producto: ${item.name} - Cantidad: ${item.quantity}${item.variantId ? ` - Variante ID: ${item.variantId}` : ''}`,
            quantity: item.quantity,
            unit_price: Math.round((item.discount && item.discount > 0
              ? item.price * (1 - item.discount / 100)
              : item.price) * 100) / 100, // Redondear a 2 decimales
            currency_id: "ARS",
            category_id: "others", // Categoría genérica pero requerida
          })),
          // Item de envío (si no es gratis)
          ...(shippingCost > 0 ? [{
            id: `shipping-${shippingMethod.id}`,
            title: `Envío - ${shippingMethod.name}`,
            description: `Costo de envío a ${shippingAddress.ciudad}, ${shippingAddress.provincia} (CP: ${shippingAddress.codigoPostal})`,
            quantity: 1,
            unit_price: Math.round(shippingCost * 100) / 100, // Redondear a 2 decimales
            currency_id: "ARS",
            category_id: "others",
          }] : []),
        ],
        payer: {
          email: payerInfo.email,
          name: payerInfo.name,
          phone: {
            number: shippingAddress.telefono,
          },
          address: {
            zip_code: shippingAddress.codigoPostal,
            street_name: shippingAddress.direccion,
            street_number: shippingAddress.numero || "1",
          },
          identification: userExists[0].documentType && userExists[0].documentNumber
            ? {
                type: userExists[0].documentType,
                number: userExists[0].documentNumber,
              }
            : undefined,
        },
        back_urls: {
          success:
            process.env.MERCADO_PAGO_SUCCESS_URL
            || `${process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://localhost:3000'}/payment-success`,
          failure:
            process.env.MERCADO_PAGO_FAILURE_URL
            || `${process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://localhost:3000'}/payment-failure`,
          pending:
            process.env.MERCADO_PAGO_PENDING_URL
            || `${process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://localhost:3000'}/payment-pending`,
        },
        auto_return: "approved",
        notification_url:
          process.env.MERCADO_PAGO_NOTIFICATION_URL
          || `${process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || 'https://localhost:3000'}/api/mercadopago/payments/notify`,
        external_reference: orderId.toString(),
        metadata: metadata,
        payment_methods: {
          // No excluir tipos de pago para pruebas - mostrar todo lo disponible
          installments: 12, // Permitir hasta 12 cuotas
        },
      },
    });

    await db.insert(mercadopagoPreferences).values({
      preferenceId: preference.id,
      externalReference: orderId.toString(),
      orderId,
      userId: Number(userId),
      initPoint: preference.init_point,
      items: preference.items || [],
      payer: preference.payer || {},
      paymentMethods: preference.payment_methods || {},
      expires: preference.expires ?? false,
      expirationDateFrom: preference.expiration_date_from ? new Date(preference.expiration_date_from) : null,
      expirationDateTo: preference.expiration_date_to ? new Date(preference.expiration_date_to) : null,
      notificationUrl: preference.notification_url,
      status: 'pending',
    });

        // Debug: Verificar estructura de respuesta de Mercado Pago
    console.log("Respuesta completa de Mercado Pago:", JSON.stringify(preference, null, 2));
    console.log("Environment check - NODE_ENV:", process.env.NODE_ENV);
    console.log("Environment check - SUCCESS_URL:", process.env.MERCADO_PAGO_SUCCESS_URL);
    console.log("Environment check - VERCEL_URL:", process.env.VERCEL_URL);
    
    logger.info('Checkout: Preferencia de MercadoPago creada exitosamente', {
      preferenceId: preference.id,
      initPoint: preference.init_point,
      total,
      itemsCount: items.length,
      shippingCost,
      orderId,
    });
    return NextResponse.json({
      orderId,
      preferenceId: preference.id,
      initPoint: preference.init_point,
      total,
      subtotal,
      shippingCost,
      items: items.map((item: CheckoutItem) => ({
        ...item,
        finalPrice: item.discount && item.discount > 0
          ? item.price * (1 - item.discount / 100)
          : item.price,
      })),
    });
  } catch (error) {
    logger.error('Checkout: Error procesando checkout', {
      error,
      stack: error instanceof Error ? error.stack : undefined
    });

    return NextResponse.json(
      {
        error: "Error procesando el pago",
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
