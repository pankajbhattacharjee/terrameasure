import { db } from "@/db";
import { files, features } from "@/db/schema";
import { ApiError, MAX_FILE_SIZE, assertAccepted, processUpload } from "@/lib/geo/process";
import type { ProcessedFile } from "@/lib/geo/types";
import { err, json, listFiles, toFileJson } from "@/lib/records";

export const dynamic = "force-dynamic";

/**
 * GET /api/files/ — list recently uploaded files.
 */
export async function GET() {
  try {
    const items = await listFiles();
    return json({ items, total: items.length });
  } catch (e) {
    return err(500, `Could not list files: ${(e as Error).message}`);
  }
}

/**
 * POST /api/files/ — multipart upload (field: "file").
 * Accepts .kml, .zip (Shapefile), and bare .shp.
 * Processes synchronously and returns the file record with status.
 */
export async function POST(req: Request) {
  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return err(400, "Request body must be multipart/form-data with a 'file' field.");
  }

  const entry = form.get("file");
  if (!entry || typeof entry === "string") {
    return err(400, "Missing required multipart file field 'file'.");
  }
  const blob = entry as Blob;
  const filename = ((entry as File).name || "upload").slice(0, 255);

  if (blob.size === 0) return err(400, "Uploaded file is empty.");
  if (blob.size > MAX_FILE_SIZE) {
    return err(413, `File exceeds the ${Math.round(MAX_FILE_SIZE / 1024 / 1024)} MB size limit.`);
  }
  try {
    assertAccepted(filename);
  } catch (e) {
    return err(415, (e as Error).message);
  }

  const buffer = await blob.arrayBuffer();

  let processed: ProcessedFile;
  try {
    processed = await processUpload(filename, buffer);
  } catch (e) {
    if (e instanceof ApiError) return err(e.status, e.message);
    // Unexpected failure: persist a FAILED record so it can be inspected.
    const record = await db
      .insert(files)
      .values({
        id: crypto.randomUUID(),
        filename,
        fileType: "UNKNOWN",
        fileSize: blob.size,
        status: "FAILED",
        crs: "UNKNOWN",
        error: `Internal processing error: ${(e as Error).message}`,
      })
      .returning();
    return json({ ...toFileJson(record[0]), status: "FAILED" }, 201);
  }

  const id = crypto.randomUUID();
  try {
    const fileRow = await db.transaction(async (tx) => {
      const [f] = await tx
        .insert(files)
        .values({
          id,
          filename,
          fileType: processed.fileType,
          fileSize: blob.size,
          status: "COMPLETED",
          crs: processed.crs.label,
          crsEpsg: processed.crs.epsg,
          crsGeographic: processed.crs.isGeographic,
          featureCount: processed.features.length,
          measurementStrategy: processed.strategy,
        })
        .returning();
      if (processed.features.length) {
        await tx.insert(features).values(
          processed.features.map((feat) => ({
            id: crypto.randomUUID(),
            fileId: id,
            fIndex: feat.index,
            geometryType: feat.geometryType,
            properties: feat.properties,
            geometry: feat.geometry,
            supported: feat.measurement.supported,
            areaM2: feat.measurement.areaM2,
            lengthM: feat.measurement.lengthM,
            areaM2Geodesic: feat.measurement.areaM2Geodesic,
            lengthMGeodesic: feat.measurement.lengthMGeodesic,
            measurementCrs: feat.measurement.measurementCrs,
            note: feat.measurement.note,
          })),
        );
      }
      return f;
    });
    return json(toFileJson(fileRow), 201);
  } catch (e) {
    return err(500, `Persistence failed: ${(e as Error).message}`);
  }
}
