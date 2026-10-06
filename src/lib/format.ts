export function formatArea(m2: number | null): string {
  if (m2 == null) return "—";
  const fmt = (n: number, d = 0) =>
    n.toLocaleString("en-US", { maximumFractionDigits: d });
  if (m2 >= 1e6) return `${fmt(m2 / 1e6, 3)} km²`;
  if (m2 >= 1e4) return `${fmt(m2, 0)} m²`;
  if (m2 >= 100) return `${fmt(m2, 0)} m²`;
  return `${fmt(m2, 1)} m²`;
}

export function areaAlt(m2: number | null): string | null {
  if (m2 == null) return null;
  if (m2 >= 1e4) return `${(m2 / 1e4).toLocaleString("en-US", { maximumFractionDigits: 2 })} ha`;
  if (m2 >= 1e6) return null;
  return null;
}

export function formatLength(m: number | null): string {
  if (m == null) return "—";
  if (m >= 1000) return `${(m / 1000).toLocaleString("en-US", { maximumFractionDigits: 3 })} km`;
  if (m >= 100) return `${m.toLocaleString("en-US", { maximumFractionDigits: 0 })} m`;
  return `${m.toLocaleString("en-US", { maximumFractionDigits: 1 })} m`;
}

export function formatBytes(n: number): string {
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  if (n >= 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${n} B`;
}

export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
