'use client';

import type { ComponentProps, ComponentType, ReactNode } from 'react';
import { useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, CircleMarker, Popup, useMap } from 'react-leaflet';
import type { FormattedAgency } from '@/types/agency';

type LatLng = [number, number];

function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap();

  useEffect(() => {
    if (!points.length) return;

    if (points.length === 1) {
      map.setView(points[0], 13, { animate: false });
      return;
    }

    map.fitBounds(points, { padding: [24, 24], animate: false });
  }, [map, points]);

  return null;
}

export function AgencyMapClient({
  agencies,
  selectedAgencyId,
  onAgencySelect,
}: {
  agencies: FormattedAgency[];
  selectedAgencyId?: string;
  onAgencySelect: (agency: FormattedAgency) => void;
}) {
  const agenciesWithCoords = useMemo(
    () =>
      agencies.filter(
        (agency) => agency.coordinates.latitude != null && agency.coordinates.longitude != null,
      ),
    [agencies],
  );

  const points = useMemo<LatLng[]>(
    () =>
      agenciesWithCoords.map((a) => [a.coordinates.latitude as number, a.coordinates.longitude as number]),
    [agenciesWithCoords],
  );

  const fallbackCenter: LatLng = [-34.6037, -58.3816];

  const selected = selectedAgencyId
    ? agenciesWithCoords.find((a) => a.id === selectedAgencyId)
    : undefined;

  const initialCenter: LatLng = selected
    ? [selected.coordinates.latitude as number, selected.coordinates.longitude as number]
    : points[0] ?? fallbackCenter;

  const mapProps = {
    center: initialCenter,
    zoom: 12,
    scrollWheelZoom: false,
    style: { height: 320, width: '100%' },
  } as unknown as ComponentProps<typeof MapContainer>;

  const TileLayerCompat = TileLayer as unknown as ComponentType<{
    attribution?: string;
    url: string;
  }>;

  const CircleMarkerCompat = CircleMarker as unknown as ComponentType<{
    center: LatLng;
    radius?: number;
    pathOptions?: {
      color: string;
      fillColor: string;
      fillOpacity: number;
      weight: number;
    };
    eventHandlers?: {
      click?: () => void;
    };
    children?: ReactNode;
  }>;

  return (
    <div className="w-full overflow-hidden rounded-lg border border-gray-200">
      <MapContainer {...mapProps}>
        <TileLayerCompat
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <FitBounds points={points} />

        {agenciesWithCoords.map((agency) => {
          const isSelected = agency.id === selectedAgencyId;
          const lat = agency.coordinates.latitude as number;
          const lng = agency.coordinates.longitude as number;

          return (
            <CircleMarkerCompat
              key={agency.id}
              center={[lat, lng]}
              radius={10}
              pathOptions={{
                color: isSelected ? '#2563eb' : '#111827',
                fillColor: isSelected ? '#3b82f6' : '#111827',
                fillOpacity: isSelected ? 0.6 : 0.35,
                weight: isSelected ? 3 : 2,
              }}
              eventHandlers={{
                click: () => onAgencySelect(agency),
              }}
            >
              <Popup>
                <div className="space-y-1">
                  <div className="font-medium">{agency.name}</div>
                  <div className="text-xs text-gray-600">
                    {agency.address.street} {agency.address.number}
                    {agency.address.city ? `, ${agency.address.city}` : ''}
                    {agency.address.state ? `, ${agency.address.state}` : ''}
                  </div>
                  <div className="text-xs text-gray-600">{agency.carrier.name}</div>
                </div>
              </Popup>
            </CircleMarkerCompat>
          );
        })}
      </MapContainer>
    </div>
  );
}
