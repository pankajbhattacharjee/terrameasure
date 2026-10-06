export interface FileItem {
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
  summary?: {
    total: number;
    measured: number;
    unsupported: number;
    polygons: number;
    linestrings: number;
    points: number;
    other: number;
  };
}

export interface MeasurementItem {
  index: number;
  geometry_type: string;
  geometry: unknown;
  properties: Record<string, unknown>;
  crs: string;
  supported: boolean;
  area_m2: number | null;
  length_m: number | null;
  area_m2_geodesic: number | null;
  length_m_geodesic: number | null;
  measurement_crs: string | null;
  note: string | null;
}

export interface MeasurementPage {
  file_id: string;
  crs: string;
  crs_epsg: number | null;
  measurement_strategy: string | null;
  total: number;
  limit: number;
  offset: number;
  items: MeasurementItem[];
}

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { detail?: string };
    return body.detail ?? `Request failed (${res.status})`;
  } catch {
    return `Request failed (${res.status})`;
  }
}

export async function fetchFiles(): Promise<FileItem[]> {
  const res = await fetch("/api/files/", { cache: "no-store" });
  if (!res.ok) throw new Error(await readError(res));
  const body = (await res.json()) as { items: FileItem[] };
  return body.items;
}

export async function fetchFile(id: string): Promise<FileItem> {
  const res = await fetch(`/api/files/${id}/`, { cache: "no-store" });
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as FileItem;
}

export async function fetchMeasurements(
  id: string,
  limit: number,
  offset: number,
): Promise<MeasurementPage> {
  const res = await fetch(
    `/api/files/${id}/measurements/?limit=${limit}&offset=${offset}`,
    { cache: "no-store" },
  );
  if (!res.ok) throw new Error(await readError(res));
  return (await res.json()) as MeasurementPage;
}

export interface UploadResult {
  ok: boolean;
  record?: FileItem;
  error?: string;
}

export async function uploadGeofile(data: Blob, filename: string): Promise<UploadResult> {
  const form = new FormData();
  const file = new File([data], filename, {
    type: data.type || "application/octet-stream",
  });
  form.append("file", file);
  const res = await fetch("/api/files/", { method: "POST", body: form });
  const body = (await res.json().catch(() => null)) as (FileItem & { detail?: string }) | null;
  if (res.ok && body) return { ok: true, record: body as FileItem };
  return {
    ok: false,
    record: body && "id" in body ? (body as FileItem) : undefined,
    error: body?.detail ?? (res.ok ? "Unexpected response" : await readError(res)),
  };
}

export const SAMPLES = [
  {
    name: "kenya-survey.kml",
    label: "KML survey (EPSG:4326)",
    hint: "8 features · polygons, lines, points, MultiGeometry",
  },
  {
    name: "plot-utm33.zip",
    label: "Shapefile (EPSG:32633)",
    hint: "5 features · UTM projected CRS",
  },
];

export async function loadSample(name: string): Promise<Blob> {
  const res = await fetch(`/samples/${name}`);
  if (!res.ok) throw new Error(`Could not fetch sample ${name} (${res.status})`);
  return res.blob();
}
