import { XMLParser } from "fast-xml-parser";
import type { GeoGeometry } from "./types";

/**
 * KML → GeoJSON converter.
 *
 * KML is, by specification, always WGS 84 longitude/latitude (EPSG:4326).
 * We walk the document tree in order, collect every <Placemark> at any
 * nesting depth, and translate its geometry (Point, LineString, Polygon
 * with holes, MultiGeometry) plus its attributes (<name>, <description>,
 * <ExtendedData>) into GeoJSON features.
 */

interface KmlFeature {
  geometry: GeoGeometry | null;
  properties: Record<string, unknown>;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  trimValues: true,
  processEntities: true,
});

function asText(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v.trim();
  if (typeof v === "number") return String(v);
  return null;
}

function parseCoords(str: string): [number, number][] {
  if (!str || !str.trim()) return [];
  return str
    .trim()
    .split(",")
    .map((tok) => {
      const p = tok.trim().split(/\s+/).map(Number);
      return [p[0], p[1]] as [number, number];
    })
    .filter((c) => Number.isFinite(c[0]) && Number.isFinite(c[1]));
}

function closeRing(coords: [number, number][]): number[][] {
  if (coords.length < 4) return coords.map((c) => [...c]);
  const [fx, fy] = coords[0];
  const [lx, ly] = coords[coords.length - 1];
  const ring = coords.map((c) => [...c]);
  if (fx !== lx || fy !== ly) ring.push([fx, fy]);
  return ring;
}

function ringFrom(node: unknown): number[][] {
  const n = node as { LinearRing?: { coordinates?: unknown } } | null;
  const text = asText(n?.LinearRing?.coordinates);
  return closeRing(parseCoords(text ?? ""));
}

function geometryFromPlacemark(p: Record<string, unknown>): GeoGeometry | null {
  if (p.Point) {
    const coords = parseCoords(asText((p.Point as { coordinates?: unknown }).coordinates) ?? "");
    if (coords.length) return { type: "Point", coordinates: coords[0] };
    return null;
  }
  if (p.LineString) {
    const coords = parseCoords(
      asText((p.LineString as { coordinates?: unknown }).coordinates) ?? "",
    );
    if (coords.length) return { type: "LineString", coordinates: coords };
    return null;
  }
  if (p.Polygon) {
    const poly = p.Polygon as {
      outerBoundaryIs?: unknown;
      innerBoundaryIs?: unknown;
    };
    const outer = ringFrom(poly.outerBoundaryIs);
    if (!outer.length) return null;
    const holes: number[][][] = [];
    const inner = poly.innerBoundaryIs;
    const inners = inner ? (Array.isArray(inner) ? inner : [inner]) : [];
    for (const i of inners) {
      const h = ringFrom(i);
      if (h.length) holes.push(h);
    }
    return { type: "Polygon", coordinates: [outer, ...holes] };
  }
  if (p.MultiGeometry) {
    const parts = collectMulti(p.MultiGeometry as Record<string, unknown>);
    if (parts.length) return aggregate(parts);
    return null;
  }
  // <KML>, <Model>, gx:Track etc. — present but not measurable.
  return null;
}

function collectMulti(node: Record<string, unknown>): GeoGeometry[] {
  const out: GeoGeometry[] = [];
  const single = (v: unknown, wrap: (c: [number, number][]) => GeoGeometry | null) => {
    const arr = v ? (Array.isArray(v) ? v : [v]) : [];
    for (const item of arr) {
      const g = wrap(parseCoords(asText((item as { coordinates?: unknown }).coordinates) ?? ""));
      if (g) out.push(g);
    }
  };
  single(node.Point, (c) => (c.length ? { type: "Point", coordinates: c[0] } : null));
  single(node.LineString, (c) => (c.length ? { type: "LineString", coordinates: c } : null));
  const polys = node.Polygon
    ? Array.isArray(node.Polygon)
      ? node.Polygon
      : [node.Polygon]
    : [];
  for (const poly of polys as { outerBoundaryIs?: unknown; innerBoundaryIs?: unknown }[]) {
    const outer = ringFrom(poly.outerBoundaryIs);
    if (!outer.length) continue;
    const holes: number[][][] = [];
    const inner = poly.innerBoundaryIs;
    for (const i of inner ? (Array.isArray(inner) ? inner : [inner]) : []) {
      const h = ringFrom(i);
      if (h.length) holes.push(h);
    }
    out.push({ type: "Polygon", coordinates: [outer, ...holes] });
  }
  const nested = node.MultiGeometry
    ? Array.isArray(node.MultiGeometry)
      ? node.MultiGeometry
      : [node.MultiGeometry]
    : [];
  for (const n of nested as Record<string, unknown>[]) out.push(...collectMulti(n));
  return out;
}

function aggregate(parts: GeoGeometry[]): GeoGeometry {
  const types = new Set(parts.map((p) => p.type));
  if (types.size === 1) {
    const t = [...types][0];
    if (t === "Point") return { type: "MultiPoint", coordinates: parts.map((p) => p.coordinates) };
    if (t === "LineString") return { type: "MultiLineString", coordinates: parts.map((p) => p.coordinates) };
    if (t === "Polygon") return { type: "MultiPolygon", coordinates: parts.map((p) => p.coordinates) };
  }
  return { type: "GeometryCollection", geometries: parts };
}

function propertiesFromPlacemark(p: Record<string, unknown>): Record<string, unknown> {
  const props: Record<string, unknown> = {};
  const name = asText(p.name);
  if (name) props.name = name;
  const desc = asText(p.description);
  if (desc) props.description = desc;
  const ed = p.ExtendedData as
    | { Data?: unknown; SimpleData?: unknown }
    | null
    | undefined;
  if (ed) {
    const data = ed.Data ? (Array.isArray(ed.Data) ? ed.Data : [ed.Data]) : [];
    for (const d of data as { "@_name"?: unknown; value?: unknown }[]) {
      const key = asText(d["@_name"]);
      const val = asText(d.value);
      if (key && val != null) props[key] = val;
    }
    const simple = ed.SimpleData
      ? Array.isArray(ed.SimpleData)
        ? ed.SimpleData
        : [ed.SimpleData]
      : [];
    for (const s of simple as { "@_name"?: unknown; [k: string]: unknown }[]) {
      const key = asText(s["@_name"]);
      const val = asText(s.text ?? s);
      if (key && val != null) props[key] = val;
    }
  }
  return props;
}

function collectPlacemarks(node: unknown, out: Record<string, unknown>[]) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) {
    for (const n of node) collectPlacemarks(n, out);
    return;
  }
  const obj = node as Record<string, unknown>;
  if (obj.Placemark) {
    const pm = obj.Placemark as Record<string, unknown> | Record<string, unknown>[];
    if (Array.isArray(pm)) out.push(...pm);
    else out.push(pm);
  }
  for (const v of Object.values(obj)) {
    if (v && typeof v === "object") collectPlacemarks(v, out);
  }
}

export function parseKml(buffer: ArrayBuffer): { features: KmlFeature[] } {
  const xml = new TextDecoder("utf-8").decode(new Uint8Array(buffer));
  let doc: unknown;
  try {
    doc = parser.parse(xml);
  } catch (e) {
    throw new Error(`Invalid KML XML: ${(e as Error).message}`);
  }
  if (!doc || typeof doc !== "object") {
    throw new Error("Invalid KML document: empty or non-XML content");
  }
  const root = (doc as Record<string, unknown>).kml ?? doc;
  const placemarks: Record<string, unknown>[] = [];
  collectPlacemarks(root, placemarks);
  if (!placemarks.length) {
    throw new Error("No Placemark features found in KML document");
  }
  const features = placemarks.map((p) => ({
    geometry: geometryFromPlacemark(p),
    properties: propertiesFromPlacemark(p),
  }));
  return { features };
}
