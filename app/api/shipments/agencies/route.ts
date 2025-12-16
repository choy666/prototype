import { NextRequest, NextResponse } from 'next/server';
import { MercadoLibreAuth } from '@/lib/auth/mercadolibre';
import { logger } from '@/lib/utils/logger';
import { Agency, FormattedAgency } from '@/types/agency';
import { db } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const zipcode = searchParams.get('zipcode');
    const carrierId = searchParams.get('carrier_id');
    const shippingMethodId = searchParams.get('shipping_method_id');
    const logisticType = searchParams.get('logistic_type') || 'me2';

    if (!zipcode) {
      return NextResponse.json(
        { error: 'El zipcode es requerido' },
        { status: 400 }
      );
    }

    // Limpiar zipcode para que solo contenga números
    const cleanZipcode = zipcode.replace(/[^\d]/g, '');

    // Obtener token de Mercado Libre - usar la misma autenticación que el endpoint de cálculo
    const auth = await MercadoLibreAuth.getInstance();
    const accessToken = await auth.getAccessToken();
    
    if (!accessToken) {
      return NextResponse.json(
        { error: 'No se encontró token de Mercado Libre' },
        { status: 401 }
      );
    }

    const tokenOwner = await db.query.users.findFirst({
      where: (u, { isNotNull }) => isNotNull(u.mercadoLibreAccessToken),
      columns: {
        mercadoLibreId: true,
      },
    });

    if (!tokenOwner?.mercadoLibreId) {
      return NextResponse.json(
        { error: 'No se encontró usuario de Mercado Libre asociado al token' },
        { status: 401 }
      );
    }

    const methodUrl = shippingMethodId
      ? `https://api.mercadolibre.com/shipping_methods/${encodeURIComponent(shippingMethodId)}`
      : null;

    let derivedCarrierId: string | null = carrierId ? String(carrierId) : null;

    logger.info('[Agencies] Consultando sucursales', {
      zipcode: cleanZipcode,
      carrierId,
      shippingMethodId,
      logisticType,
      debug: {
        receivedCarrierId: carrierId,
        derivedCarrierId: derivedCarrierId,
        methodUrl,
      },
    });

    // Para ME2, intentar primero con el option_id directamente si está disponible
    // Las opciones ME2 tipo agency pueden tener su propio endpoint de agencies
    const me2OptionId = searchParams.get('option_id');
    const me2OptionHash = searchParams.get('option_hash');
    const stateId = searchParams.get('state_id'); // AR-M para Mendoza, etc.

    const me2OptionRef = me2OptionId || me2OptionHash;

    const allowMe2AgenciesPreCheckout = process.env.ML_ENABLE_ME2_AGENCIES_PRECHECK === 'true';

    if (logisticType === 'me2' && me2OptionRef && allowMe2AgenciesPreCheckout) {
      // Opción 1: Usar endpoint con seller_id (recomendado para ME2)
      const me2AgenciesUrl = `https://api.mercadolibre.com/users/${tokenOwner.mercadoLibreId}/shipping_options/${encodeURIComponent(me2OptionRef)}/agencies?zip_code=${encodeURIComponent(cleanZipcode)}`;
      
      logger.info('[Agencies] Intentando obtener sucursales ME2 con seller_id', {
        sellerId: tokenOwner.mercadoLibreId,
        optionId: me2OptionId,
        optionHash: me2OptionHash,
        optionRef: me2OptionRef,
        zipcode: cleanZipcode,
        url: me2AgenciesUrl
      });
      
      try {
        const me2Response = await fetch(me2AgenciesUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (me2Response.ok) {
          const rawAgencies = await me2Response.json();
          const agencies: Agency[] = Array.isArray(rawAgencies)
            ? rawAgencies
            : Array.isArray((rawAgencies as { agencies?: unknown[] }).agencies)
              ? ((rawAgencies as { agencies: unknown[] }).agencies as Agency[])
              : Array.isArray((rawAgencies as { results?: unknown[] }).results)
                ? ((rawAgencies as { results: unknown[] }).results as Agency[])
                : [];
          
          const formattedAgencies: FormattedAgency[] = agencies.map((agency: Agency): FormattedAgency => ({
            id: agency.agency_id,
            name: agency.description,
            address: {
              street: agency.address?.street_name || '',
              number: agency.address?.street_number || '',
              city: agency.address?.city?.name || '',
              state: agency.address?.state?.name || '',
              zipcode: agency.address?.zip_code || ''
            },
            phone: agency.phone || '',
            hours: agency.open_hours || '',
            carrier: {
              id: agency.carrier_id || '',
              name: agency.carrier_name || ''
            },
            coordinates: {
              latitude: agency.latitude || null,
              longitude: agency.longitude || null
            }
          }));
          
          logger.info('[Agencies] Éxito obteniendo sucursales ME2 con seller_id', {
            sellerId: tokenOwner.mercadoLibreId,
            optionId: me2OptionId,
            optionHash: me2OptionHash,
            optionRef: me2OptionRef,
            agenciesCount: formattedAgencies.length
          });
          
          return NextResponse.json({
            zipcode: cleanZipcode,
            agencies: formattedAgencies
          });
        } else {
          const errorText = await me2Response.text();
          logger.warn('[Agencies] Endpoint ME2 seller_id falló', {
            sellerId: tokenOwner.mercadoLibreId,
            optionId: me2OptionId,
            optionHash: me2OptionHash,
            optionRef: me2OptionRef,
            status: me2Response.status,
            error: errorText
          });
        }
      } catch (error) {
        logger.warn('[Agencies] Error con endpoint ME2 seller_id, continuando con flujo normal', {
          sellerId: tokenOwner.mercadoLibreId,
          optionId: me2OptionId,
          optionHash: me2OptionHash,
          optionRef: me2OptionRef,
          error: error instanceof Error ? error.message : String(error)
        });
      }
      
      // Opción 2: Usar endpoint con shipping_option_id (alternativo)
      const alternativeUrl = me2OptionId
        ? `https://api.mercadolibre.com/shipments/agencies?zip_code=${encodeURIComponent(cleanZipcode)}&shipping_option_id=${encodeURIComponent(me2OptionId)}`
        : null;
      
      logger.info('[Agencies] Intentando obtener sucursales ME2 con shipping_option_id (alternativo)', {
        optionId: me2OptionId,
        optionHash: me2OptionHash,
        optionRef: me2OptionRef,
        zipcode: cleanZipcode,
        url: alternativeUrl
      });
      
      try {
        const altResponse = alternativeUrl ? await fetch(alternativeUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        }) : null;
        
        if (altResponse && altResponse.ok) {
          const rawAgencies = await altResponse.json();
          const agencies: Agency[] = Array.isArray(rawAgencies)
            ? rawAgencies
            : Array.isArray((rawAgencies as { agencies?: unknown[] }).agencies)
              ? ((rawAgencies as { agencies: unknown[] }).agencies as Agency[])
              : Array.isArray((rawAgencies as { results?: unknown[] }).results)
                ? ((rawAgencies as { results: unknown[] }).results as Agency[])
                : [];
          
          const formattedAgencies: FormattedAgency[] = agencies.map((agency: Agency): FormattedAgency => ({
            id: agency.agency_id,
            name: agency.description,
            address: {
              street: agency.address?.street_name || '',
              number: agency.address?.street_number || '',
              city: agency.address?.city?.name || '',
              state: agency.address?.state?.name || '',
              zipcode: agency.address?.zip_code || ''
            },
            phone: agency.phone || '',
            hours: agency.open_hours || '',
            carrier: {
              id: agency.carrier_id || '',
              name: agency.carrier_name || ''
            },
            coordinates: {
              latitude: agency.latitude || null,
              longitude: agency.longitude || null
            }
          }));
          
          logger.info('[Agencies] Éxito obteniendo sucursales ME2 con shipping_option_id (alternativo)', {
            optionId: me2OptionId,
            optionHash: me2OptionHash,
            optionRef: me2OptionRef,
            agenciesCount: formattedAgencies.length
          });
          
          return NextResponse.json({
            zipcode: cleanZipcode,
            agencies: formattedAgencies
          });
        } else if (altResponse) {
          const errorText = await altResponse.text();
          logger.warn('[Agencies] Endpoint ME2 shipping_option_id alternativo falló', {
            optionId: me2OptionId,
            optionHash: me2OptionHash,
            optionRef: me2OptionRef,
            status: altResponse.status,
            error: errorText
          });
        }
      } catch (error) {
        logger.warn('[Agencies] Error con endpoint ME2 shipping_option_id alternativo', {
          optionId: me2OptionId,
          optionHash: me2OptionHash,
          optionRef: me2OptionRef,
          error: error instanceof Error ? error.message : String(error)
        });
      }
      
      // Opción 3: Usar endpoint directo con option_id
      const optionUrl = `https://api.mercadolibre.com/shipping_options/${encodeURIComponent(me2OptionRef)}/agencies?zip_code=${encodeURIComponent(cleanZipcode)}`;
      
      logger.info('[Agencies] Intentando obtener sucursales ME2 con option_id (tercer intento)', {
        optionId: me2OptionId,
        optionHash: me2OptionHash,
        optionRef: me2OptionRef,
        zipcode: cleanZipcode,
        url: optionUrl
      });
      
      try {
        const optionResponse = await fetch(optionUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (optionResponse.ok) {
          const rawAgencies = await optionResponse.json();
          const agencies: Agency[] = Array.isArray(rawAgencies)
            ? rawAgencies
            : Array.isArray((rawAgencies as { agencies?: unknown[] }).agencies)
              ? ((rawAgencies as { agencies: unknown[] }).agencies as Agency[])
              : Array.isArray((rawAgencies as { results?: unknown[] }).results)
                ? ((rawAgencies as { results: unknown[] }).results as Agency[])
                : [];
          
          const formattedAgencies: FormattedAgency[] = agencies.map((agency: Agency): FormattedAgency => ({
            id: agency.agency_id,
            name: agency.description,
            address: {
              street: agency.address?.street_name || '',
              number: agency.address?.street_number || '',
              city: agency.address?.city?.name || '',
              state: agency.address?.state?.name || '',
              zipcode: agency.address?.zip_code || ''
            },
            phone: agency.phone || '',
            hours: agency.open_hours || '',
            carrier: {
              id: agency.carrier_id || '',
              name: agency.carrier_name || ''
            },
            coordinates: {
              latitude: agency.latitude || null,
              longitude: agency.longitude || null
            }
          }));
          
          logger.info('[Agencies] Éxito obteniendo sucursales ME2 con option_id (tercer intento)', {
            optionId: me2OptionId,
            optionHash: me2OptionHash,
            optionRef: me2OptionRef,
            agenciesCount: formattedAgencies.length
          });
          
          return NextResponse.json({
            zipcode: cleanZipcode,
            agencies: formattedAgencies
          });
        } else {
          const errorText = await optionResponse.text();
          logger.warn('[Agencies] Endpoint ME2 option_id tercer intento falló', {
            optionId: me2OptionId,
            optionHash: me2OptionHash,
            optionRef: me2OptionRef,
            status: optionResponse.status,
            error: errorText
          });
        }
      } catch (error) {
        logger.warn('[Agencies] Error con endpoint ME2 option_id tercer intento', {
          optionId: me2OptionId,
          optionHash: me2OptionHash,
          optionRef: me2OptionRef,
          error: error instanceof Error ? error.message : String(error)
        });
      }
      
      // Opción 4: Usar endpoint geográfico por estado si tenemos state_id
      if (stateId) {
        const geoAgenciesUrl = `https://api.mercadolibre.com/sites/MLA/shipping/places?state=${encodeURIComponent(stateId)}&zip_code=${encodeURIComponent(cleanZipcode)}`;
        
        logger.info('[Agencies] Intentando obtener sucursales ME2 por estado', {
          stateId,
          zipcode: cleanZipcode,
          url: geoAgenciesUrl
        });
        
        try {
          const geoResponse = await fetch(geoAgenciesUrl, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json'
            }
          });
          
          if (geoResponse.ok) {
            const rawAgencies = await geoResponse.json();
            const agencies: Agency[] = Array.isArray(rawAgencies)
              ? rawAgencies
              : Array.isArray((rawAgencies as { results?: unknown[] }).results)
                ? ((rawAgencies as { results: unknown[] }).results as Agency[])
                : [];
            
            const formattedAgencies: FormattedAgency[] = agencies.map((agency: Agency): FormattedAgency => ({
              id: agency.agency_id,
              name: agency.description,
              address: {
                street: agency.address?.street_name || '',
                number: agency.address?.street_number || '',
                city: agency.address?.city?.name || '',
                state: agency.address?.state?.name || '',
                zipcode: agency.address?.zip_code || ''
              },
              phone: agency.phone || '',
              hours: agency.open_hours || '',
              carrier: {
                id: agency.carrier_id || '',
                name: agency.carrier_name || 'Correo Argentino'
              },
              coordinates: {
                latitude: agency.latitude || null,
                longitude: agency.longitude || null
              }
            }));
            
            logger.info('[Agencies] Éxito obteniendo sucursales ME2 por estado', {
              stateId,
              agenciesCount: formattedAgencies.length
            });
            
            return NextResponse.json({
              zipcode: cleanZipcode,
              agencies: formattedAgencies
            });
          } else {
            const errorText = await geoResponse.text();
            logger.warn('[Agencies] Endpoint ME2 geográfico falló', {
              stateId,
              status: geoResponse.status,
              error: errorText
            });
          }
        } catch (error) {
          logger.warn('[Agencies] Error con endpoint ME2 geográfico', {
            stateId,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }
      
      // Si todos los intentos fallan, mostrar mensaje informativo
      logger.warn('[Agencies] Todos los endpoints ME2 fallaron, posible limitación de Mercado Libre', {
        optionId: me2OptionId,
        optionHash: me2OptionHash,
        optionRef: me2OptionRef,
        zipcode: cleanZipcode,
        message: 'ME2 podría no permitir selección anticipada de sucursales'
      });

      // IMPORTANTE:
      // Aunque ML no exponga agencias por option_id (endpoints ME2), todavía podemos intentar el flujo clásico
      // por carrier_id (derivado desde shipping_method_id) para ver si ML devuelve sucursales.
      // Si ese flujo también falla o no devuelve resultados, recién ahí informamos requiresMlCheckout.
    }

    if (logisticType === 'me2') {
      return NextResponse.json({
        zipcode: cleanZipcode,
        agencies: [],
        message:
          'No se pudieron obtener sucursales antes del pago desde la API de Mercado Libre (ME2). Podrás continuar con el pago y confirmar el punto de retiro al volver a la tienda.',
        requiresMlCheckout: true,
      });
    }

    // Construir URL para obtener sucursales
    // Para opciones tipo "agency" provenientes de /items/{id}/shipping_options, el identificador clave es shipping_method_id
    if (!shippingMethodId && !carrierId) {
      logger.warn('[Agencies] No se puede obtener sucursales sin identificador de método', {
        zipcode: cleanZipcode
      });

      return NextResponse.json({
        zipcode: cleanZipcode,
        agencies: [],
        message: 'Para ver sucursales disponibles, primero selecciona un método de envío'
      });
    }

    const agenciesUrlForCarrier = (id: string) =>
      `https://api.mercadolibre.com/shipments/agencies?zip_code=${encodeURIComponent(cleanZipcode)}&carrier_id=${encodeURIComponent(id)}${logisticType && logisticType !== 'me2' ? `&logistic_type=${encodeURIComponent(logisticType)}` : ''}`;

    if (!derivedCarrierId && methodUrl) {
      let methodResponse = await fetch(methodUrl, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });

      if (!methodResponse.ok) {
        const methodErrorText = await methodResponse.text().catch(() => '');
        logger.warn('[Agencies] No se pudo obtener detalle de shipping_method', {
          status: methodResponse.status,
          error: methodErrorText,
          shippingMethodId,
          url: methodUrl,
        });

        methodResponse = await fetch(methodUrl, {
          headers: {
            'Content-Type': 'application/json'
          }
        });

        if (!methodResponse.ok) {
          const methodErrorTextNoAuth = await methodResponse.text().catch(() => '');
          logger.warn('[Agencies] No se pudo obtener detalle de shipping_method (sin auth)', {
            status: methodResponse.status,
            error: methodErrorTextNoAuth,
            shippingMethodId,
            url: methodUrl,
          });
        }
      }

      if (methodResponse.ok) {
        const methodData = await methodResponse.json();
        derivedCarrierId =
          (methodData && typeof methodData === 'object' && 'carrier_id' in methodData && methodData.carrier_id != null)
            ? String(methodData.carrier_id)
            : (methodData && typeof methodData === 'object' && 'carrier' in methodData && methodData.carrier && typeof methodData.carrier === 'object' && 'id' in methodData.carrier && methodData.carrier.id != null)
              ? String(methodData.carrier.id)
              : (methodData && typeof methodData === 'object' && 'company_id' in methodData && methodData.company_id != null)
                ? String(methodData.company_id)
                : (methodData && typeof methodData === 'object' && 'company' in methodData && methodData.company && typeof methodData.company === 'object' && 'id' in methodData.company && methodData.company.id != null)
                  ? String(methodData.company.id)
                  : null;

        // Validar que el derivedCarrierId no sea un company_id
        // Los company_ids suelen empezar con 1 y tienen 7+ dígitos, mientras que carrier_ids válidos suelen ser más cortos
        if (derivedCarrierId && derivedCarrierId.length >= 7 && derivedCarrierId.startsWith('1')) {
          logger.warn('[Agencies] Posible company_id detectado, evitando usar como carrier_id', {
            derivedCarrierId,
            shippingMethodId,
            reason: 'company_id no es válido para endpoint de agencies'
          });
          derivedCarrierId = null; // Forzar a usar fallback
        }

        // Si no se pudo derivar un carrier_id válido, usar fallback para opciones de retiro
        if (!derivedCarrierId) {
          logger.warn('[Agencies] No se pudo derivar carrier_id, usando fallback para retiro en sucursal', {
            shippingMethodId,
            url: methodUrl,
            methodDataType: typeof methodData,
          });
          
          // Usar carrier_ids conocidos para retiro en sucursal en Argentina
          // Para ME2, necesitamos identificar el carrier correcto basado en el método
          const fallbackCarriers: Record<string, string> = {
            '504345': '154', // Estándar a sucursal -> OCA
            '73328': '154',  // Estándar a domicilio -> OCA (fallback)
            'default': '154' // OCA como fallback general
          };
          
          derivedCarrierId = fallbackCarriers[shippingMethodId || ''] || fallbackCarriers['default'];
        }

        logger.info('[Agencies] Carrier ID derivado', {
          shippingMethodId,
          derivedCarrierId,
          isFallback: derivedCarrierId === '154',
          methodDataKeys: methodData && typeof methodData === 'object' ? Object.keys(methodData as Record<string, unknown>).slice(0, 30) : null,
        });
      }
    }

    const url = derivedCarrierId ? agenciesUrlForCarrier(derivedCarrierId) : null;

    logger.info('[Agencies] Consultando API de Mercado Libre', {
      url,
      fallbackUrl: null,
      zipcode: cleanZipcode,
      carrierId,
      shippingMethodId,
      logisticType
    });

    if (!url) {
      return NextResponse.json({
        zipcode: cleanZipcode,
        agencies: [],
        message: 'No se pudo determinar el transportista para obtener sucursales'
      });
    }

    // Hacer llamada a la API de Mercado Libre
    let response: Response;
    try {
      response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      });
    } catch (fetchError) {
      logger.error('[Agencies] Error de red consultando Mercado Libre', {
        zipcode: cleanZipcode,
        url,
        error: fetchError instanceof Error ? fetchError.message : String(fetchError),
      });

      return NextResponse.json({
        zipcode: cleanZipcode,
        agencies: [],
        message: 'No se pudieron obtener sucursales por un error de conexión con Mercado Libre.'
      });
    }

    if (!response.ok) {
      const errorText = await response.text();
      
      // Si es 404, intentar con carrier_ids de fallback conocidos
      if (response.status === 404 && derivedCarrierId !== '154') {
        logger.warn('[Agencies] 404 con carrier_id derivado, intentando fallback con OCA', {
          status: response.status,
          error: errorText,
          zipcode: cleanZipcode,
          originalCarrierId: derivedCarrierId,
          url,
        });
        
        // Intentar con OCA (154)
        const fallbackUrl = agenciesUrlForCarrier('154');
        const fallbackResponse = await fetch(fallbackUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (fallbackResponse.ok) {
          logger.info('[Agencies] Éxito con fallback OCA', {
            zipcode: cleanZipcode,
            fallbackCarrierId: '154',
          });
          
          const rawAgencies = await fallbackResponse.json();
          const agencies: Agency[] = Array.isArray(rawAgencies)
            ? rawAgencies
            : Array.isArray((rawAgencies as { agencies?: unknown[] }).agencies)
              ? ((rawAgencies as { agencies: unknown[] }).agencies as Agency[])
              : Array.isArray((rawAgencies as { results?: unknown[] }).results)
                ? ((rawAgencies as { results: unknown[] }).results as Agency[])
                : [];
          
          const formattedAgencies: FormattedAgency[] = agencies.map((agency: Agency): FormattedAgency => ({
            id: agency.agency_id,
            name: agency.description,
            address: {
              street: agency.address?.street_name || '',
              number: agency.address?.street_number || '',
              city: agency.address?.city?.name || '',
              state: agency.address?.state?.name || '',
              zipcode: agency.address?.zip_code || ''
            },
            phone: agency.phone || '',
            hours: agency.open_hours || '',
            carrier: {
              id: agency.carrier_id || '',
              name: agency.carrier_name || ''
            },
            coordinates: {
              latitude: agency.latitude || null,
              longitude: agency.longitude || null
            }
          }));
          
          return NextResponse.json({
            zipcode: cleanZipcode,
            agencies: formattedAgencies
          });
        }
      }
      
      logger.error('[Agencies] Error obteniendo sucursales', {
        status: response.status,
        error: errorText,
        zipcode: cleanZipcode,
        url
      });

      // Si venimos de ME2 con option_id, y el flujo por carrier_id tampoco funciona,
      // informar que la selección se hará en Mercado Libre.
      if (logisticType === 'me2' && me2OptionRef) {
        return NextResponse.json({
          zipcode: cleanZipcode,
          agencies: [],
          message:
            'No se pudieron obtener sucursales antes del pago desde la API de Mercado Libre (ME2). Podrás continuar con el pago y confirmar el punto de retiro al volver a la tienda.',
          requiresMlCheckout: true,
          mercadoLibreStatus: response.status,
        });
      }

      return NextResponse.json({
        zipcode: cleanZipcode,
        agencies: [],
        message: 'No hay sucursales disponibles para este método/código postal (Mercado Libre no devolvió resultados).',
        mercadoLibreStatus: response.status,
      });
    }

    const rawAgencies = await response.json();
    const agencies: Agency[] = Array.isArray(rawAgencies)
      ? rawAgencies
      : Array.isArray((rawAgencies as { agencies?: unknown[] }).agencies)
        ? ((rawAgencies as { agencies: unknown[] }).agencies as Agency[])
        : Array.isArray((rawAgencies as { results?: unknown[] }).results)
          ? ((rawAgencies as { results: unknown[] }).results as Agency[])
          : [];

    logger.info('[Agencies] Respuesta de Mercado Libre', {
      zipcode: cleanZipcode,
      agenciesCount: agencies.length,
      responseStatus: response.status,
      url: url
    });

    // Si no hay sucursales, devolver mensaje informativo
    if (agencies.length === 0) {
      logger.warn('[Agencies] No se encontraron sucursales', {
        zipcode: cleanZipcode,
        carrierId,
        logisticType,
        url
      });

      if (logisticType === 'me2' && me2OptionRef) {
        return NextResponse.json({
          zipcode: cleanZipcode,
          agencies: [],
          message:
            'No se pudieron obtener sucursales antes del pago desde la API de Mercado Libre (ME2). Podrás continuar con el pago y confirmar el punto de retiro al volver a la tienda.',
          requiresMlCheckout: true,
        });
      }
      
      return NextResponse.json({
        zipcode: cleanZipcode,
        agencies: [],
        message: 'No hay sucursales disponibles para este código postal'
      });
    }

    // Formatear respuesta
    const formattedAgencies: FormattedAgency[] = agencies.map((agency: Agency): FormattedAgency => ({
      id: agency.agency_id,
      name: agency.description,
      address: {
        street: agency.address?.street_name || '',
        number: agency.address?.street_number || '',
        city: agency.address?.city?.name || '',
        state: agency.address?.state?.name || '',
        zipcode: agency.address?.zip_code || ''
      },
      phone: agency.phone || '',
      hours: agency.open_hours || '',
      carrier: {
        id: agency.carrier_id || '',
        name: agency.carrier_name || ''
      },
      coordinates: {
        latitude: agency.latitude || null,
        longitude: agency.longitude || null
      }
    }));

    return NextResponse.json({
      zipcode: cleanZipcode,
      agencies: formattedAgencies
    });

  } catch (error) {
    logger.error('[Agencies] Error inesperado', error);
    return NextResponse.json(
      { error: 'Error interno del servidor' },
      { status: 500 }
    );
  }
}
