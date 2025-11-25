import { NextRequest, NextResponse } from 'next/server';
import { MercadoLibreAuth } from '@/lib/auth/mercadolibre';
import { db } from '@/lib/db';
import { categories } from '@/lib/schema';
import { eq, and } from 'drizzle-orm';
import { auth } from '@/lib/actions/auth';

export async function POST(request: NextRequest) {
  try {
    // Verificar autenticación de admin
    const session = await auth();
    if (!session?.user?.role || session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'No autorizado' },
        { status: 401 }
      );
    }
    const body = await request.json();
    const { title, description, price } = body;

    if (!title) {
      return NextResponse.json(
        { error: 'El título del producto es requerido' },
        { status: 400 }
      );
    }

    // Obtener token de acceso de Mercado Libre
    const mlAuth = new MercadoLibreAuth();
    const accessToken = await mlAuth.getAccessToken();

    if (!accessToken) {
      return NextResponse.json(
        { error: 'No se pudo obtener el token de acceso de Mercado Libre' },
        { status: 500 }
      );
    }

    // Llamar al category_predictor de ML
    const predictUrl = 'https://api.mercadolibre.com/sites/MLA/category_predictor/predict';
    const predictParams = new URLSearchParams({
      title: title.trim(),
      ...(description && { description: description.trim() }),
      ...(price && { price: price.toString() }),
    });

    const predictResponse = await fetch(`${predictUrl}?${predictParams}`, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json',
      },
    });

    if (!predictResponse.ok) {
      console.error('ML category predictor error:', predictResponse.status);
      return NextResponse.json(
        { error: 'Error al predecir categoría con Mercado Libre' },
        { status: 500 }
      );
    }

    const mlPrediction = await predictResponse.json();

    // Extraer la categoría predicha (viene como id)
    if (!mlPrediction.id) {
      return NextResponse.json(
        { error: 'No se pudo obtener una predicción de categoría válida' },
        { status: 404 }
      );
    }

    // Buscar si esta categoría existe en nuestra BD y es hoja
    const localCategory = await db
      .select()
      .from(categories)
      .where(
        and(
          eq(categories.mlCategoryId, mlPrediction.id),
          eq(categories.isLeaf, true),
          eq(categories.isMlOfficial, true)
        )
      )
      .limit(1);

    if (localCategory.length === 0) {
      // La categoría predicha no está en nuestro catálogo local
      return NextResponse.json({
        prediction: {
          mlCategoryId: mlPrediction.id,
          mlName: mlPrediction.name || 'Categoría ML',
          foundInLocalCatalog: false,
          localCategoryId: null,
          localName: null,
        },
        message: `La categoría predicha (${mlPrediction.id} - ${mlPrediction.name}) no está en el catálogo local configurado. Por favor, seleccione una categoría de la lista disponible.`,
      });
    }

    // La categoría está en nuestro catálogo local
    return NextResponse.json({
      prediction: {
        mlCategoryId: mlPrediction.id,
        mlName: mlPrediction.name || localCategory[0].name,
        foundInLocalCatalog: true,
        localCategoryId: localCategory[0].id,
        localName: localCategory[0].name,
      },
      message: `Categoría sugerida: ${localCategory[0].name} (ML: ${mlPrediction.id})`,
    });
  } catch (error) {
    console.error('Error in category-predict endpoint:', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
