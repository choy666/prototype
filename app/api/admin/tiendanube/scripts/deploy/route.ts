import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/actions/auth';
import { createTiendanubeClient } from '@/lib/clients/tiendanube';

interface DeployScriptRequest {
  storeId: string;
  type: 'css' | 'js';
  content: string;
  pages: ('home' | 'product' | 'category' | 'cart')[];
  name?: string;
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const body: DeployScriptRequest = await request.json();
    const { storeId, type, content, pages, name } = body;

    // Validaciones
    if (!storeId || !type || !content || !pages || pages.length === 0) {
      return NextResponse.json(
        { error: 'Faltan parámetros requeridos' },
        { status: 400 }
      );
    }

    // Obtener token de la tienda
    const client = createTiendanubeClient({ 
      storeId, 
      accessToken: 'placeholder' // Debería obtenerse de la DB
    });
    
    // Crear script en Tiendanube
    const scriptData = {
      name: name || `custom-${type}-${Date.now()}`,
      event: 'page_load',
      script: content,
      pages: pages,
      position: 'head' // CSS en head, JS al final
    };

    const response = await client.post('/scripts', scriptData) as { data?: { id?: string } };
    
    return NextResponse.json({
      success: true,
      scriptId: response.data?.id || 'unknown',
      message: `${type.toUpperCase()} deployado exitosamente`
    });

  } catch (error) {
    console.error('[Tiendanube] Error deployando script:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}

interface TiendanubeScript {
  id: string;
  name: string;
  script: string;
  pages: string[];
  position: string;
  created_at: string;
  updated_at: string;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    
    if (!session || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const storeId = searchParams.get('storeId');

    if (!storeId) {
      return NextResponse.json(
        { error: 'storeId es requerido' },
        { status: 400 }
      );
    }

    // Listar scripts existentes
    const client = createTiendanubeClient({ 
      storeId, 
      accessToken: 'placeholder' // Debería obtenerse de la DB
    });
    const response = await client.get('/scripts') as { data?: TiendanubeScript[] };
    
    return NextResponse.json({
      success: true,
      scripts: response.data || []
    });

  } catch (error) {
    console.error('[Tiendanube] Error listando scripts:', error);
    
    if (error instanceof Error) {
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }
    
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}