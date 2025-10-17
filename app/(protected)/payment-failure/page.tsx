"use client";

import { Button } from "@/components/ui/Button";
import Link from "next/link";

export default function PaymentFailurePage() {
  return (
    <div className="container mx-auto p-8 text-center">
      <h1 className="text-3xl font-bold text-red-600 mb-4">
        ¡El pago ha fallado!
      </h1>
      <p className="mb-6">
        Lo sentimos, pero no hemos podido procesar tu pago. Por favor,
        inténtalo de nuevo.
      </p>
      <Link href="/cart">
        <Button>Volver al carrito</Button>
      </Link>
    </div>
  );
}
