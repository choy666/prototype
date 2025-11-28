import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { products, users, productVariants } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { MLShippingResponse, ShippingResponse, ShippingMethod } from '@/lib/types/shipping';

// Mapper function to transform ML API response to internal model
function mapMLShippingToInternal(mlResponse: MLShippingResponse): ShippingResponse {
  return {
    methods: mlResponse.methods.map(mlMethod => ({
      order_priority: mlMethod.shipping_method_id,
      name: mlMethod.name,
      cost: mlMethod.cost,
      estimated_delivery: mlMethod.estimated_delivery,
      shipping_mode: mlMethod.shipping_mode
    })),
    coverage: {
      all: mlResponse.coverage.all_country,
      partially_covered: mlResponse.coverage.excluded_places.length > 0
    }
  };
}

import { checkoutSchema } from '@/lib/validations/checkout';
import { logger } from '@/lib/utils/logger';
import { calculateME2ShippingCost } from '@/lib/actions/me2-shipping';
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

    // Calcular costo de envío usando API de Mercado Libre ME2 con fallback interno basado en BD
    const me2Response = await calculateME2ShippingCost({
      zipcode: shippingAddress.codigoPostal,
      items: items.map((item: CheckoutItem) => ({
        id: item.id.toString(),
        quantity: item.quantity,
        price: item.discount && item.discount > 0
          ? item.price * (1 - item.discount / 100)
          : item.price
      })),
    });

      // Adaptar resultado ME2 a MLShippingResponse esperado por mapMLShippingToInternal
    const mlShippingResponse: MLShippingResponse = {
      methods: me2Response.shippingOptions,
      coverage: me2Response.coverage || {
        all_country: true,
        excluded_places: [],
      },
    };

    const shippingResponse = mapMLShippingToInternal(mlShippingResponse);

    // Usar método estándar (order_priority: 1) o el más barato si no hay estándar
    if (shippingResponse.methods.length === 0) {
      throw new Error('No shipping methods available for this zipcode');
    }

    const standardMethod = shippingResponse.methods.find((m: ShippingMethod) => m.order_priority === 1);
    const cheapestMethod = shippingResponse.methods.reduce((min: ShippingMethod, curr: ShippingMethod) => 
      curr.cost < min.cost ? curr : min
    );

    const shippingCost = standardMethod?.cost ?? cheapestMethod?.cost ?? 0;

    logger.info('Shipping cost calculated via ME2/core', { 
      zipcode: shippingAddress.codigoPostal,
      cost: shippingCost,
      method: standardMethod?.name || cheapestMethod?.name,
      fallback: me2Response.fallback ?? false,
    });

    // Calcular total final
    const total = subtotal + shippingCost;

    // Obtener información del usuario para el pagador
    const payerInfo = {
      email: userExists[0].email,
      name: userExists[0].name || '',
    };

    // Preparar metadata incluyendo variantId en items
    const metadata = {
      user_id: userId.toString(),
      shipping_address: JSON.stringify(shippingAddress),
      shipping_method_id: shippingMethod.id.toString(),
      items: JSON.stringify(items.map((item: CheckoutItem) => ({
        ...item,
        variantId: item.variantId || null
      }))),
      subtotal: subtotal.toString(),
      shipping_cost: shippingCost.toString(),
      total: total.toString(),
    };

    // Crear preferencia de pago según documentación oficial de Mercado Pago
    const preference = await mercadopago.create({
      body: {
        items: [
          // Items del carrito
          ...items.map((item: CheckoutItem) => ({
            id: item.id.toString(),
            title: item.name,
            quantity: item.quantity,
            unit_price: item.discount && item.discount > 0
              ? item.price * (1 - item.discount / 100)
              : item.price,
            currency_id: "ARS",
          })),
          // Item de envío (si no es gratis)
          ...(shippingCost > 0 ? [{
            id: `shipping-${shippingMethod.id}`,
            title: `Envío - ${shippingMethod.name}`,
            quantity: 1,
            unit_price: shippingCost,
            currency_id: "ARS",
          }] : []),
        ],
        payer: {
          email: payerInfo.email,
          name: payerInfo.name,
        },
        back_urls: {
          success: process.env.MERCADO_PAGO_SUCCESS_URL || `https://${process.env.VERCEL_URL || 'localhost:3000'}/payment-success`,
          failure: process.env.MERCADO_PAGO_FAILURE_URL || `https://${process.env.VERCEL_URL || 'localhost:3000'}/payment-failure`,
          pending: process.env.MERCADO_PAGO_PENDING_URL || `https://${process.env.VERCEL_URL || 'localhost:3000'}/payment-pending`,
        },
        auto_return: "approved",
        notification_url: process.env.MERCADO_PAGO_NOTIFICATION_URL || `https://${process.env.VERCEL_URL || 'localhost:3000'}/api/webhooks/mercadopago`,
        external_reference: metadata.user_id,
        metadata: metadata,
        payment_methods: {
          excluded_payment_types: [
            { id: "ticket" }, // Excluir pago en efectivo
          ],
          installments: 12, // Permitir hasta 12 cuotas
        },
        shipments: {
          receiver_address: {
            zip_code: shippingAddress.codigoPostal,
            street_name: shippingAddress.direccion,
            street_number: shippingAddress.numero ? String(parseInt(shippingAddress.numero) || 0) : undefined,
            floor: shippingAddress.piso,
            apartment: shippingAddress.departamento,
          },
          mode: process.env.MERCADO_PAGO_SHIPMENTS_MODE || "custom", // Configurable via env var
          dimensions: "10x10x10,500", // defaults seguros
        },
      },
    });

    // Debug: Verificar estructura de respuesta de Mercado Pago
    console.log("Respuesta completa de Mercado Pago:", JSON.stringify(preference, null, 2));
    
    logger.info('Checkout: Preferencia de MercadoPago creada exitosamente', {
      preferenceId: preference.id,
      initPoint: preference.init_point,
      sandboxInitPoint: preference.sandbox_init_point,
      total,
      itemsCount: items.length,
      shippingCost
    });

    return NextResponse.json({
      preferenceId: preference.id,
      init_point: preference.init_point, // Campo que espera el frontend
      initPoint: preference.init_point,
      sandbox_init_point: preference.sandbox_init_point, // Campo que espera el frontend
      sandboxInitPoint: preference.sandbox_init_point,
      paymentUrl: preference.init_point, // Campo adicional para compatibilidad
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
