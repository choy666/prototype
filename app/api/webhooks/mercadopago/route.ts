import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { db } from "@/lib/db";
import { orders } from "@/lib/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { logger } from "@/lib/utils/logger"; // Sistema de logging

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN!,
});

const webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const signature = req.headers.get("x-signature");
    const requestId = req.headers.get("x-request-id");

    // Validación de headers
    if (!signature || !requestId) {
      return NextResponse.json({ error: "Faltan headers requeridos" }, { status: 400 });
    }

    // Validación de firma HMAC
    const [ts, hash] = signature.split(",");
    const timestamp = ts.split("=")[1];
    const receivedHash = hash.split("=")[1];

    // Evitar ataques de repetición
    const currentTimestamp = Math.floor(Date.now() / 1000);
    if (Math.abs(currentTimestamp - Number(timestamp)) > 300) {
      return NextResponse.json({ error: "Firma expirada" }, { status: 400 });
    }

    const signedTemplate = `id:${body.data.id};request-id:${requestId};ts:${timestamp};`;
    const hmac = crypto.createHmac("sha256", webhookSecret);
    hmac.update(signedTemplate);
    const calculatedHash = hmac.digest("hex");

    if (calculatedHash !== receivedHash) {
      return NextResponse.json({ error: "Firma inválida" }, { status: 400 });
    }

    const { data, type } = body;

    // Manejo del evento de pago
    if (type === "payment") {
      const payment = await new Payment(client).get({ id: data.id });

      if (payment && payment.status === "approved") {
        const { metadata, order } = payment;
        const { id } = payment;

        if (metadata?.userId && order?.id) {
          const existingOrder = await db
            .select()
            .from(orders)
            .where(eq(orders.mercadoPagoId, order.id.toString()));

          if (existingOrder.length === 0) {
            await db.insert(orders).values({
              userId: Number(metadata.userId),
              total: payment.transaction_amount?.toString() || "0",
              status: "paid",
              paymentId: id?.toString(),
              mercadoPagoId: order.id.toString(),
            });
          }
        }
      }
    }

    return NextResponse.json({ status: "ok" });
  } catch (error) {
    logger.error("Error manejando el webhook", error);
    return NextResponse.json(
      { error: "Error interno del servidor" },
      { status: 500 }
    );
  }
}