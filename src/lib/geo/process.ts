import { unzipSync, strFromU8 } from "fflate";
import { crsFromWkt, unknownAssumed, WGS84 } from "./crs";
import { measureFeature, strategyLabel } from "./measure";
import { parseKml } from "./kml";
import { parseShpBuffer, parseShapefileZip } from "./shapefile";
import type { CrsInfo, ProcessedFile } from "./types";

export const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB
const ACCEPTED = [".kml", ".zip", ".shp"];

export function detectType(filename: string): "KML" | "ZIP" | "SHP" | null {
  const n = filename.toLowerCase();
  if (n.endsWith(".kml")) return "KML";
  if (n.endsWith(".zip")) return "ZIP";
  if (n.endsWith(".shp")) return "SHP";
  return null;
}

export function assertAccepted(filename: string) {
  if (!detectType(filename)) {
    throw new ApiError(
      415,
      `Unsupported file type. Accepted: ${ACCEPTED.join(", ")} (.zip must contain a Shapefile or a KML document).`,
    );
  }
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * Full pipeline for one uploaded buffer:
 * detect format → parse features → resolve CRS → measure every feature.
 */
export async function processUpload(
  filename: string,
  buffer: ArrayBuffer,
): Promise<ProcessedFile> {
  const kind = detectType(filename);

  if (kind === "KML") {
    const { features } = parseKml(buffer);
    return finish("KML", WGS84, features);
  }

  if (kind === "SHP") {
    const res = await parseShpBuffer(buffer);
    const crs = unknownAssumed();
    return finish("SHAPEFILE", crs, res.features);
  }

  // ZIP: contains a shapefile set, or (gracefully) a bare KML document.
  let entries: Record<string, Uint8Array>;
  try {
    entries = unzipSync(new Uint8Array(buffer));
  } catch (e) {
    throw new ApiError(400, `Not a valid .zip archive: ${(e as Error).message}`);
  }
  const names = Object.keys(entries);
  const shpEntry = names.find((n) => n.toLowerCase().endsWith(".shp"));
  const kmlEntry = names.find((n) => n.toLowerCase().endsWith(".kml"));

  if (shpEntry) {
    const prjEntry = names.find((n) => n.toLowerCase().endsWith(".prj"));
    const prjWkt = prjEntry ? strFromU8(entries[prjEntry]).trim() || null : null;
    const res = await parseShapefileZip(buffer);
    const crs: CrsInfo = prjWkt ? crsFromWkt(prjWkt) : unknownAssumed();
    return finish("SHAPEFILE", crs, res.features);
  }

  if (kmlEntry) {
    const { features } = parseKml(entries[kmlEntry].buffer as ArrayBuffer);
    return finish("KML", WGS84, features);
  }

  throw new ApiError(
    400,
    "Archive contains no supported geospatial data (expected a .shp Shapefile set or a .kml document).",
  );
}

function finish(
  fileType: "SHAPEFILE" | "KML",
  crs: CrsInfo,
  raw: { geometry: import("./types").GeoGeometry | null; properties: Record<string, unknown> }[],
): ProcessedFile {
  const features = raw.map((f, i) => ({
    index: i,
    geometryType: f.geometry?.type ?? "None",
    properties: f.properties ?? {},
    geometry: f.geometry,
    measurement: measureFeature(f.geometry, crs),
  }));
  return {
    fileType,
    crs,
    features,
    strategy: strategyLabel(crs),
  };
}
