import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { features, files } from "@/db/schema";

export type FileJson = {
  id: string;
  filename: string;
  file_type: string;
  file_size: number;
  status: string;
  crs: string;
  crs_epsg: number | null;
  crs_is_geographic: boolean;
  feature_count: number;
  measurement_strategy: string | null;
  error: string | null;
  uploaded_at: string;
};

export function toFileJson(f: typeof files.$inferSelect): FileJson {
  return {
    id: f.id,
    filename: f.filename,
    file_type: f.fileType,
    file_size: f.fileSize,
    status: f.status,
    crs: f.crs,
    crs_epsg: f.crsEpsg,
    crs_is_geographic: f.crsGeographic,
    feature_count: f.featureCount,
    measurement_strategy: f.measurementStrategy,
    error: f.error,
    uploaded_at: f.uploadedAt.toISOString(),
  };
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export function err(status: number, detail: string): Response {
  return json({ detail }, status);
}

export async function listFiles(): Promise<FileJson[]> {
  const rows = await db
    .select()
    .from(files)
    .orderBy(desc(files.uploadedAt))
    .limit(100);
  return rows.map(toFileJson);
}

export async function getFile(id: string) {
  const rows = await db.select().from(files).where(eq(files.id, id));
  const f = rows[0];
  if (!f) return null;
  const featRows = await db
    .select({ gt: features.geometryType, supported: features.supported })
    .from(features)
    .where(eq(features.fileId, id));
  const isPoly = (t: string) => t === "Polygon" || t === "MultiPolygon";
  const isLine = (t: string) => t === "LineString" || t === "MultiLineString";
  const isPoint = (t: string) => t === "Point" || t === "MultiPoint";
  return {
    ...toFileJson(f),
    summary: {
      total: featRows.length,
      measured: featRows.filter((r) => r.supported).length,
      unsupported: featRows.filter((r) => !r.supported).length,
      polygons: featRows.filter((r) => isPoly(r.gt)).length,
      linestrings: featRows.filter((r) => isLine(r.gt)).length,
      points: featRows.filter((r) => isPoint(r.gt)).length,
      other: featRows.filter((r) => !isPoly(r.gt) && !isLine(r.gt) && !isPoint(r.gt)).length,
    },
  };
}
