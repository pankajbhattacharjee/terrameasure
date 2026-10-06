import { unzipSync, strFromU8, zipSync } from "fflate";
import shp from "shpjs";
import type { GeoGeometry } from "./types";

/**
 * Shapefile loader.
 *
 * A .zip shapefile is unzipped with fflate so we can read the companion
 * .prj (WKT CRS definition). The archive is then re-zipped WITHOUT the .prj
 * before being handed to shpjs: shpjs would otherwise auto-reproject every
 * geometry to WGS 84 internally, which would bypass our own CRS pipeline
 * (planar measurement in the source CRS + explicit geodesic cross-checks).
 */

/** Re-zip an unzipped archive minus the .prj / macOS metadata entries. */
function zipWithoutPrj(entries: Record<string, Uint8Array>): ArrayBuffer {
  const cleaned: Record<string, Uint8Array> = {};
  for (const [k, v] of Object.entries(entries)) {
    if (k.toLowerCase().endsWith(".prj")) continue;
    if (k.includes("__MACOSX")) continue;
    cleaned[k] = v;
  }
  const arr = zipSync(cleaned);
  return arr.buffer.slice(arr.byteOffset, arr.byteOffset + arr.byteLength) as ArrayBuffer;
}

export interface ShapefileResult {
  features: { geometry: GeoGeometry | null; properties: Record<string, unknown> }[];
  prjWkt: string | null;
  baseName: string;
}

export function inspectZip(buffer: ArrayBuffer): string[] {
  return Object.keys(unzipSync(new Uint8Array(buffer)));
}

export async function parseShapefileZip(buffer: ArrayBuffer): Promise<ShapefileResult> {
  const entries = unzipSync(new Uint8Array(buffer));
  const names = Object.keys(entries);
  const shpEntry = names.find((n) => n.toLowerCase().endsWith(".shp"));
  if (!shpEntry) {
    throw new Error("Archive does not contain a .shp shapefile");
  }
  const prjEntry = names.find((n) => n.toLowerCase().endsWith(".prj"));
  const prjWkt = prjEntry ? strFromU8(entries[prjEntry]).trim() || null : null;

  let parsed: unknown;
  try {
    // Coordinates stay in the file's native CRS — we handle CRS ourselves.
    parsed = await shp(zipWithoutPrj(entries));
  } catch (e) {
    throw new Error(`Shapefile parse error: ${(e as Error).message}`);
  }

  // A zip may bundle several layers (shpjs returns one FeatureCollection per
  // .shp). We flatten them into a single feature list, tagging each feature
  // with a "layer" attribute so no data is silently dropped.
  const collections = (Array.isArray(parsed) ? parsed : [parsed]) as {
    fileName?: string;
    features?: {
      geometry?: GeoGeometry | null;
      properties?: Record<string, unknown> | null;
    }[];
  }[];
  const features: { geometry: GeoGeometry | null; properties: Record<string, unknown> }[] = [];
  for (const c of collections) {
    for (const f of c.features ?? []) {
      const props = { ...(f.properties ?? {}) } as Record<string, unknown>;
      if (c.fileName && !("layer" in props)) props.layer = c.fileName;
      features.push({ geometry: (f.geometry as GeoGeometry | null) ?? null, properties: props });
    }
  }
  if (!features.length) {
    throw new Error("Shapefile contains no features");
  }
  return {
    features,
    prjWkt,
    baseName: collections[0]?.fileName ?? shpEntry.split("/").pop() ?? "shapefile",
  };
}

/** A raw, unzipped .shp file (no CRS metadata available). */
export async function parseShpBuffer(buffer: ArrayBuffer): Promise<ShapefileResult> {
  let parsed: unknown;
  try {
    parsed = await shp(buffer);
  } catch (e) {
    throw new Error(`Shapefile parse error: ${(e as Error).message}`);
  }
  const collection = (Array.isArray(parsed) ? parsed[0] : parsed) as {
    features?: { geometry?: GeoGeometry | null; properties?: Record<string, unknown> | null }[];
  };
  const feats = collection?.features ?? [];
  if (!feats.length) throw new Error("Shapefile contains no features");
  return {
    features: feats.map((f) => ({
      geometry: (f.geometry as GeoGeometry | null) ?? null,
      properties: (f.properties as Record<string, unknown>) ?? {},
    })),
    prjWkt: null,
    baseName: "shapefile",
  };
}
