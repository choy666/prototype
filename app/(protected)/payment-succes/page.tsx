"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";
import { useRouter } from "next/router";

export default function PaymentSuccess() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const collectionStatus = searchParams.get("collection_status");
    const paymentId = searchParams.get("payment_id");
    const merchantOrderId = searchParams.get("merchant_order_id");

    if (collectionStatus === "approved") {
      // Redirigir al dashboard o mostrar un mensaje de éxito
      router.push(`/dashboard?payment_id=${paymentId}&order_id=${merchantOrderId}`);
    } else if (collectionStatus === "pending") {
      // Redirigir a la página de pago pendiente
      router.push("/payment-pending");
    } else {
      // Redirigir a la página de fallo de pago
      router.push("/payment-failure");
    }
  }, [searchParams, router]);

  return <div>Procesando el pago...</div>;
}
