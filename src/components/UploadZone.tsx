"use client";

import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { uploadGeofile } from "@/lib/api-client";
import {
  IconAlert,
  IconCheck,
  IconSpinner,
  IconUpload,
  IconX,
  IconChevronRight,
} from "@/components/icons";
import Link from "next/link";

const ACCEPT = [".kml", ".zip", ".shp"];
const MAX = 50 * 1024 * 1024;

interface Props {
  onUploaded?: () => void;
}

interface Result {
  kind: "success" | "error";
  filename: string;
  id?: string;
  message: string;
}

export function UploadZone({ onUploaded }: Props) {
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const validate = useCallback((name: string, size: number): string | null => {
    const ok = ACCEPT.some((a) => name.toLowerCase().endsWith(a));
    if (!ok) return "Unsupported type — accepted: .kml, .zip (Shapefile), .shp";
    if (size === 0) return "File is empty";
    if (size > MAX) return "File exceeds the 50 MB limit";
    return null;
  }, []);

  const handleFile = useCallback(
    async (f: File) => {
      const v = validate(f.name, f.size);
      setLocalError(v);
      setResult(null);
      if (v) return;
      setBusy(true);
      try {
        const res = await uploadGeofile(f, f.name);
        if (res.ok && res.record) {
          if (res.record.status === "FAILED") {
            setResult({
              kind: "error",
              filename: f.name,
              id: res.record.id,
              message: res.record.error ?? "Processing failed",
            });
          } else {
            setResult({
              kind: "success",
              filename: f.name,
              id: res.record.id,
              message: `Processed ${res.record.feature_count} feature${res.record.feature_count === 1 ? "" : "s"} · CRS ${res.record.crs}`,
            });
          }
          onUploaded?.();
          router.refresh();
        } else {
          setResult({
            kind: "error",
            filename: f.name,
            id: res.record?.id,
            message: res.error ?? "Upload failed",
          });
          if (res.record?.id) onUploaded?.();
        }
      } catch (e) {
        setResult({
          kind: "error",
          filename: f.name,
          message: `Upload failed: ${(e as Error).message}`,
        });
      } finally {
        setBusy(false);
      }
    },
    [onUploaded, router, validate],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const f = e.dataTransfer.files?.[0];
      if (f) void handleFile(f);
    },
    [handleFile],
  );

  return (
    <div>
      <div
        role="button"
        tabIndex={0}
        aria-label="Upload a geospatial file"
        onClick={() => inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
        }}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`group relative cursor-pointer rounded-xl border-2 border-dashed px-6 py-9 text-center transition-all ${
          dragging
            ? "border-accent bg-accentsoft/70 scale-[1.005]"
            : "border-linestrong bg-card hover:border-accent/60 hover:bg-accentsoft/30"
        } ${busy ? "pointer-events-none opacity-80" : ""}`}
      >
        <input
          ref={inputRef}
          type="file"
          accept=".kml,.zip,.shp"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = "";
          }}
        />
        {busy ? (
          <div className="flex flex-col items-center gap-3">
            <IconSpinner className="h-8 w-8 text-accent" />
            <p className="font-display text-sm font-semibold">
              Parsing features, resolving CRS, computing measurements…
            </p>
            <p className="text-xs text-soft">This usually takes a second or two.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-3">
            <div
              className={`flex h-12 w-12 items-center justify-center rounded-full transition-colors ${
                dragging ? "bg-accent text-paper" : "bg-paper text-soft group-hover:bg-accentsoft group-hover:text-accentdeep"
              }`}
            >
              <IconUpload className="h-6 w-6" />
            </div>
            <div>
              <p className="font-display text-[15px] font-semibold">
                {dragging ? "Drop it to measure" : "Drop a geospatial file, or click to browse"}
              </p>
              <p className="mt-1 text-xs text-soft">
                <span className="font-semibold text-ink/70">.zip</span> Shapefile ·{" "}
                <span className="font-semibold text-ink/70">.kml</span> · up to 50 MB
              </p>
            </div>
          </div>
        )}
      </div>

      {localError && (
        <p className="mt-2 flex items-center gap-1.5 text-xs font-medium text-brick">
          <IconAlert className="h-3.5 w-3.5" /> {localError}
        </p>
      )}

      {result && !busy && (
        <div
          className={`rise mt-3 flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm ${
            result.kind === "success"
              ? "border-moss/30 bg-mosssoft text-mossdeep"
              : "border-brick/30 bg-bricksoft text-brick"
          }`}
        >
          {result.kind === "success" ? (
            <IconCheck className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <IconAlert className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <div className="min-w-0">
            <p className="font-semibold">
              {result.filename}{" "}
              {result.kind === "success" ? "processed" : "could not be processed"}
            </p>
            <p className="mt-0.5 text-[13px] leading-snug opacity-90">{result.message}</p>
            {result.id && (
              <Link
                href={`/files/${result.id}`}
                className="mt-1.5 inline-flex items-center gap-1 text-[13px] font-bold underline underline-offset-2 hover:opacity-80"
                onClick={(e) => e.stopPropagation()}
              >
                View file record <IconChevronRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>
          <button
            onClick={() => setResult(null)}
            aria-label="Dismiss"
            className="ml-auto shrink-0 rounded p-1 opacity-60 hover:opacity-100"
          >
            <IconX className="h-3.5 w-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}
