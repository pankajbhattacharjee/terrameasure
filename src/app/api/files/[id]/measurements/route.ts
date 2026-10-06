import { desc, eq, sql } from "drizzle-orm";
import { db } from "@/db";
import { features, files } from "@/db/schema";
import { err, json } from "@/lib/records";

export const dynamic = "force-dynamic";

/**
 * GET /api/files/{id}/measurements/?limit=50&offset=0
 *
 * Per-feature measurements. Planar values (area_m2 / length_m) are computed
 * in a projected CRS — never in degrees — and *_geodesic values are WGS 84
 * ellipsoidal reference numbers from Turf.
 */
export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return err(400, "Invalid file id format.");
  }
  const url = new URL(req.url);
  const limit = Math.min(500, Math.max(1, Number(url.searchParams.get("limit") ?? 50) || 50));
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? 0) || 0);

  try {
    const fileRows = await db.select().from(files).where(eq(files.id, id)).orderBy(desc(files.uploadedAt)).limit(1);
    const file = fileRows[0];
    if (!file) return err(404, `File ${id} not found.`);

    const countRows = await db
      .select({ n: sql<number>`count(*)` })
      .from(features)
      .where(eq(features.fileId, id));
    const total = Number(countRows[0]?.n ?? 0);

    const rows = await db
      .select()
      .from(features)
      .where(eq(features.fileId, id))
      .orderBy(features.fIndex)
      .limit(limit)
      .offset(offset);

    return json({
      file_id: id,
      crs: file.crs,
      crs_epsg: file.crsEpsg,
      measurement_strategy: file.measurementStrategy,
      total,
      limit,
      offset,
      items: rows.map((r) => ({
        index: r.fIndex,
        geometry_type: r.geometryType,
        geometry: r.geometry,
        properties: r.properties,
        crs: file.crs,
        supported: r.supported,
        area_m2: r.areaM2,
        length_m: r.lengthM,
        area_m2_geodesic: r.areaM2Geodesic,
        length_m_geodesic: r.lengthMGeodesic,
        measurement_crs: r.measurementCrs,
        note: r.note,
      })),
    });
  } catch (e) {
    return err(500, `Could not load measurements: ${(e as Error).message}`);
  }
}
