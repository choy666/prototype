/**
 * Utilidades para formatear direcciones según requisitos de Mercado Libre
 */

// Mapeo de provincias de Argentina a códigos de ML
export const PROVINCE_CODE_MAP: Record<string, string> = {
  'capital federal': 'AR-C',
  'caba': 'AR-C',
  'ciudad autónoma de buenos aires': 'AR-C',
  'ciudad autónoma': 'AR-C',
  'buenos aires': 'AR-B',
  'catamarca': 'AR-K',
  'chaco': 'AR-H',
  'chubut': 'AR-U',
  'córdoba': 'AR-X',
  'corrientes': 'AR-W',
  'entre ríos': 'AR-E',
  'formosa': 'AR-P',
  'jujuy': 'AR-Y',
  'la pampa': 'AR-L',
  'la rioja': 'AR-F',
  'mendoza': 'AR-M',
  'misiones': 'AR-N',
  'neuquén': 'AR-Q',
  'río negro': 'AR-R',
  'salta': 'AR-A',
  'san juan': 'AR-J',
  'san luis': 'AR-D',
  'santa cruz': 'AR-Z',
  'santa fe': 'AR-S',
  'santiago del estero': 'AR-G',
  'tierra del fuego': 'AR-V',
  'tucumán': 'AR-T',
};

/**
 * Formatea una dirección para enviar a la API de Mercado Libre
 */
export function formatAddressForMercadoLibre(address: {
  direccion: string;
  numero: string;
  piso?: string;
  departamento?: string;
  ciudad: string;
  provincia: string;
  codigoPostal: string;
  telefono: string;
  nombre: string;
}) {
  // Limpiar código postal: remover prefijo de provincia (M5500 -> 5500)
  const cleanZipCode = address.codigoPostal.replace(/^[A-Z]/i, '');
  
  // Obtener código de provincia
  const provinceKey = address.provincia.toLowerCase().trim();
  const stateId = PROVINCE_CODE_MAP[provinceKey] || address.provincia;
  
  // Construir dirección completa para street_name
  let streetName = address.direccion.trim();
  
  // Agregar piso y departamento si existen
  if (address.piso || address.departamento) {
    const floorInfo = [];
    if (address.piso) floorInfo.push(`Piso ${address.piso}`);
    if (address.departamento) floorInfo.push(`Depto ${address.departamento}`);
    streetName += ` - ${floorInfo.join(' ')}`;
  }
  
  return {
    // Formato para ML shipments API
    receiver_name: address.nombre,
    receiver_phone: address.telefono,
    street_name: streetName,
    street_number: address.numero,
    zip_code: cleanZipCode,
    city: address.ciudad,
    state_id: stateId,
    country_id: 'AR',
    
    // Mantener formato original para uso interno
    original_address: {
      ...address,
      formatted_zip_code: cleanZipCode,
      formatted_state_id: stateId,
    }
  };
}

/**
 * Valida si una provincia es válida según el mapeo de ML
 */
export function isValidProvince(provincia: string): boolean {
  const normalized = provincia.toLowerCase().trim();
  return normalized in PROVINCE_CODE_MAP;
}

/**
 * Obtiene el código de provincia para ML
 */
export function getProvinceCode(provincia: string): string {
  const normalized = provincia.toLowerCase().trim();
  return PROVINCE_CODE_MAP[normalized] || provincia;
}

/**
 * Limpia y formatea el código postal para ML (solo números)
 */
export function formatZipCode(zipCode: string): string {
  return zipCode.replace(/^[A-Z]/i, '');
}
