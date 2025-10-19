"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useRouter } from "next/router";

export default function PaymentSuccess() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const status = searchParams.get("status");
    const paymentId = searchParams.get("payment_id");
    const merchantOrderId = searchParams.get("merchant_order_id");

    if (status === "approved") {
      // Redirigir al dashboard o mostrar un mensaje de éxito
      router.push(`/dashboard?payment_id=${paymentId}&order_id=${merchantOrderId}`);
    } else {
      // Manejar otros estados de pago
      router.push("/payment-failure");
    }
  }, [searchParams, router]);

  return <div>Procesando el pago...</div>;
}
