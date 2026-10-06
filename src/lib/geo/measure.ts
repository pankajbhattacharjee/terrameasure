import { area as turfArea, length as turfLength } from "@turf/turf";
import {
  anchorLonLat,
  crsSourceDef,
  transformGeometry,
  utmForLonLat,
} from "./crs";
import type { CrsInfo, FeatureMeasurement, GeoGeometry } from "./types";

/**
 * Measurement engine.
 *
 * Planar values:
 *   - geographic file CRS  → project the feature into its UTM zone, then
 *     shoelace-area / segment-sum in meters. Never in degrees.
 *   - projected file CRS   → measure directly in the source CRS, scaled by
 *     the WKT TO_METER factor (US survey feet → meters).
 * Geodesic reference values (area via Turf's ellipsoid model) are always
 * computed on the WGS 84 form of the geometry, so users can sanity-check
 * the planar numbers.
 */

interface PlanarResult {
  supported: boolean;
  areaM2: number | null;
  lengthM: number | null;
  note: string | null;
}

function ringArea(ring: number[][]): number {
  let sum = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[i + 1];
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum / 2);
}

function lineLength(coords: number[][]): number {
  let sum = 0;
  for (let i = 0; i < coords.length - 1; i++) {
    const dx = coords[i + 1][0] - coords[i][0];
    const dy = coords[i + 1][1] - coords[i][1];
    sum += Math.hypot(dx, dy);
  }
  return sum;
}

/** Recursive planar measurement. Only Polygon* / LineString* families are supported. */
function planar(geom: GeoGeometry | null, unitFactor: number): PlanarResult {
  if (!geom || !geom.type) return unsupported("Empty geometry");
  const f2 = unitFactor * unitFactor;
  switch (geom.type) {
    case "Point":
      return unsupported("Point geometry: no measurement");
    case "MultiPoint":
      return unsupported("MultiPoint geometry: no measurement");
    case "LineString": {
      const c = geom.coordinates as number[][];
      return ok(null, lineLength(c) * unitFactor);
    }
    case "Polygon": {
      const rings = geom.coordinates as number[][][];
      if (!rings.length) return unsupported("Polygon without rings");
      const outer = ringArea(rings[0]);
      const holes = rings.slice(1).reduce((s, r) => s + ringArea(r), 0);
      return ok(Math.max(0, outer - holes) * f2, null);
    }
    case "MultiLineString": {
      const lines = geom.coordinates as number[][][];
      return ok(null, lines.reduce((s, c) => s + lineLength(c), 0) * unitFactor);
    }
    case "MultiPolygon": {
      const polys = geom.coordinates as number[][][][];
      const total = polys.reduce((s, rings) => {
        const outer = ringArea(rings[0]);
        const holes = rings.slice(1).reduce((hs, r) => hs + ringArea(r), 0);
        return s + Math.max(0, outer - holes);
      }, 0);
      return ok(total * f2, null);
    }
    case "GeometryCollection": {
      const members = geom.geometries ?? [];
      if (!members.length) return unsupported("Empty GeometryCollection");
      let area: number | null = null;
      let length: number | null = null;
      const bad: string[] = [];
      for (const m of members) {
        const r = planar(m, unitFactor);
        if (!r.supported) {
          bad.push(m.type ?? "unknown");
          continue;
        }
        area = (area ?? 0) + (r.areaM2 ?? 0);
        length = (length ?? 0) + (r.lengthM ?? 0);
      }
      if (bad.length) {
        return unsupported(
          `GeometryCollection contains unsupported members: ${bad.join(", ")}`,
        );
      }
      if (area === 0 && length === 0) return ok(null, null);
      return ok(area === 0 ? null : area, length === 0 ? null : length);
    }
    default:
      return unsupported(`Unsupported geometry type: ${geom.type}`);
  }
}

function ok(areaM2: number | null, lengthM: number | null): PlanarResult {
  return { supported: true, areaM2, lengthM, note: null };
}

function unsupported(note: string): PlanarResult {
  return { supported: false, areaM2: null, lengthM: null, note };
}

/** Geodesic reference values on a WGS 84 geometry (Turf uses the WGS 84 ellipsoid). */
function geodesic(geom4326: GeoGeometry | null): {
  areaM2: number | null;
  lengthM: number | null;
} {
  if (!geom4326) return { areaM2: null, lengthM: null };
  const feature = { type: "Feature", properties: {}, geometry: geom4326 } as never;
  let areaM2: number | null = null;
  let lengthM: number | null = null;
  try {
    if (geom4326.type === "Polygon" || geom4326.type === "MultiPolygon") {
      areaM2 = turfArea(feature as Parameters<typeof turfArea>[0]);
    } else if (
      geom4326.type === "LineString" ||
      geom4326.type === "MultiLineString"
    ) {
      lengthM = turfLength(feature as Parameters<typeof turfLength>[0]) * 1000;
    } else if (geom4326.type === "GeometryCollection") {
      for (const g of geom4326.geometries ?? []) {
        const r = geodesic(g);
        areaM2 = (areaM2 ?? 0) + (r.areaM2 ?? 0) || null;
        lengthM = (lengthM ?? 0) + (r.lengthM ?? 0) || null;
      }
      if (areaM2 === 0) areaM2 = null;
      if (lengthM === 0) lengthM = null;
    }
  } catch {
    // Turf can choke on degenerate geometries — the planar value still stands.
  }
  return { areaM2, lengthM };
}

/** Measure one feature given the file's CRS. Never throws. */
function roundMetric(v: number | null, digits = 3): number | null {
  if (v == null || !Number.isFinite(v)) return null;
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

export function measureFeature(geom: GeoGeometry | null, crs: CrsInfo): FeatureMeasurement {
  const result: FeatureMeasurement = {
    supported: false,
    areaM2: null,
    lengthM: null,
    areaM2Geodesic: null,
    lengthMGeodesic: null,
    measurementCrs: null,
    note: null,
  };
  if (!geom || !geom.type) {
    result.note = "No geometry present";
    return result;
  }

  try {
    const { def: sourceDef, usedFallback } = crsSourceDef(crs);

    if (crs.isGeographic || crs.assumed) {
      // Geographic: project this feature into its UTM zone before measuring.
      const anchor = anchorLonLat(geom);
      if (!anchor) {
        result.note = "Geometry has no usable coordinates";
        return result;
      }
      const utm = utmForLonLat(anchor[0], anchor[1]);
      const projected = transformGeometry(geom, sourceDef, `EPSG:${utm.epsg}`);
      const p = planar(projected, 1);
      if (!p.supported) {
        result.note = p.note;
        return result;
      }
      result.supported = true;
      result.areaM2 = roundMetric(p.areaM2, 2);
      result.lengthM = roundMetric(p.lengthM, 2);
      result.measurementCrs = utm.label;

      const geom4326 =
        usedFallback || crs.epsg === 4326
          ? geom
          : transformGeometry(geom, sourceDef, "EPSG:4326");
      const g = geodesic(geom4326);
      result.areaM2Geodesic = roundMetric(g.areaM2, 2);
      result.lengthMGeodesic = roundMetric(g.lengthM, 2);
      if (usedFallback) result.note = "CRS metadata missing/unreadable — assumed EPSG:4326";
      return result;
    }

    // Projected source CRS: measure in place, honoring the unit factor.
    const p = planar(geom, crs.unitFactor);
    if (!p.supported) {
      result.note = p.note;
      return result;
    }
    result.supported = true;
    result.areaM2 = roundMetric(p.areaM2, 2);
    result.lengthM = roundMetric(p.lengthM, 2);
    result.measurementCrs = `${crs.label}${crs.unitFactor !== 1 ? " (feet → m ×" + crs.unitFactor.toFixed(6) + ")" : ""}`;

    try {
      const geom4326 = transformGeometry(geom, sourceDef, "EPSG:4326");
      const g = geodesic(geom4326);
      result.areaM2Geodesic = roundMetric(g.areaM2, 2);
      result.lengthMGeodesic = roundMetric(g.lengthM, 2);
    } catch {
      result.note = "Could not derive WGS 84 reference; geodesic values unavailable";
    }
    return result;
  } catch (e) {
    result.note = `Measurement skipped: ${(e as Error).message || String(e)}`;
    return result;
  }
}

export function strategyLabel(crs: CrsInfo): string {
  if (crs.assumed) {
    return "Assumed EPSG:4326 · per-feature UTM planar + WGS 84 geodesic";
  }
  if (crs.isGeographic) {
    return "Per-feature UTM planar + WGS 84 geodesic";
  }
  return `Planar in ${crs.label} + WGS 84 geodesic`;
}
