import { NextRequest, NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";
import { db } from "@/lib/db";
import { orders } from "@/lib/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";

const client = new MercadoPagoConfig({
  accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN!,
});

const webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET!;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const signature = req.headers.get("x-signature");
    const requestId = req.headers.get("x-request-id");

    if (!signature || !requestId) {
      return NextResponse.json({ error: "Missing signature" }, { status: 400 });
    }

    const [ts, hash] = signature.split(",");
    const timestamp = ts.split("=")[1];
    const receivedHash = hash.split("=")[1];

    const signedTemplate = `id:${body.data.id};request-id:${requestId};ts:${timestamp};`;

    const hmac = crypto.createHmac("sha256", webhookSecret);
    hmac.update(signedTemplate);
    const calculatedHash = hmac.digest("hex");

    if (calculatedHash !== receivedHash) {
      return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
    }

    const { data, type } = body;

    if (type === "payment") {
      const payment = await new Payment(client).get({ id: data.id });

      if (payment && payment.status === "approved") {
        const { metadata, order } = payment;
        const { id, status, status_detail } = payment;

        if (metadata && metadata.userId && order && order.id) {
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
    console.error("Error handling webhook:", error);
    return NextResponse.json(
      { error: "Failed to handle webhook" },
      { status: 500 }
    );
  }
}
