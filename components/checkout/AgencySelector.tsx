'use client';

import { useState, useEffect, useRef } from 'react';
import { Loader2, Clock, Phone, ExternalLink } from 'lucide-react';
import { logger } from '@/lib/utils/logger';
import { FormattedAgency } from '@/types/agency';
import { Button } from '@/components/ui/Button';
import { signIn } from 'next-auth/react';
import dynamic from 'next/dynamic';

const AgencyMapClient = dynamic(
  () => import('./AgencyMapClient').then((mod) => mod.AgencyMapClient),
  { ssr: false },
);

interface AgencySelectorProps {
  zipcode: string;
  onAgencySelect: (agency: FormattedAgency | null, requiresMlCheckout?: boolean) => void;
  onAvailabilityChange?: (available: boolean) => void;
  selectedAgencyId?: string;
  shippingMethodId?: string;
  carrierId?: string;
  logisticType?: string;
  optionId?: string; // Nuevo: option_id de ME2
  optionHash?: string; // Nuevo: option_hash de ME2
  stateId?: string; // Nuevo: state_id para endpoints geográficos
}

export function AgencySelector({ 
  zipcode, 
  onAgencySelect, 
  onAvailabilityChange,
  selectedAgencyId,
  shippingMethodId,
  carrierId,
  logisticType,
  optionId, // Nuevo parámetro
  optionHash, // Nuevo parámetro
  stateId // Nuevo parámetro
}: AgencySelectorProps) {
  console.log('[AgencySelector] Montando componente con:', {
    zipcode,
    shippingMethodId,
    carrierId,
    logisticType,
    optionId,
    optionHash,
    stateId
  });
  
  const [agencies, setAgencies] = useState<FormattedAgency[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | undefined>(selectedAgencyId);
  const [needsMercadoLibreAuth, setNeedsMercadoLibreAuth] = useState(false);
  const lastFetchKeyRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Obtener sucursales cuando cambia el zipcode
  useEffect(() => {
    if (!zipcode) return;

    // Limpiar zipcode
    const cleanZipcode = zipcode.replace(/[^\d]/g, '');

    const fetchKey = JSON.stringify({
      zipcode: cleanZipcode,
      shippingMethodId: shippingMethodId || '',
      carrierId: carrierId || '',
      logisticType: logisticType || '',
      optionId: optionId || '',
      optionHash: optionHash || '',
      stateId: stateId || '',
    });

    if (lastFetchKeyRef.current === fetchKey) {
      return;
    }

    lastFetchKeyRef.current = fetchKey;

    const prevController = abortControllerRef.current;
    if (prevController) {
      prevController.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    const fetchAgencies = async () => {
      setLoading(true);
      setError(null);
      setInfo(null);

      try {
        logger.info('[AgencySelector] Consultando agencias', {
          zipcode,
          shippingMethodId,
          optionId,
          optionHash,
          stateId,
        });

        // Construir URL para consultar agencias a través de nuestro backend
        const params = new URLSearchParams({
          zipcode: cleanZipcode,
          shipping_method_id: shippingMethodId || '',
        });

        if (carrierId) {
          params.append('carrier_id', carrierId);
        }

        if (logisticType) {
          params.append('logistic_type', logisticType);
        }
        
        // Agregar option_id si está disponible (para ME2)
        if (optionId) {
          params.append('option_id', optionId);
        }

        // Agregar option_hash si está disponible (para ME2)
        if (optionHash) {
          params.append('option_hash', optionHash);
        }
        
        // Agregar state_id si está disponible (para endpoints geográficos)
        if (stateId) {
          params.append('state_id', stateId);
        }

        const response = await fetch(`/api/shipments/agencies?${params}`, {
          signal: controller.signal,
        });

        if (!response.ok) {
          const errorText = await response.text();
          let errorMessage = `Error ${response.status}: No se pudieron cargar las sucursales`;
          
          try {
            const errorData = JSON.parse(errorText);
            
            // Manejo específico para errores comunes
            if (
              errorData.error === 'No se encontró token de Mercado Libre' ||
              errorData.error === 'No se encontró token de Mercado Libre configurado' ||
              (typeof errorData.error === 'string' &&
                errorData.error.toLowerCase().includes('token') &&
                errorData.error.toLowerCase().includes('mercado libre'))
            ) {
              errorMessage = 'Debes vincular tu cuenta de Mercado Libre para seleccionar una sucursal';
              setNeedsMercadoLibreAuth(true);
              onAvailabilityChange?.(false);
            } else if (errorData.error === 'No autorizado') {
              errorMessage = 'No tienes permiso para acceder a esta información';
              onAvailabilityChange?.(false);
            } else {
              errorMessage = errorData.error || errorMessage;
            }
          } catch {
            errorMessage = `${errorMessage} - ${errorText}`;
          }
          
          throw new Error(errorMessage);
        }

        const data = await response.json();
        const agenciesList: FormattedAgency[] = data.agencies || [];
        const requiresMlCheckout = data.requiresMlCheckout === true;
        setAgencies(agenciesList);

        // Para ME2 con requiresMlCheckout, considerar como disponible aunque no haya sucursales
        const isAvailable = agenciesList.length > 0 || requiresMlCheckout;
        onAvailabilityChange?.(isAvailable);
        
        // Si es ME2 con requiresMlCheckout, notificar al componente padre
        if (requiresMlCheckout) {
          // Llamar a onAgencySelect con null y el flag especial
          console.log('[AgencySelector] Enviando requiresMlCheckout=true al componente padre');
          onAgencySelect(null, true);
        }
        
        // Si no hay sucursales, mostrar mensaje informativo
        if (agenciesList.length === 0) {
          const apiMessage = typeof data.message === 'string' ? data.message : null;
          
          if (requiresMlCheckout && apiMessage) {
            // Mensaje especial para ME2 que requiere checkout de ML
            setInfo(apiMessage);
          } else {
            setInfo(
              apiMessage ||
                `No hay sucursales disponibles para envío a agencia en el código postal ${zipcode}. Puedes seleccionar envío a domicilio.`
            );
          }
        }
        
        logger.info('[AgencySelector] Sucursales cargadas', {
          zipcode: cleanZipcode,
          count: data.agencies?.length || 0
        });
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
          return;
        }
        console.error('[AgencySelector] Raw error:', err);
        console.error('[AgencySelector] Error type:', typeof err);
        console.error('[AgencySelector] Error instanceof Error:', err instanceof Error);
        
        const errorMessage = err instanceof Error ? err.message : 'Error desconocido';
        setError(errorMessage);
        onAvailabilityChange?.(false);
        logger.error('[AgencySelector] Error cargando sucursales', {
          zipcode,
          error: errorMessage,
          errorDetails: err instanceof Error ? err.stack : err
        });
      } finally {
        setLoading(false);
      }
    };

    fetchAgencies();

    return () => {
      controller.abort();
    };
  }, [zipcode, shippingMethodId, carrierId, logisticType, optionId, optionHash, stateId, onAvailabilityChange, onAgencySelect]);

  // Manejar selección de sucursal
  const handleAgencySelect = (agency: FormattedAgency) => {
    setSelectedId(agency.id);
    onAgencySelect(agency);
    logger.info('[AgencySelector] Sucursal seleccionada', {
      agencyId: agency.id,
      agencyName: agency.name,
      zipcode: agency.address.zipcode
    });
  };

  // Deseleccionar sucursal
  const handleClearSelection = () => {
    setSelectedId(undefined);
    onAgencySelect(null);
  };

  // Manejar vinculación con Mercado Libre
  const handleMercadoLibreAuth = async () => {
    try {
      await signIn('mercadolibre', { 
        callbackUrl: window.location.href,
        redirect: false 
      });
      // Recargar la página después de la autenticación
      window.location.reload();
    } catch (error) {
      console.error('Error al vincular Mercado Libre:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8 border rounded-lg bg-gray-50">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        <span className="text-gray-600">Cargando sucursales...</span>
      </div>
    );
  }

  if (info) {
    return (
      <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
        <p className="text-gray-700 text-sm">{info}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 border rounded-lg bg-red-50">
        <div className="flex items-start space-x-3">
          <div className="flex-1">
            <p className="text-red-800 font-medium">{error}</p>
            {needsMercadoLibreAuth && (
              <div className="mt-3">
                <p className="text-sm text-red-700 mb-2">
                  Vincula tu cuenta de Mercado Libre para poder seleccionar una sucursal de envío.
                </p>
                <Button
                  onClick={handleMercadoLibreAuth}
                  className="bg-[#FFE600] hover:bg-[#f0d900] text-[#2D3277] border-transparent text-sm"
                >
                  <ExternalLink className="w-4 h-4 mr-2" />
                  Vincular cuenta de Mercado Libre
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (agencies.length === 0) {
    return (
      <div className="p-4 border border-gray-200 rounded-lg bg-gray-50">
        <p className="text-gray-600 text-sm">
          No hay sucursales disponibles para el código postal {zipcode}
        </p>
      </div>
    );
  }

  const agenciesWithCoords = agencies.filter(
    (agency) => agency.coordinates.latitude != null && agency.coordinates.longitude != null,
  );

  return (
    <div className="space-y-3">
      {agenciesWithCoords.length > 0 && (
        <AgencyMapClient
          agencies={agenciesWithCoords}
          selectedAgencyId={selectedId}
          onAgencySelect={handleAgencySelect}
        />
      )}

      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-gray-900">
          Selecciona una sucursal
        </h3>
        {selectedId && (
          <button
            type="button"
            onClick={handleClearSelection}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Limpiar selección
          </button>
        )}
      </div>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {agencies.map((agency) => (
          <label
            key={agency.id}
            className={`
              block p-3 border rounded-lg cursor-pointer transition-colors
              ${selectedId === agency.id
                ? 'border-blue-500 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
              }`
          }>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {agency.name}
                </p>
                <span className="text-xs text-gray-500 ml-2">
                  {agency.carrier.name}
                </span>
              </div>
              
              <p className="text-xs text-gray-600 mt-1">
                {agency.address.street} {agency.address.number}
                {agency.address.city && `, ${agency.address.city}`}
                {agency.address.state && `, ${agency.address.state}`}
              </p>
              
              <div className="flex items-center space-x-4 mt-2">
                {agency.phone && (
                  <div className="flex items-center text-xs text-gray-500">
                    <Phone className="w-3 h-3 mr-1" />
                    {agency.phone}
                  </div>
                )}
                
                {agency.hours && (
                  <div className="flex items-center text-xs text-gray-500">
                    <Clock className="w-3 h-3 mr-1" />
                    <span className="truncate">{agency.hours}</span>
                  </div>
                )}
              </div>
            </div>
          </label>
        ))}
      </div>

      {selectedId && (
        <p className="text-xs text-green-600 mt-2">
          ✓ Sucursal seleccionada correctamente
        </p>
      )}
    </div>
  );
}
