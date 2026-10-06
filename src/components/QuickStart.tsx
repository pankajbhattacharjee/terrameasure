"use client";

import { useState } from "react";
import { IconBraces, IconCheck, IconCopy } from "@/components/icons";

interface Endpoint {
  method: string;
  path: string;
  desc: string;
  curl: string;
}

const ENDPOINTS: Endpoint[] = [
  {
    method: "POST",
    path: "/api/files/",
    desc: "Upload & process a .zip Shapefile or .kml",
    curl: `curl -s -F "file=@kenya-survey.kml" \\\n  http://localhost:3000/api/files/`,
  },
  {
    method: "GET",
    path: "/api/files/{id}/",
    desc: "File record: CRS, counts, status, summary",
    curl: `curl -s http://localhost:3000/api/files/{id}/`,
  },
  {
    method: "GET",
    path: "/api/files/{id}/measurements/",
    desc: "Per-feature area / length (planar + geodesic)",
    curl: `curl -s "http://localhost:3000/api/files/{id}/measurements/?limit=25&offset=0"`,
  },
];

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      onClick={() => {
        void navigator.clipboard?.writeText(text).catch(() => {});
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
      aria-label="Copy to clipboard"
      className="rounded p-1.5 text-faint transition-colors hover:bg-paper hover:text-ink"
    >
      {copied ? <IconCheck className="h-3.5 w-3.5 text-moss" /> : <IconCopy className="h-3.5 w-3.5" />}
    </button>
  );
}

export function QuickStart() {
  return (
    <aside className="overflow-hidden rounded-xl border border-line bg-card">
      <div className="flex items-center gap-2 border-b border-line bg-paper/60 px-4 py-2.5">
        <IconBraces className="h-4 w-4 text-accent" />
        <h2 className="font-display text-[13px] font-bold tracking-wide">REST API quick start</h2>
      </div>
      <div className="divide-y divide-line">
        {ENDPOINTS.map((e) => (
          <div key={e.path} className="px-4 py-3">
            <div className="flex items-center gap-2">
              <span
                className={`rounded px-1.5 py-0.5 font-display text-[10px] font-bold tracking-wider ${
                  e.method === "POST"
                    ? "bg-accentsoft text-accentdeep"
                    : "bg-mosssoft text-mossdeep"
                }`}
              >
                {e.method}
              </span>
              <code className="font-display text-[13px] font-semibold text-ink">{e.path}</code>
            </div>
            <p className="mt-1 text-xs text-soft">{e.desc}</p>
            <div className="relative mt-2">
              <pre className="overflow-x-auto rounded-md bg-panel px-3 py-2.5 pr-10 text-[11px] leading-relaxed text-[#d8dcc6]">
                {e.curl}
              </pre>
              <div className="absolute right-1 top-1">
                <CopyBtn text={e.curl} />
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="border-t border-line bg-paper/60 px-4 py-2.5 text-[11px] text-soft">
        Responses are JSON · see <span className="font-semibold text-ink/70">README.md</span> for
        full schemas &amp; design notes
      </div>
    </aside>
  );
}
