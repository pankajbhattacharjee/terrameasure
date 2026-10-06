import { err, getFile, json } from "@/lib/records";

export const dynamic = "force-dynamic";

/**
 * GET /api/files/{id}/ — information about an uploaded file,
 * including per-geometry-type summary counts.
 */
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) {
    return err(400, "Invalid file id format.");
  }
  try {
    const file = await getFile(id);
    if (!file) return err(404, `File ${id} not found.`);
    return json(file);
  } catch (e) {
    return err(500, `Could not load file: ${(e as Error).message}`);
  }
}
