"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  FileItem,
  SAMPLES,
  fetchFiles,
  loadSample,
  uploadGeofile,
} from "@/lib/api-client";
import { UploadZone } from "@/components/UploadZone";
import { QuickStart } from "@/components/QuickStart";
import { StatusChip, TypeBadge } from "@/components/badges";
import {
  IconActivity,
  IconAlert,
  IconChevronRight,
  IconDatabase,
  IconFileZip,
  IconKml,
  IconLayers,
  IconSpinner,
} from "@/components/icons";
import { formatBytes, formatDateTime } from "@/lib/format";

type LoadState = "idle" | "loading" | "error";

export default function DashboardPage() {
  const [files, setFiles] = useState<FileItem[] | null>(null);
  const [listError, setListError] = useState<string | null>(null);
  const [sampleState, setSampleState] = useState<Record<string, LoadState>>({});

  const refresh = useCallback(() => {
    fetchFiles()
      .then(setFiles)
      .catch((e) => setListError((e as Error).message));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const runSample = async (name: string) => {
    setSampleState((s) => ({ ...s, [name]: "loading" }));
    try {
      const blob = await loadSample(name);
      const res = await uploadGeofile(blob, name);
      if (!res.ok && !res.record?.id) {
        setSampleState((s) => ({ ...s, [name]: "error" }));
      }
    } catch {
      setSampleState((s) => ({ ...s, [name]: "error" }));
      return;
    }
    setSampleState((s) => ({ ...s, [name]: "idle" }));
    refresh();
  };

  const totalFeatures = files?.reduce((s, f) => s + f.feature_count, 0) ?? 0;
  const completed = files?.filter((f) => f.status === "COMPLETED").length ?? 0;
  const failed = files?.filter((f) => f.status === "FAILED").length ?? 0;

  return (
    <div className="rise">
      {/* Hero row */}
      <section className="grid gap-5 lg:grid-cols-12">
        <div className="lg:col-span-7">
          <h1 className="font-display text-[26px] font-bold leading-tight tracking-tight sm:text-[30px]">
            Measure any Shapefile or KML,
            <br />
            <span className="text-accent">in the correct CRS.</span>
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-soft">
            Upload a <strong className="text-ink">.zip</strong> Shapefile or{" "}
            <strong className="text-ink">.kml</strong>. Every feature is parsed, its CRS
            resolved, and area / length computed in a projected system — never in raw degrees —
            with WGS 84 geodesic cross-checks.
          </p>

          <div className="mt-5">
            <UploadZone onUploaded={refresh} />
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-soft">Try a sample:</span>
            {SAMPLES.map((s) => {
              const st = sampleState[s.name] ?? "idle";
              return (
                <button
                  key={s.name}
                  onClick={() => void runSample(s.name)}
                  disabled={st === "loading"}
                  title={s.hint}
                  className="inline-flex items-center gap-1.5 rounded-full border border-linestrong bg-card px-3 py-1.5 text-xs font-semibold transition-all hover:border-accent/60 hover:bg-accentsoft/40 disabled:opacity-60"
                >
                  {st === "loading" ? (
                    <IconSpinner className="h-3.5 w-3.5 text-accent" />
                  ) : (
                    <IconUpload2 />
                  )}
                  {s.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-5">
          <QuickStart />
        </div>
      </section>

      {/* Stats strip */}
      <section className="mt-8 overflow-hidden rounded-xl border border-line bg-card">
        <div className="grid grid-cols-2 divide-x divide-line sm:grid-cols-4">
          <Stat icon={<IconDatabase className="h-4 w-4" />} label="Files processed" value={files ? files.length : null} />
          <Stat icon={<IconLayers className="h-4 w-4" />} label="Features extracted" value={files ? totalFeatures : null} />
          <Stat icon={<IconActivity className="h-4 w-4" />} label="Completed" value={files ? completed : null} tone="moss" />
          <Stat icon={<IconAlert className="h-4 w-4" />} label="Failed" value={files ? failed : null} tone={failed ? "brick" : undefined} />
        </div>
      </section>

      {/* File table */}
      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-lg font-bold tracking-tight">Uploaded files</h2>
          <button
            onClick={refresh}
            className="text-xs font-semibold text-soft transition-colors hover:text-ink"
          >
            Refresh
          </button>
        </div>

        <div className="overflow-hidden rounded-xl border border-line bg-card">
          {listError ? (
            <div className="flex items-center gap-2 px-5 py-6 text-sm text-brick">
              <IconAlert className="h-4 w-4" /> {listError}
            </div>
          ) : !files ? (
            <div className="flex items-center gap-3 px-5 py-8 text-sm text-soft">
              <IconSpinner className="h-4 w-4" /> Loading file records…
            </div>
          ) : files.length === 0 ? (
            <div className="contour flex flex-col items-center gap-2 px-6 py-14 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-paper text-faint">
                <IconLayers className="h-6 w-6" />
              </div>
              <p className="font-display text-sm font-bold">No files yet</p>
              <p className="max-w-sm text-xs leading-relaxed text-soft">
                Upload a .kml or .zip Shapefile above — or load one of the bundled samples to see
                the full pipeline in action.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left text-sm">
                <thead>
                  <tr className="border-b border-line bg-paper/70 text-[10px] font-bold uppercase tracking-[0.09em] text-faint">
                    <th className="px-4 py-2.5">File</th>
                    <th className="px-3 py-2.5">Type</th>
                    <th className="px-3 py-2.5 text-right">Features</th>
                    <th className="px-3 py-2.5">CRS</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5 text-right">Size</th>
                    <th className="px-3 py-2.5">Uploaded</th>
                    <th className="px-3 py-2.5" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {files.map((f) => (
                    <tr
                      key={f.id}
                      className="group transition-colors hover:bg-accentsoft/25"
                    >
                      <td className="max-w-[240px] px-4 py-3">
                        <Link
                          href={`/files/${f.id}`}
                          className="flex items-center gap-2.5 font-semibold hover:text-accentdeep"
                        >
                          <span className="shrink-0 text-soft">
                            {f.file_type === "KML" ? (
                              <IconKml className="h-4.5 w-4.5" />
                            ) : (
                              <IconFileZip className="h-4.5 w-4.5" />
                            )}
                          </span>
                          <span className="truncate">{f.filename}</span>
                        </Link>
                        <p className="num mt-0.5 truncate pl-6.5 text-[11px] text-faint">
                          {f.id}
                        </p>
                      </td>
                      <td className="px-3 py-3">
                        <TypeBadge type={f.file_type} />
                      </td>
                      <td className="num px-3 py-3 text-right font-semibold">
                        {f.feature_count.toLocaleString()}
                      </td>
                      <td className="max-w-[160px] px-3 py-3">
                        <span className="block truncate font-display text-[12px] font-semibold text-ink/80">
                          {f.crs}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <StatusChip status={f.status} />
                      </td>
                      <td className="num px-3 py-3 text-right text-soft">
                        {formatBytes(f.file_size)}
                      </td>
                      <td className="num px-3 py-3 whitespace-nowrap text-soft">
                        {formatDateTime(f.uploaded_at)}
                      </td>
                      <td className="px-3 py-3 text-right">
                        <Link
                          href={`/files/${f.id}`}
                          className="inline-flex items-center gap-0.5 rounded-md px-2 py-1 text-xs font-bold text-accentdeep opacity-70 transition-all hover:bg-accentsoft hover:opacity-100"
                        >
                          View <IconChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function Stat({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | null;
  tone?: "moss" | "brick";
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-4">
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
          tone === "moss"
            ? "bg-mosssoft text-mossdeep"
            : tone === "brick"
              ? "bg-bricksoft text-brick"
              : "bg-paper text-soft"
        }`}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="num font-display text-xl font-bold leading-none">
          {value == null ? "·" : value.toLocaleString()}
        </p>
        <p className="mt-1 truncate text-[11px] font-semibold text-soft">{label}</p>
      </div>
    </div>
  );
}

function IconUpload2() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-3.5 w-3.5"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 16V5M7 10l5-5 5 5M5 19h14" />
    </svg>
  );
}
