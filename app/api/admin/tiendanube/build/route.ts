import { NextRequest, NextResponse } from 'next/server';
import { readFile, writeFile } from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { storeId } = body;

    if (!storeId) {
      return NextResponse.json(
        { error: 'storeId es requerido' },
        { status: 400 }
      );
    }

    console.log(`[Tiendanube] Obteniendo build pre-construido para store ${storeId}`);

    // En Vercel, los assets deben estar pre-construidos
    // Leer manifest existente en lugar de ejecutar build
    const manifestPath = path.join(process.cwd(), 'public/tiendanube/manifest.json');
    
    try {
      const manifestContent = await readFile(manifestPath, 'utf8');
      const manifest = JSON.parse(manifestContent);

      // Actualizar con store ID actual
      const deployConfig = {
        storeId,
        manifest,
        buildTime: new Date().toISOString(),
        preBuilt: true
      };

      // Guardar config de deploy sin usar exec
      await writeFile(
        path.join(process.cwd(), 'public/tiendanube/deploy-config.json'),
        JSON.stringify(deployConfig, null, 2)
      );

      console.log('[Tiendanube] Build pre-construido cargado exitosamente');

      return NextResponse.json({
        success: true,
        manifest,
        buildTime: deployConfig.buildTime,
        preBuilt: true,
        message: 'Assets pre-construidos cargados. Para rebuild, ejecuta localmente: npm run build:tiendanube'
      });

    } catch {
      // Si no existe el manifest, guiar al usuario
      return NextResponse.json({
        success: false,
        error: 'No hay assets pre-construidos',
        message: 'Ejecuta localmente: npm run build:tiendanube antes de deployar',
        instructions: {
          step1: 'npm run build:tiendanube',
          step2: 'Commit los archivos en public/tiendanube/',
          step3: 'Deploy a Vercel'
        }
      }, { status: 404 });
    }

  } catch (error) {
    console.error('[Tiendanube] Error cargando build:', error);
    
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