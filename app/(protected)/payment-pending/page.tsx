"use client";

import { Button } from "@/components/ui/Button";
import Link from "next/link";

export default function PaymentPendingPage() {
  return (
    <div className="container mx-auto p-8 text-center">
      <h1 className="text-3xl font-bold text-yellow-600 mb-4">
        Pago pendiente
      </h1>
      <p className="mb-6">
        Tu pago está pendiente de confirmación. Te notificaremos una vez que
        se haya completado.
      </p>
      <Link href="/products">
        <Button>Seguir comprando</Button>
      </Link>
    </div>
  );
}
