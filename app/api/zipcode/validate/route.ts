import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';

// Cache simple en memoria para zipcodes validados
const zipcodeCache = new Map<string, { valid: boolean; data?: unknown; expires: number }>();

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const zipcode = searchParams.get('zipcode');

    if (!zipcode) {
      return NextResponse.json(
        { error: 'Zipcode is required' },
        { status: 400 }
      );
    }

    // Limpiar zipcode (solo números)
    const cleanZipcode = zipcode.replace(/[^\d]/g, '');

    if (cleanZipcode.length < 4 || cleanZipcode.length > 8) {
      return NextResponse.json(
        { error: 'Formato de código postal inválido' },
        { status: 400 }
      );
    }

    // Verificar cache
    const cached = zipcodeCache.get(cleanZipcode);
    if (cached && cached.expires > Date.now()) {
      logger.info('[Zipcode] Validación desde cache', { zipcode: cleanZipcode });
      return NextResponse.json({
        valid: cached.valid,
        data: cached.data,
        cached: true
      });
    }

    try {
      // Llamar a la API de Mercado Libre
      const response = await fetch(
        `https://api.mercadolibre.com/countries/AR/zip_codes/${cleanZipcode}`
      );

      if (!response.ok) {
        throw new Error('ML API error');
      }

      const data: unknown = await response.json();
      
      // Verificar que la respuesta tenga la estructura esperada
      if (data && typeof data === 'object' && 'zip_code' in data) {
        // Guardar en cache por 1 hora
        zipcodeCache.set(cleanZipcode, {
          valid: true,
          data: data as Record<string, unknown>,
          expires: Date.now() + 3600000 // 1 hora
        });

        logger.info('[Zipcode] Validación exitosa', {
          zipcode: cleanZipcode,
          city: (data as Record<string, unknown>).city ? 'found' : 'N/A',
          state: (data as Record<string, unknown>).state ? 'found' : 'N/A'
        });

        return NextResponse.json({
          valid: true,
          data,
          cached: false
        });
      }

      // Zipcode no encontrado
      zipcodeCache.set(cleanZipcode, {
        valid: false,
        expires: Date.now() + 600000 // 10 minutos
      });

      logger.warn('[Zipcode] No encontrado', { zipcode: cleanZipcode });

      return NextResponse.json({
        valid: false,
        error: 'Código postal no encontrado'
      });

    } catch (error) {
      logger.error('[Zipcode] Error en validación', error);
      
      return NextResponse.json(
        { error: 'Error interno del servidor' },
        { status: 500 }
      );
    }
  } catch (error) {
    logger.error('[Zipcode] Error general', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
