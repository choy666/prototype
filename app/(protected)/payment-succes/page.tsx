"use client";

import { Button } from "@/components/ui/Button";
import Link from "next/link";

export default function PaymentSuccessPage() {
  return (
    <div className="container mx-auto p-8 text-center">
      <h1 className="text-3xl font-bold text-green-600 mb-4">
        ¡Pago exitoso!
      </h1>
      <p className="mb-6">
        Gracias por tu compra. Hemos recibido tu pago y estamos procesando tu
        pedido.
      </p>
      <Link href="/products">
        <Button>Seguir comprando</Button>
      </Link>
    </div>
  );
}
