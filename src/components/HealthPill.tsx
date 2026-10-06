"use client";

import { useEffect, useState } from "react";

export function HealthPill() {
  const [state, setState] = useState<"checking" | "ok" | "down">("checking");

  useEffect(() => {
    let live = true;
    const check = async () => {
      try {
        const r = await fetch("/api/health", { cache: "no-store" });
        if (live) setState(r.ok ? "ok" : "down");
      } catch {
        if (live) setState("down");
      }
    };
    check();
    const t = setInterval(check, 30000);
    return () => {
      live = false;
      clearInterval(t);
    };
  }, []);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
        state === "ok"
          ? "bg-[#31402a] text-[#a8d18c]"
          : state === "down"
            ? "bg-[#4a2a22] text-[#f0a58e]"
            : "bg-[#3a3f33] text-panelink"
      }`}
    >
      <span
        className={`h-1.5 w-1.5 rounded-full ${
          state === "ok" ? "bg-[#8fd065]" : state === "down" ? "bg-[#ff9b7d]" : "bg-panelink"
        }`}
      />
      {state === "ok" ? "Service online" : state === "down" ? "Service offline" : "Checking…"}
    </span>
  );
}
