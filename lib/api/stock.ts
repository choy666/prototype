import { CartItem } from "@/lib/stores/useCartStore";

// Validación de stock contra el servidor
export async function validateStock(
  items: CartItem[]
): Promise<{ valid: boolean; outOfStock: { id: number; availableStock: number }[] }> {
  try {
    const response = await fetch("/api/stock/validate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });

    if (!response.ok) {
      throw new Error("Error al validar stock");
    }

    return response.json();
  } catch (error) {
    console.error("Error al validar stock:", error);
    throw error;
  }
}

// --- Suscripción a SSE para actualizaciones de stock ---
let eventSource: EventSource | null = null;

export function subscribeToStockUpdates(
  callback: (updates: { productId: number; newStock: number }[]) => void
) {
  if (eventSource) return; // ya hay conexión activa

  eventSource = new EventSource("/api/stock/stream", { withCredentials: true });

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data);
      callback(data);
    } catch (err) {
      console.error("Error parsing SSE data:", err);
    }
  };

  eventSource.onerror = (err) => {
    console.error("SSE connection error:", err);
    // El navegador reintenta automáticamente
  };
}

export function unsubscribeFromStockUpdates() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
  }
}