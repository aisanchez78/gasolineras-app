export interface Gasolinera {
  IDEESS: string;
  'C.P.': string;
  Dirección: string;
  Horario: string;
  Latitud: string;
  'Longitud (WGS84)': string;
  Municipio: string;
  Precio?: string;
  'Precio Biodiesel': string;
  'Precio Bioetanol': string;
  'Precio Gas Natural Comprimido': string;
  'Precio Gas Natural Licuado': string;
  'Precio Gases licuados del petróleo': string;
  'Precio Gasoleo A': string;
  'Precio Gasoleo B': string;
  'Precio Gasoil Premium': string;
  'Precio Gasolina 95 E10': string;
  'Precio Gasolina 95 E5': string;
  'Precio Gasolina 95 E5 Premium': string;
  'Precio Gasolina 98 E10': string;
  'Precio Gasolina 98 E5': string;
  'Precio Hidrogeno': string;
  Provincia: string;
  Remisión: string;
  'Rótulo': string;
  'Tipo Venta': string;
  '% BioEtanol': string;
  '% Éster metílico': string;
  distance?: number;
  isOpen?: boolean;
  // alias de compatibilidad
  Longitud?: string;
}

export interface RespuestaAPI {
  ListaEESSPrecio: Gasolinera[];
  Fecha: string;
  Nota: string;
  ResultadoConsulta: string;
}

export type FuelType = 'gasolina95' | 'gasoil' | 'gasolina98' | 'gasoilPremium';

export const FUEL_LABELS: Record<FuelType, string> = {
  gasolina95:    'Gasolina 95',
  gasoil:        'Gasóleo A',
  gasolina98:    'Gasolina 98',
  gasoilPremium: 'Gasóleo Premium',
};

export interface ActiveFilters {
  fuelType: FuelType;
  brands: string[];
  radiusKm: number;
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export type SortOrder = 'price' | 'distance' | 'name';
