/** Minimal GeoJSON geometry type — deliberately loose so we can store
 *  geometries coming from shpjs, our own KML parser, or hand-built samples. */
export interface GeoGeometry {
  type: string;
  coordinates?: unknown;
  geometries?: GeoGeometry[];
}

export interface ProcessedFeature {
  index: number;
  geometryType: string;
  properties: Record<string, unknown>;
  geometry: GeoGeometry | null;
  measurement: FeatureMeasurement;
}

export interface ProcessedFile {
  fileType: "SHAPEFILE" | "KML";
  crs: CrsInfo;
  features: ProcessedFeature[];
  strategy: string;
}

export interface FeatureMeasurement {
  supported: boolean;
  areaM2: number | null;
  lengthM: number | null;
  areaM2Geodesic: number | null;
  lengthMGeodesic: number | null;
  measurementCrs: string | null;
  note: string | null;
}

export interface CrsInfo {
  /** Human/label form, e.g. "EPSG:4326" or "PROJCS: NAD83 / UTM zone 10N" */
  label: string;
  epsg: number | null;
  isGeographic: boolean;
  wkt: string | null;
  /** Meters per coordinate unit (1.0 for degrees and meters, ~0.3048 for US survey feet). */
  unitFactor: number;
  /** True when no CRS metadata was available and EPSG:4326 was assumed. */
  assumed: boolean;
}
