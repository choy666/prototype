// Tipos para sucursales de Mercado Libre
export interface Agency {
  agency_id: string;
  description: string;
  address?: {
    street_name?: string;
    street_number?: string;
    city?: {
      name?: string;
    };
    state?: {
      name?: string;
    };
    zip_code?: string;
  };
  phone?: string;
  open_hours?: string;
  carrier_id?: string;
  carrier_name?: string;
  latitude?: number | null;
  longitude?: number | null;
  coordinates?: {
    latitude?: number | null;
    longitude?: number | null;
  };
}

export interface FormattedAgency {
  id: string;
  name: string;
  address: {
    street: string;
    number: string;
    city: string;
    state: string;
    zipcode: string;
  };
  phone: string;
  hours: string;
  carrier: {
    id: string;
    name: string;
  };
  coordinates: {
    latitude: number | null;
    longitude: number | null;
  };
}
