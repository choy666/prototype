import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/actions/auth';
import { createTiendanubeClient } from '@/lib/clients/tiendanube';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ scriptId: string }> }
) {
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
    const { scriptId } = await params;

    if (!storeId) {
      return NextResponse.json(
        { error: 'storeId es requerido' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { content, pages, name } = body;

    // Actualizar script existente
    const client = createTiendanubeClient({ 
      storeId, 
      accessToken: 'placeholder' // Debería obtenerse de la DB
    });
    
    const updateData: {
      script?: string;
      pages?: string[];
      name?: string;
    } = {};
    if (content) updateData.script = content;
    if (pages) updateData.pages = pages;
    if (name) updateData.name = name;

    const response = await client.put(`/scripts/${scriptId}`, updateData) as {
      data: {
        id: string;
        name: string;
        script: string;
        pages: string[];
        position: string;
        created_at: string;
        updated_at: string;
      };
    };
    
    return NextResponse.json({
      success: true,
      script: response.data,
      message: 'Script actualizado exitosamente'
    });

  } catch (error) {
    console.error('[Tiendanube] Error actualizando script:', error);
    
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

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ scriptId: string }> }
) {
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
    const { scriptId } = await params;

    if (!storeId) {
      return NextResponse.json(
        { error: 'storeId es requerido' },
        { status: 400 }
      );
    }

    // Eliminar script
    const client = createTiendanubeClient({ 
      storeId, 
      accessToken: 'placeholder' // Debería obtenerse de la DB
    });
    await client.delete(`/scripts/${scriptId}`);
    
    return NextResponse.json({
      success: true,
      message: 'Script eliminado exitosamente'
    });

  } catch (error) {
    console.error('[Tiendanube] Error eliminando script:', error);
    
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
