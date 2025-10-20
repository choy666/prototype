import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Preference } from "mercadopago";
import { checkoutSchema } from "@/lib/validations/checkout";

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

    const { items, shippingAddress, userId } = validationResult.data;

    // Calcular total con descuentos aplicados
    const total = items.reduce((acc, item) => {
      const basePrice = item.price;
      const finalPrice = item.discount && item.discount > 0
        ? basePrice * (1 - item.discount / 100)
        : basePrice;
      return acc + finalPrice * item.quantity;
    }, 0);

    const preference = await new Preference(client).create({
      body: {
        items: items.map((item) => ({
          id: item.id.toString(),
          title: item.name,
          quantity: item.quantity,
          unit_price: item.discount && item.discount > 0
            ? item.price * (1 - item.discount / 100)
            : item.price,
          currency_id: "ARS",
        })),
        back_urls: {
          success: `${process.env.APP_URL}/payment-success`,
          failure: `${process.env.APP_URL}/payment-failure`,
          pending: `${process.env.APP_URL}/payment-pending`,
        },
        auto_return: "approved",
        notification_url: `${process.env.MERCADO_PAGO_NOTIFICATION_URL}?source_news=webhooks&user_id=${userId}`,
        metadata: {
          userId: userId,
          shippingAddress: JSON.stringify(shippingAddress),
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
