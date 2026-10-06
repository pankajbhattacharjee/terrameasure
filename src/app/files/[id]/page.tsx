"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  FileItem,
  MeasurementItem,
  MeasurementPage,
  fetchFile,
  fetchMeasurements,
} from "@/lib/api-client";
import { GeomIcon, GeomTypeLabel, StatusChip, TypeBadge } from "@/components/badges";
import {
  IconAlert,
  IconArrowLeft,
  IconBraces,
  IconChevronLeft,
  IconChevronRight,
  IconGlobe,
  IconRuler,
  IconSpinner,
} from "@/components/icons";
import { areaAlt, formatArea, formatBytes, formatDateTime, formatLength } from "@/lib/format";

const PAGE_SIZE = 50;

export default function FileDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [file, setFile] = useState<FileItem | null>(null);
  const [page, setPage] = useState<MeasurementPage | null>(null);
  const [offset, setOffset] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const f = await fetchFile(id);
      setFile(f);
      const m = await fetchMeasurements(id, PAGE_SIZE, offset);
      setPage(m);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }, [id, offset]);

  useEffect(() => {
    void load();
  }, [load]);

  if (error) {
    return (
      <div className="rise mx-auto max-w-lg rounded-xl border border-brick/30 bg-bricksoft px-6 py-8 text-center">
        <IconAlert className="mx-auto h-8 w-8 text-brick" />
        <h1 className="mt-3 font-display text-lg font-bold">File not found</h1>
        <p className="mt-1 text-sm text-brick/90">{error}</p>
        <Link
          href="/"
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-brick px-4 py-2 text-sm font-bold text-paper hover:opacity-90"
        >
          <IconArrowLeft className="h-4 w-4" /> Back to dashboard
        </Link>
      </div>
    );
  }

  if (loading || !file) {
    return (
      <div className="flex items-center justify-center gap-3 py-24 text-sm text-soft">
        <IconSpinner className="h-5 w-5" /> Loading file record…
      </div>
    );
  }

  const s = file.summary;
  const total = page?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;

  return (
    <div className="rise">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-[13px] font-bold text-soft transition-colors hover:text-accentdeep"
      >
        <IconArrowLeft className="h-4 w-4" /> All files
      </Link>

      {/* File meta card */}
      <section className="mt-4 overflow-hidden rounded-xl border border-line bg-card">
        <div className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4">
          <h1 className="font-display text-lg font-bold tracking-tight break-all sm:text-xl">
            {file.filename}
          </h1>
          <TypeBadge type={file.file_type} />
          <StatusChip status={file.status} />
          <span className="num ml-auto text-xs text-faint">{file.id}</span>
        </div>

        {file.status === "FAILED" ? (
          <div className="flex items-start gap-3 px-5 py-5">
            <IconAlert className="mt-0.5 h-5 w-5 shrink-0 text-brick" />
            <div>
              <p className="text-sm font-bold text-brick">Processing failed</p>
              <p className="mt-1 rounded-lg bg-bricksoft px-3 py-2 font-mono text-[12px] leading-relaxed text-brick/90">
                {file.error ?? "No error details recorded."}
              </p>
              <p className="mt-2 text-xs text-soft">
                The file record is retained for inspection. Re-upload a corrected file to
                regenerate measurements.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-x-6 gap-y-4 px-5 py-4 sm:grid-cols-3 lg:grid-cols-6">
              <Meta label="Features" value={file.feature_count.toLocaleString()} />
              <Meta label="File size" value={formatBytes(file.file_size)} />
              <Meta
                label="CRS"
                value={
                  <span className="flex items-center gap-1.5">
                    <IconGlobe className="h-3.5 w-3.5 shrink-0 text-soft" />
                    <span className="truncate font-display text-[13px] font-semibold">
                      {file.crs}
                    </span>
                  </span>
                }
                title={file.measurement_strategy ?? undefined}
              />
              <Meta
                label="Strategy"
                value={
                  <span className="truncate text-[12px] font-semibold text-soft">
                    {file.measurement_strategy ?? "—"}
                  </span>
                }
              />
              <Meta label="Uploaded" value={formatDateTime(file.uploaded_at)} />
              <Meta
                label="Measured"
                value={
                  <span className="font-display text-[13px] font-semibold">
                    {s ? `${s.measured} of ${s.total}` : "—"}
                  </span>
                }
              />
            </div>

            {s && (
              <div className="flex flex-wrap gap-2 border-t border-line bg-paper/50 px-5 py-3">
                <SummaryChip icon={<IconGeomPoly />} label="Polygons" n={s.polygons} />
                <SummaryChip icon={<IconGeomLine />} label="Lines" n={s.linestrings} />
                <SummaryChip icon={<IconGeomPoint />} label="Points (no measurement)" n={s.points} />
                <SummaryChip icon={<IconBraces className="h-3.5 w-3.5" />} label="Other" n={s.other} />
                {s.unsupported > 0 && (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-amber/30 bg-ambersoft px-2.5 py-1 text-[11px] font-bold text-amber">
                    {s.unsupported} not measurable
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </section>

      {/* Measurements */}
      {file.status !== "FAILED" && (
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-lg font-bold tracking-tight">
              <IconRuler className="h-5 w-5 text-accent" /> Feature measurements
            </h2>
            <span className="num text-xs text-soft">
              Showing {total === 0 ? 0 : offset + 1}–{Math.min(offset + PAGE_SIZE, total)} of{" "}
              {total.toLocaleString()}
            </span>
          </div>

          <div className="overflow-hidden rounded-xl border border-line bg-card">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[860px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line bg-paper/70 text-[10px] font-bold uppercase tracking-[0.09em] text-faint">
                    <th className="px-4 py-2.5 w-14">#</th>
                    <th className="px-3 py-2.5">Geometry</th>
                    <th className="px-3 py-2.5 min-w-[200px]">Properties</th>
                    <th className="px-3 py-2.5 text-right">Area</th>
                    <th className="px-3 py-2.5 text-right">Length</th>
                    <th className="px-3 py-2.5">Measured in</th>
                    <th className="px-3 py-2.5">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {page?.items.map((m) => (
                    <FeatureRow key={m.index} m={m} />
                  ))}
                </tbody>
              </table>
            </div>

            {pages > 1 && (
              <div className="flex items-center justify-between border-t border-line bg-paper/50 px-4 py-2.5">
                <button
                  onClick={() => setOffset(Math.max(0, offset - PAGE_SIZE))}
                  disabled={offset === 0}
                  className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-bold text-soft transition-colors hover:bg-card hover:text-ink disabled:opacity-40"
                >
                  <IconChevronLeft className="h-3.5 w-3.5" /> Previous
                </button>
                <span className="num text-xs font-semibold text-soft">
                  Page {currentPage} / {pages}
                </span>
                <button
                  onClick={() => setOffset(Math.min(total - PAGE_SIZE, offset + PAGE_SIZE))}
                  disabled={offset + PAGE_SIZE >= total}
                  className="inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-bold text-soft transition-colors hover:bg-card hover:text-ink disabled:opacity-40"
                >
                  Next <IconChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          <p className="mt-3 text-[11px] leading-relaxed text-faint">
            <strong className="text-soft">Planar</strong> values are computed in a projected CRS
            (UTM zone per feature for geographic files, source CRS for projected files) — never in
            degrees. <strong className="text-soft">Geodesic</strong> values use the WGS 84
            ellipsoid (Turf) as a cross-check.
          </p>
        </section>
      )}
    </div>
  );
}

function Meta({ label, value, title }: { label: string; value: React.ReactNode; title?: string }) {
  return (
    <div className="min-w-0" title={title}>
      <p className="text-[10px] font-bold uppercase tracking-[0.09em] text-faint">{label}</p>
      <div className="num mt-1 truncate text-[13px] font-semibold">{value}</div>
    </div>
  );
}

function SummaryChip({ icon, label, n }: { icon: React.ReactNode; label: string; n: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-2.5 py-1 text-[11px] font-bold text-soft">
      {icon} {label} <span className="num text-ink">{n}</span>
    </span>
  );
}

function IconGeomPoly() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8">
      <path d="M12 3.5 19.5 9l-2.9 8.7H7.4L4.5 9z" />
    </svg>
  );
}
function IconGeomLine() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <path d="M3.5 17.5 9 7.5l4.5 5.5 7-8" />
    </svg>
  );
}
function IconGeomPoint() {
  return (
    <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor">
      <circle cx="12" cy="12" r="2.4" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12" r="6.5" strokeDasharray="2.5 3" strokeWidth="1.6" />
    </svg>
  );
}

function FeatureRow({ m }: { m: MeasurementItem }) {
  const [showAll, setShowAll] = useState(false);
  const entries = Object.entries(m.properties ?? {});
  const visible = showAll ? entries : entries.slice(0, 3);

  const hasArea = m.area_m2 != null;
  const hasLength = m.length_m != null;

  return (
    <tr className={`align-top transition-colors hover:bg-accentsoft/20 ${!m.supported ? "bg-paper/40" : ""}`}>
      <td className="num px-4 py-3 text-[12px] font-bold text-faint">{m.index}</td>
      <td className="px-3 py-3">
        <GeomTypeLabel type={m.geometry_type} />
      </td>
      <td className="px-3 py-3">
        {entries.length === 0 ? (
          <span className="text-[12px] text-faint">—</span>
        ) : (
          <div className="space-y-0.5">
            {visible.map(([k, v]) => (
              <p key={k} className="flex gap-1.5 text-[12px] leading-snug">
                <span className="shrink-0 font-semibold text-soft">{k}:</span>
                <span className="num min-w-0 truncate text-ink/80">
                  {typeof v === "object" && v !== null ? JSON.stringify(v) : String(v)}
                </span>
              </p>
            ))}
            {entries.length > 3 && (
              <button
                onClick={() => setShowAll((s) => !s)}
                className="text-[11px] font-bold text-accentdeep hover:underline"
              >
                {showAll ? "Show less" : `+${entries.length - 3} more`}
              </button>
            )}
          </div>
        )}
      </td>
      <td className="px-3 py-3 text-right">
        {hasArea ? (
          <div>
            <p className="num font-display text-[13px] font-bold">{formatArea(m.area_m2)}</p>
            {m.area_m2_geodesic != null && (
              <p className="num text-[11px] text-faint" title="WGS 84 geodesic (Turf)">
                ≈ {formatArea(m.area_m2_geodesic)}
              </p>
            )}
            {areaAlt(m.area_m2) && (
              <p className="num text-[11px] text-faint">{areaAlt(m.area_m2)}</p>
            )}
          </div>
        ) : (
          <span className="text-faint">—</span>
        )}
      </td>
      <td className="px-3 py-3 text-right">
        {hasLength ? (
          <div>
            <p className="num font-display text-[13px] font-bold">{formatLength(m.length_m)}</p>
            {m.length_m_geodesic != null && (
              <p className="num text-[11px] text-faint" title="WGS 84 geodesic (Turf)">
                ≈ {formatLength(m.length_m_geodesic)}
              </p>
            )}
          </div>
        ) : (
          <span className="text-faint">—</span>
        )}
      </td>
      <td className="max-w-[170px] px-3 py-3">
        {m.measurement_crs ? (
          <span
            className="block truncate font-display text-[11px] font-semibold text-soft"
            title={m.measurement_crs}
          >
            {m.measurement_crs}
          </span>
        ) : (
          <span className="text-faint">—</span>
        )}
      </td>
      <td className="px-3 py-3">
        {m.supported ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-moss/25 bg-mosssoft px-2 py-0.5 text-[11px] font-bold text-mossdeep">
            Measured
          </span>
        ) : (
          <span
            className="inline-flex max-w-[170px] items-center gap-1 rounded-full border border-amber/25 bg-ambersoft px-2 py-0.5 text-[11px] font-bold text-amber"
            title={m.note ?? undefined}
          >
            <IconAlert className="h-3 w-3 shrink-0" />
            <span className="truncate">{m.note ?? "Not measurable"}</span>
          </span>
        )}
      </td>
    </tr>
  );
}
