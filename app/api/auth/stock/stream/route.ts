// app/api/stock/stream/route.ts
export const runtime = 'nodejs';

export async function GET() {
  const stream = new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder();

      function send(data: unknown) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      }

      const interval = setInterval(() => {
        // Ejemplo de actualización de stock que coincide con el tipo CartItem
        send({
          id: 1,  // number en lugar de string
          stock: Math.floor(Math.random() * 10)
        });
      }, 10000);

      // Cleanup
      return () => clearInterval(interval);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}