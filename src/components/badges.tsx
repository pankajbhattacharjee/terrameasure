import type { ReactNode } from "react";
import { IconLayers, IconLine, IconPoint, IconPolygon } from "@/components/icons";

export function StatusChip({ status }: { status: string }) {
  const map: Record<string, { cls: string; label: string }> = {
    COMPLETED: { cls: "bg-mosssoft text-mossdeep border-moss/25", label: "Completed" },
    FAILED: { cls: "bg-bricksoft text-brick border-brick/25", label: "Failed" },
    PENDING: { cls: "bg-ambersoft text-amber border-amber/25", label: "Pending" },
  };
  const s = map[status] ?? { cls: "bg-paper text-soft border-line", label: status };
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${s.cls}`}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-current" />
      {s.label}
    </span>
  );
}

export function TypeBadge({ type }: { type: string }) {
  const isKml = type === "KML";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-display text-[11px] font-bold tracking-wide ${
        isKml ? "bg-[#e8e4f2] text-[#5a4a8a]" : "bg-accentsoft text-accentdeep"
      }`}
    >
      {type}
    </span>
  );
}

export function GeomIcon({ type, className = "h-4 w-4" }: { type: string; className?: string }) {
  if (/^Point$/.test(type)) return <IconPoint className={className} />;
  if (type === "MultiPoint") return <IconPoint className={className} />;
  if (/Polygon/.test(type)) return <IconPolygon className={className} />;
  if (/LineString/.test(type)) return <IconLine className={className} />;
  return <IconLayers className={className} />;
}

export function GeomTypeLabel({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] font-semibold">
      <span className="text-soft">
        <GeomIcon type={type} />
      </span>
      {type}
    </span>
  );
}

export function Metric({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-faint">{label}</p>
      <div className="mt-0.5 truncate">{children}</div>
    </div>
  );
}
