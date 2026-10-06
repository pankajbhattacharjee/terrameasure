import proj4 from "proj4";
import type { CrsInfo, GeoGeometry } from "./types";

/**
 * CRS handling strategy
 * ---------------------
 * 1. Shapefiles carry their CRS in a companion .prj file (WKT). KML is, by
 *    specification, always WGS 84 (EPSG:4326).
 * 2. We classify the WKT (geographic vs projected), try to recover an EPSG
 *    code from AUTHORITY strings, and fall back to heuristics (WGS 84 name
 *    match, UTM central-meridian → zone math) when the .prj has no code.
 * 3. Measurement strategy:
 *    - geographic CRS  → project each feature into the UTM zone covering it
 *      and measure planarly in meters (a file in degrees must never be
 *      measured as degrees).
 *    - projected CRS   → measure planarly in the source CRS, applying the
 *      WKT TO_METER factor (handles US survey foot CRS).
 *    - always          → additionally compute a WGS 84 geodesic reference
 *      with Turf as a cross-check.
 */

export const WGS84: CrsInfo = {
  label: "EPSG:4326",
  epsg: 4326,
  isGeographic: true,
  wkt: null,
  unitFactor: 1,
  assumed: false,
};

export function unknownAssumed(): CrsInfo {
  return { ...WGS84, label: "UNKNOWN (assumed EPSG:4326)", assumed: true };
}

function extractEpsg(wkt: string): number | null {
  const m = wkt.match(/AUTHORITY\[\s*"?EPSG"?\s*,\s*"?(\d+)"?\s*\]/i);
  return m ? Number(m[1]) : null;
}

function extractToMeter(wkt: string): number | null {
  const m = wkt.match(/TO_METER\[\s*([0-9.eE+-]+)/i);
  return m ? Number(m[1]) : null;
}

function extractName(wkt: string): string | null {
  const m = wkt.match(/(?:PROJCS|GEOGCS)\[\s*"([^"]+)"/);
  return m ? m[1] : null;
}

function paramValue(wkt: string, name: string): number | null {
  // WKT parameter names may be wrapped in double quotes and whitespace varies.
  const re = new RegExp(name + '[^0-9+-]*([+-]?\\d+(?:\\.\\d+)?)', 'i');
  const m = wkt.match(re);
  if (!m) return null;
  const v = Number(m[1]);
  return Number.isFinite(v) ? v : null;
}

function looksLikeUtm(wkt: string): boolean {
  if (!/Transverse_Mercator/i.test(wkt)) return false;
  const sf = paramValue(wkt, 'scale_factor');
  if (sf == null) return false;
  return Math.abs(sf - 0.9996) < 1e-6;
}

function utmEpsgFromCentralMeridian(wkt: string): number | null {
  // ESRI-style WKTs use "central_meridian"; classic WKT uses "longitude_of_origin".
  const cm =
    paramValue(wkt, 'central_meridian') ?? paramValue(wkt, 'longitude_of_origin');
  if (cm == null) return null;
  const zone = Math.round((cm + 183) / 6);
  if (zone < 1 || zone > 60) return null;
  // Explicit hemisphere markers only — avoid false positives on words like
  // "south" appearing in datum names. North is the default (covers the
  // northern-hemisphere majority; files that are explicitly south get 327xx).
  const south = /\b(?:southern\s+hemisphere|S\s+hemisphere|_south_?|utm\s*\d{1,2}\s*S\b)/i.test(wkt);
  return (south ? 32700 : 32600) + zone;
}

/** Classify a WKT CRS definition into a CrsInfo. */
export function crsFromWkt(wkt: string): CrsInfo {
  const clean = wkt.replace(/\s+/g, " ").trim();
  const isProjected = /PROJCS/i.test(clean) && /PROJECTION/i.test(clean);
  const isGeographic = !isProjected && /GEOGCS/i.test(clean);

  if (!isProjected && !isGeographic) {
    return { ...unknownAssumed(), wkt: clean };
  }

  let epsg = extractEpsg(clean);
  const unitFactor = isProjected ? extractToMeter(clean) ?? 1 : 1;
  let label: string;

  if (epsg) {
    label = `EPSG:${epsg}`;
  } else if (isGeographic) {
    if (/WGS[\s_]*84/i.test(clean)) {
      epsg = 4326;
      label = "EPSG:4326";
    } else if (/NAD\s*83/i.test(clean)) {
      epsg = 4269;
      label = "EPSG:4269";
    } else {
      label = extractName(clean) ?? "GEOGCS (unknown code)";
    }
  } else {
    const utm = looksLikeUtm(clean) ? utmEpsgFromCentralMeridian(clean) : null;
    if (utm) {
      epsg = utm;
      label = `EPSG:${utm}`;
    } else {
      label = extractName(clean) ?? "PROJCS (unknown code)";
    }
  }

  return { label, epsg, isGeographic, wkt: clean, unitFactor, assumed: false };
}

/** True when proj4 can consume this WKT as a definition. */
export function proj4CanParse(wkt: string | null): boolean {
  if (!wkt) return false;
  try {
    proj4(wkt);
    return true;
  } catch {
    return false;
  }
}

/** The proj4 definition string to use for a file CRS (falls back to WGS84). */
export function crsSourceDef(crs: CrsInfo): { def: string; usedFallback: boolean } {
  if (!crs.assumed && crs.wkt && proj4CanParse(crs.wkt)) {
    return { def: crs.wkt, usedFallback: false };
  }
  // WGS84/KML files carry no WKT yet are known to be WGS84 — that is NOT a fallback.
  const usedFallback = crs.assumed || (crs.wkt != null);
  return { def: "EPSG:4326", usedFallback };
}

/** UTM zone covering a lon/lat pair (geographic files are projected per-feature). */
export function utmForLonLat(lon: number, lat: number): { epsg: number; label: string } {
  const zone = Math.min(60, Math.max(1, Math.floor((lon + 180) / 6) + 1));
  const epsg = (lat < 0 ? 32700 : 32600) + zone;
  return { epsg, label: `EPSG:${epsg} (UTM ${zone}${lat < 0 ? "S" : "N"})` };
}

/** First coordinate pair of any geometry — used as the projection anchor. */
export function anchorLonLat(geom: GeoGeometry | null): [number, number] | null {
  if (!geom) return null;
  const descend = (c: unknown): [number, number] | null => {
    if (!Array.isArray(c)) return null;
    if (typeof c[0] === "number" && typeof c[1] === "number") return [c[0], c[1]];
    for (const item of c) {
      const r = descend(item);
      if (r) return r;
    }
    return null;
  };
  const direct = descend(geom.coordinates);
  if (direct) return direct;
  for (const g of geom.geometries ?? []) {
    const a = anchorLonLat(g);
    if (a) return a;
  }
  return null;
}

/** Deep-transform a geometry between two proj4 definitions. */
export function transformGeometry(
  geom: GeoGeometry | null,
  from: string,
  to: string,
): GeoGeometry | null {
  if (!geom || !geom.type) return geom;
  const converter = proj4(from, to);
  const map = (c: number[]): number[] => {
    const r = converter.forward([c[0], c[1]]);
    if (!r || !Number.isFinite(r[0]) || !Number.isFinite(r[1])) return c;
    return c.length > 2 ? [r[0], r[1], c[2]] : [r[0], r[1]];
  };
  const walk = (coords: unknown): unknown => {
    if (!Array.isArray(coords)) return coords;
    if (typeof coords[0] === "number") return map(coords as number[]);
    return (coords as unknown[]).map(walk);
  };

  switch (geom.type) {
    case "Point":
      return { ...geom, coordinates: map(geom.coordinates as number[]) };
    case "LineString":
    case "LinearRing":
      return { ...geom, coordinates: walk(geom.coordinates) };
    case "Polygon":
      return { ...geom, coordinates: walk(geom.coordinates) };
    case "MultiPoint":
    case "MultiLineString":
    case "MultiPolygon":
      return { ...geom, coordinates: walk(geom.coordinates) };
    case "GeometryCollection":
      return {
        ...geom,
        geometries: (geom.geometries ?? []).map((g) => {
          const t = transformGeometry(g, from, to);
          return t ?? { type: "Unknown" };
        }),
      };
    default:
      return geom;
  }
}
