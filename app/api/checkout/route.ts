import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { checkoutSchema } from "@/lib/validations/checkout";
import { calculateShippingCost, calculateTotalWeight } from "@/lib/utils/shipping";
import { db } from "@/lib/db";
import { shippingMethods, users } from "@/lib/schema";
import { eq } from "drizzle-orm";
import { logger } from "@/lib/utils/logger";

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN!,
});

export async function POST(req: NextRequest) {
  try {
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

    // Obtener método de envío de la BD
    const shippingMethodData = await db
      .select()
      .from(shippingMethods)
      .where(eq(shippingMethods.id, shippingMethod.id))
      .limit(1);

    if (shippingMethodData.length === 0) {
      return NextResponse.json(
        { error: "Método de envío no encontrado" },
        { status: 400 }
      );
    }

    const method = shippingMethodData[0];

    // Calcular subtotal con descuentos aplicados
    const subtotal = items.reduce((acc, item) => {
      const basePrice = item.price;
      const finalPrice = item.discount && item.discount > 0
        ? basePrice * (1 - item.discount / 100)
        : basePrice;
      return acc + finalPrice * item.quantity;
    }, 0);

    // Calcular costo de envío
    const totalWeight = calculateTotalWeight(items);
    const shippingCost = calculateShippingCost(method, totalWeight, shippingAddress.provincia, subtotal);

    // Calcular total final
    const total = subtotal + shippingCost;

    // Log de metadata que se enviará
    logger.info('Checkout: Metadata preparada para MercadoPago', {
      userId: userId.toString(),
      itemCount: items.length,
      shippingMethodId: shippingMethod.id,
      hasShippingAddress: !!shippingAddress,
      metadata: {
        userId: userId.toString(),
        shippingAddress: JSON.stringify(shippingAddress),
        shippingMethodId: method.id.toString(),
        items: JSON.stringify(items),
        subtotal: subtotal.toString(),
        shippingCost: shippingCost.toString(),
        total: total.toString(),
      }
    });

    const preference = await new Preference(client).create({
      body: {
        items: [
          // Items del carrito
          ...items.map((item) => ({
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
            id: `shipping-${method.id}`,
            title: `Envío - ${method.name}`,
            quantity: 1,
            unit_price: shippingCost,
            currency_id: "ARS",
          }] : [])
        ],
        back_urls: {
          success: `${process.env.APP_URL}/payment-success`,
          failure: `${process.env.APP_URL}/payment-failure`,
          pending: `${process.env.APP_URL}/payment-pending`,
        },
        auto_return: "approved",
        notification_url: `${process.env.MERCADO_PAGO_NOTIFICATION_URL}?source_news=webhooks&user_id=${userId}`,
        metadata: {
          userId: userId.toString(),
          shippingAddress: JSON.stringify(shippingAddress),
          shippingMethodId: method.id.toString(),
          items: JSON.stringify(items),
          subtotal: subtotal.toString(),
          shippingCost: shippingCost.toString(),
          total: total.toString(),
        },
      },
    });

    return NextResponse.json({ init_point: preference.init_point });
  } catch (error) {
    console.error("Error creating preference:", error);
    return NextResponse.json(
      { error: "Failed to create preference" },
      { status: 500 }
    );
  }
}
