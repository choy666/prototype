import { NextRequest, NextResponse } from 'next/server';
import { MercadoLibreAuth } from '@/lib/auth/mercadolibre';
import { auth } from '@/lib/actions/auth';

// Verificación temporal para testing - en producción usar auth real
async function verifyAdmin(request: NextRequest): Promise<boolean> {
  void request;
  const session = await auth();
  return !!session && session.user?.role === 'admin';
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const isAdmin = await verifyAdmin(request);
    if (!isAdmin) {
      return NextResponse.json(
        { error: 'No autorizado - se requieren permisos de administrador' },
        { status: 401 }
      );
    }

    const { id: shipmentId } = await params;

    if (!shipmentId) {
      return NextResponse.json(
        { error: 'ID de shipment es requerido' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const responseType = (searchParams.get('response_type') || 'pdf').toLowerCase();

    // Documentación oficial: GET /shipment_labels?shipment_ids=...&response_type=pdf|zpl2
    const auth = await MercadoLibreAuth.getInstance();
    const accessToken = await auth.getAccessToken();

    const url = `https://api.mercadolibre.com/shipment_labels?shipment_ids=${encodeURIComponent(shipmentId)}&response_type=${encodeURIComponent(responseType)}`;

    const mlResponse = await fetch(url, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: 'application/json',
      },
    });

    if (!mlResponse.ok) {
      const errorBody = await mlResponse.text().catch(() => '');
      return NextResponse.json(
        {
          error: 'Error obteniendo etiqueta desde Mercado Libre',
          status: mlResponse.status,
          details: errorBody || mlResponse.statusText,
        },
        { status: 502 }
      );
    }

    const arrayBuffer = await mlResponse.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const safeResponseType = responseType === 'zpl2' ? 'zpl2' : 'pdf';
    const filename = `shipment_${shipmentId}_labels_${safeResponseType}.zip`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: 'Error interno del servidor',
        details: error instanceof Error ? error.message : 'Error desconocido',
      },
      { status: 500 }
    );
  }
}
