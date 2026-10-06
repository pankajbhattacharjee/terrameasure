import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Manrope, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { IconCrosshair } from "@/components/icons";
import { HealthPill } from "@/components/HealthPill";

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
});

export const metadata: Metadata = {
  title: "TerraMeasure — Geospatial File Measurement API",
  description:
    "Upload Shapefile (.zip) or KML files, get per-feature CRS-aware area and length measurements.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${manrope.variable} ${spaceGrotesk.variable}`}>
      <body className="min-h-screen bg-paper font-sans text-ink">
        <header className="contour-dark sticky top-0 z-40 bg-panel text-paper shadow-[0_1px_0_0_rgba(0,0,0,0.4)]">
          <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3 sm:px-6">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent text-paneldeep">
              <IconCrosshair className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="font-display text-[17px] font-semibold leading-tight tracking-tight">
                TerraMeasure
              </p>
              <p className="text-[11px] leading-tight text-panelink">
                Geospatial File Measurement API
              </p>
            </div>
            <div className="ml-auto flex items-center gap-3">
              <span className="hidden rounded-full border border-panelink/30 px-3 py-1 font-display text-[11px] tracking-wide text-panelink sm:inline-block">
                REST · /api/files
              </span>
              <HealthPill />
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-4 pb-20 pt-8 sm:px-6">
          {children}
        </main>
        <footer className="border-t border-line bg-card">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-5 text-[12px] text-soft sm:px-6">
            <span className="font-display font-semibold text-ink">TerraMeasure</span>
            <span>Shapefile (.zip) &amp; KML → per-feature area / length</span>
            <span>CRS: UTM planar + WGS 84 geodesic (Turf, proj4)</span>
            <span className="ml-auto">PostgreSQL · Drizzle ORM</span>
          </div>
        </footer>
      </body>
    </html>
  );
}
