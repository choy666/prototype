// app/api/webhooks/mercado-pago/route.ts
import { NextResponse } from "next/server";

const webhookSecret = process.env.MERCADO_PAGO_WEBHOOK_SECRET || "default_secret"; // Clave secreta para validar la firma del webhook

export async function POST(req: Request) {
  try {
    const body = await req.json();

    // Validación básica de headers
    const requestId = req.headers.get("x-request-id");
    if (!requestId) {
      return NextResponse.json({ error: "Faltan headers requeridos" }, { status: 400 });
    }

    // Procesar el evento recibido
    const { action, data } = body;

    if (action === "payment.created" || action === "payment.updated") {
      // Procesar el evento de pago
      console.log("Evento recibido:", action, data);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error procesando el webhook:", error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}